"""Paste into the callbacks DAT of a TouchDesigner Web Server DAT."""
import json
import tempfile
import time
from pathlib import Path
from urllib.request import Request, urlopen

# Point to the final TOP of your three-dimensional scene.
OUTPUT_TOP = '/project1/out1'
# Give the scene about one second at 60 fps to react to the emotion weights.
SETTLE_FRAMES = 60
UPLOAD_BASE = 'http://127.0.0.1:8000'
pending = {}
finished = set()
latest = None

EMOTION_KEYS = ('sadness', 'joy', 'regret', 'rejection', 'nostalgia', 'attachment')
PAD_KEYS = ('pleasure', 'arousal', 'dominance')

def update_weights(web_server, scores, pad=None):
    target = web_server.parent()
    table = target.op('emotion_weights') or target.create(tableDAT, 'emotion_weights')
    table.clear()
    table.appendRow(EMOTION_KEYS + PAD_KEYS)
    table.appendRow([str(scores.get(key, 0) / 100) for key in EMOTION_KEYS]
                    + [str((pad or {}).get(axis, 0)) for axis in PAD_KEYS])

def onWebSocketReceiveText(webServerDAT, client, data):
    global latest
    try:
        message = json.loads(data)
        if message.get('type') != 'emotion_result':
            return
        if 'emotions' in message:
            entries = message['emotions']
            if len(entries) != 3:
                raise ValueError('Expected three emotions')
            scores = {entry['name']: entry['score'] for entry in entries}
            if len(scores) != 3 or not scores.keys() <= set(EMOTION_KEYS):
                raise ValueError('Invalid or duplicate emotion names')
            if any(type(score) is not int or not 0 <= score <= 100 for score in scores.values()):
                raise ValueError('Invalid emotion scores')
            update_weights(webServerDAT, scores)
            return
        ticket_id = message['ticketId']
        if ticket_id in pending or ticket_id in finished:
            return
        latest = ticket_id
        pending[ticket_id] = time.monotonic() + 600
        update_weights(webServerDAT, message['scores'], message.get('pad'))
        run('args[0](args[1])', wait_for_scan, message, delayFrames=SETTLE_FRAMES)
    except (ValueError, KeyError, TypeError) as error:
        print('归线消息格式错误', error)

def wait_for_scan(message):
    ticket_id = message['ticketId']
    if ticket_id != latest or time.monotonic() > pending.get(ticket_id, 0):
        pending.pop(ticket_id, None)
        return
    request = Request(f'{UPLOAD_BASE}/api/capture/{ticket_id}',
                      headers={'X-Ticket-Key': message['uploadKey']})
    try:
        with urlopen(request, timeout=1) as response:
            requested = json.load(response)['requested']
        if requested and capture(message):
            return
    except OSError:
        pass
    run('args[0](args[1])', wait_for_scan, message, delayFrames=30)

def capture(message):
    ticket_id = message['ticketId']
    try:
        top = op(OUTPUT_TOP)
        if top is None:
            raise RuntimeError('请将 OUTPUT_TOP 设为最终画面的 TOP 路径')
        with tempfile.TemporaryDirectory() as directory:
            png = Path(directory) / 'guiline.png'
            top.save(str(png))
            request = Request(f'{UPLOAD_BASE}/api/image/{ticket_id}', data=png.read_bytes(),
                              headers={'X-Ticket-Key': message['uploadKey'], 'Content-Type': 'image/png'})
            with urlopen(request, timeout=3) as response:
                if response.status == 200:
                    finished.add(ticket_id)
                    pending.pop(ticket_id, None)
                    return True
    except Exception as error:
        print('归线截图回传失败', error)
    return False
