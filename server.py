"""Local exhibition server and LAN ticket delivery."""
import argparse
import io
import ipaddress
import json
import os
import re
import secrets
import socket
import threading
import time
import webbrowser
from functools import partial
from http.client import HTTPConnection, HTTPException
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import qrcode
import cloud_tickets
from PIL import Image

ROOT = Path(__file__).resolve().parent
PASSES = ROOT / 'records'
LOCK = threading.RLock()
from scoring import score_answers
PLACES = {row[0]: row[1:] for row in json.loads((ROOT / 'assets/cities.json').read_text(encoding='utf-8'))}
PLACES.update({code: (name, name, lng, lat) for code, name, _, lng, lat in
               json.loads((ROOT / 'assets/countries.json').read_text(encoding='utf-8'))})
DEMO = False
PUBLIC_BASE = ''

IMAGE_LIMIT = 12_000_000
TD_IMAGE_NAME = re.compile(r'emotion_[0-9]+\.png')

def fetch_td_png(filename):
    if not isinstance(filename, str) or not TD_IMAGE_NAME.fullmatch(filename):
        raise ValueError('Invalid TD filename')
    connection = HTTPConnection('127.0.0.1', 9980, timeout=4)
    try:
        connection.request('GET', '/emotion-image/' + filename)
        response = connection.getresponse()
        if response.status != 200:
            raise OSError(f'TD image returned HTTP {response.status}')
        return response.read(IMAGE_LIMIT + 1)
    finally:
        connection.close()

def save_ticket_png(ticket, data):
    if not data or len(data) > IMAGE_LIMIT:
        raise ValueError('Invalid image size')
    with Image.open(io.BytesIO(data)) as image:
        if image.format != 'PNG' or image.width * image.height > 25_000_000:
            raise ValueError('Expected PNG')
        image.load()
        if image.convert('RGBA').getchannel('A').getbbox() is None:
            raise ValueError('TD PNG is fully transparent')
    with LOCK:
        temp = PASSES / f'{ticket}.png.tmp'
        temp.write_bytes(data)
        temp.replace(PASSES / f'{ticket}.png')

# Folder mode is intended for a single exhibition station and a dedicated TD output directory.
TD_FOLDER = None
folder_ticket = None

def import_next_capture(ticket, previous):
    global folder_ticket
    stable = {}
    while True:
        time.sleep(.25)
        try:
            candidates = [path for path in TD_FOLDER.iterdir()
                          if path.name not in previous and TD_IMAGE_NAME.fullmatch(path.name) and path.is_file()]
        except OSError:
            continue
        if len(candidates) != 1:
            stable.clear()
            continue
        path = candidates[0]
        try:
            stat = path.stat()
            signature = stat.st_size, stat.st_mtime_ns
            if stable.get(path.name) != signature:
                stable = {path.name: signature}
                continue
            with path.open('rb') as stream:
                data = stream.read(IMAGE_LIMIT + 1)
            if path.stat().st_mtime_ns != stat.st_mtime_ns:
                continue
            save_ticket_png(ticket, data)
        except (ValueError, OSError, Image.DecompressionBombError):
            continue
        with LOCK:
            folder_ticket = None
        print(f'[归线 TD] 票根已自动读取截图 {path.name}', flush=True)
        return

def arm_capture(ticket):
    global folder_ticket
    with LOCK:
        if folder_ticket == ticket:
            return True
        if folder_ticket is not None:
            return False
        previous = {path.name for path in TD_FOLDER.iterdir()}
        folder_ticket = ticket
        threading.Thread(target=import_next_capture, args=(ticket, previous), daemon=True).start()
        return True

def write_record(record):
    path = PASSES / f"{record['id']}.json"
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(record, ensure_ascii=False), encoding='utf-8')
    temp.replace(path)

def find_lan():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(('192.0.2.1', 80))
            return probe.getsockname()[0]
    except OSError:
        return '127.0.0.1'

cloud_pending = set()

def publish_ticket(record, image_path):
    ticket = record['id']
    def upload():
        try:
            mime = 'image/png' if image_path.suffix == '.png' else 'image/jpeg'
            url = cloud_tickets.publish(record, image_path.read_bytes(), mime)
            with LOCK:
                latest = json.loads((PASSES / f'{ticket}.json').read_text(encoding='utf-8'))
                latest['cloudUrl'] = url
                latest['cloudExpiry'] = time.time() + 604800
                write_record(latest)
        except (OSError, ValueError, KeyError) as error:
            print(f'[归线] 云端上传失败 {type(error).__name__}: {getattr(error, "code", "")}', flush=True)
            time.sleep(5)
        finally:
            with LOCK:
                cloud_pending.discard(ticket)
    cloud_pending.add(ticket)
    threading.Thread(target=upload, daemon=True).start()

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        super().end_headers()

    def respond(self, data, status=200, mime='application/json; charset=utf-8'):
        if isinstance(data, dict) or isinstance(data, list):
            data = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def get_record(self, ticket):
        if not re.fullmatch(r'[a-f0-9]{32}', ticket):
            raise ValueError
        return json.loads((PASSES / f'{ticket}.json').read_text(encoding='utf-8'))

    def do_HEAD(self):
        self.send_error(405)

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == '/api/archive':
            with LOCK:
                pins = []
                for file in sorted(PASSES.glob('*.json'), key=lambda f: f.stat().st_mtime):
                    record = json.loads(file.read_text(encoding='utf-8'))
                    if record.get('joined'):
                        pins.append({k: record[k] for k in ('city', 'lng', 'lat', 'dominant')})
            return self.respond(pins)
        match = re.fullmatch(r'/api/(ticket|qr|image|capture)/([a-f0-9]{32})', url.path)
        if match:
            action, ticket = match.groups()
            try:
                with LOCK:
                    record = self.get_record(ticket)
                    png = PASSES / f'{ticket}.png'
                    img = PASSES / f'{ticket}.jpg'
                    if action == 'ticket':
                        public = {k: record[k] for k in ('id', 'city', 'lng', 'lat', 'dominant')}
                        return self.respond({**public, 'ready': png.exists() or img.exists(), 'demo': DEMO})
                    if action == 'capture':
                        if not secrets.compare_digest(self.headers.get('X-Ticket-Key', ''), record['writeKey']):
                            return self.respond({'error': '票根凭证不匹配'}, 403)
                        return self.respond({'requested': record.get('captureRequested', False)})
                    if action == 'qr':
                        buffer = io.BytesIO()
                        target = f'{PUBLIC_BASE}/?ticket={ticket}'
                        if cloud_tickets.KEY:
                            if record.get('cloudExpiry', 0) <= time.time() + 60:
                                if ticket not in cloud_pending and (png.exists() or img.exists()):
                                    publish_ticket(record, png if png.exists() else img)
                                return self.respond({'pending': True}, 202)
                            target = record['cloudUrl']
                        qrcode.make(target).save(buffer, format='PNG')
                        return self.respond(buffer.getvalue(), mime='image/png')
                    if png.exists():
                        return self.respond(png.read_bytes(), mime='image/png')
                    if img.exists():
                        return self.respond(img.read_bytes(), mime='image/jpeg')
            except FileNotFoundError:
                pass
            return self.respond({'error': '票根暂不可用'}, 404)
        if url.path not in ('/', '/index.html', '/style.css', '/app.js', '/i18n.js') and not re.fullmatch(r'/assets/[a-z]+\.(webp|json)', url.path):
            return self.respond({'error': '页面不存在'}, 404)
        self.path = url.path
        return super().do_GET()

    def do_POST(self):
        if self.headers.get('Origin') and self.headers['Origin'] != f"http://{self.headers.get('Host')}":
            return self.respond({'error': '请求来源不匹配'}, 403)
        path = urlsplit(self.path).path
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 12_000_000:
                return self.respond({'error': '文件大小超出限制'}, 413)
            if path == '/api/tickets' and length < 10000:
                data = json.loads(self.rfile.read(length))
                _, city, lng, lat = PLACES[data['cityId']]
                result = score_answers(data['answers'])
                ticket = dict(id=secrets.token_hex(16), writeKey=secrets.token_hex(16),
                              city=city, lng=lng, lat=lat, **result)
                with LOCK:
                    write_record(ticket)
                return self.respond({**ticket, 'demo': DEMO, 'folderCapture': TD_FOLDER is not None}, 201)
            match = re.fullmatch(r'/api/(td-folder|td-image|image|join|capture)/([a-f0-9]{32})', path)
            if not match:
                return self.respond({'error': '页面不存在'}, 404)
            action, ticket = match.groups()
            with LOCK:
                record = self.get_record(ticket)
                if action == 'capture':
                    if not record.get('captureRequested'):
                        record['captureRequested'] = True
                        write_record(record)
                    return self.respond({'ok': True})
            if not secrets.compare_digest(self.headers.get('X-Ticket-Key', ''), record['writeKey']):
                return self.respond({'error': '票根凭证不匹配'}, 403)
            if action == 'td-folder':
                if TD_FOLDER is None:
                    return self.respond({'error': '未设置 TD 截图文件夹'}, 409)
                if not arm_capture(ticket):
                    return self.respond({'error': '正在等待上一张截图'}, 409)
                return self.respond({'ok': True})
            if action == 'td-image':
                if length > 1024:
                    raise ValueError
                data = json.loads(self.rfile.read(length))
                try:
                    save_ticket_png(ticket, fetch_td_png(data['filename']))
                except (ValueError, KeyError, OSError, TypeError, HTTPException, Image.DecompressionBombError) as error:
                    print(f'[归线 TD] 图片导入失败 {ticket}: {error}', flush=True)
                    return self.respond({'error': '无法读取或保存 TD 图片'}, 502)
                return self.respond({'ok': True})
            if action == 'image':
                data = self.rfile.read(length)
                if data.startswith(b'\x89PNG\r\n\x1a\n'):
                    save_ticket_png(ticket, data)
                    return self.respond({'ok': True})
                with Image.open(io.BytesIO(data)) as image:
                    if image.width * image.height > 25_000_000:
                        raise ValueError
                    image.thumbnail((2400, 2400))
                    buffer = io.BytesIO()
                    image.convert('RGB').save(buffer, 'JPEG', quality=93)
                with LOCK:
                    temp = PASSES / f'{ticket}.jpg.tmp'
                    temp.write_bytes(buffer.getvalue())
                    temp.replace(PASSES / f'{ticket}.jpg')
            else:
                with LOCK:
                    record = self.get_record(ticket)
                    record['joined'] = True
                    write_record(record)
            return self.respond({'ok': True})
        except (ValueError, KeyError, OSError, TypeError, HTTPException, Image.DecompressionBombError):
            return self.respond({'error': '暂时无法处理这次请求'}, 400)

    def log_message(self, *args):
        pass

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--host', default='0.0.0.0')
    parser.add_argument('--strictPort', action='store_true', help=argparse.SUPPRESS)
    parser.add_argument('--lan-ip', default=find_lan())
    parser.add_argument('--demo', action='store_true')
    parser.add_argument('--open-browser', action='store_true')
    parser.add_argument('--td-folder', type=Path)
    parser.add_argument('--pick-td-folder', action='store_true')
    args = parser.parse_args()
    TD_FOLDER = args.td_folder
    if args.pick_td_folder and TD_FOLDER is None:
        import tkinter as tk
        from tkinter.filedialog import askdirectory
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        location = askdirectory(title='请选择 TouchDesigner 保存 PNG 的文件夹', mustexist=True)
        root.destroy()
        if not location:
            raise SystemExit('未选择截图文件夹。')
        TD_FOLDER = Path(location)
    if TD_FOLDER is not None and not TD_FOLDER.is_dir():
        raise SystemExit('找不到 TD 截图文件夹。')
    ipaddress.IPv4Address(args.lan_ip)
    DEMO = args.demo
    if DEMO:
        PASSES = ROOT / 'records-demo'
    PUBLIC_BASE = f'http://{args.lan_ip}:{args.port}'
    PASSES.mkdir(exist_ok=True)
    try:
        server = ThreadingHTTPServer((args.host, args.port), partial(Handler, directory=str(ROOT)))
    except OSError as error:
        print(f'[归线] 无法启动端口 {args.port}。若旧版网站仍在运行，请关闭旧窗口后重试。\n{error}', flush=True)
        raise SystemExit(1)
    print(f'[归线] 自动出图版 | 本地 http://localhost:{args.port} | 手机 {PUBLIC_BASE}', flush=True)
    if args.open_browser:
        threading.Thread(target=webbrowser.open, args=(f'http://localhost:{args.port}/?build=td-image-8',), daemon=True).start()
    with server:
        server.serve_forever()
