"""Upload ticket display data to private Supabase Storage."""
import base64
import json
import os
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import Request, urlopen

PROJECT = 'https://esfodpqwhqoiznfccrmi.supabase.co'
PAGES = 'https://zshuang1009-arch.github.io/guiline-tickets/'
STORAGE = PROJECT + '/storage/v1'
BUCKET = 'guiline-tickets'
KEY = os.environ.get('GUILINE_STORAGE_KEY', '').strip()

def publish(record, image, mime):
    object_path = BUCKET + '/' + quote(record['id']) + '.json'
    body = {field: record[field] for field in ('city', 'lng', 'lat')}
    body['image'] = 'data:' + mime + ';base64,' + base64.b64encode(image).decode('ascii')
    headers = {'apikey': KEY, 'Content-Type': 'application/json'}
    if KEY.startswith('eyJ'):
        headers['Authorization'] = 'Bearer ' + KEY
    with urlopen(Request(STORAGE + '/object/' + object_path,
                         json.dumps(body).encode(), {**headers, 'x-upsert': 'true'}), timeout=20):
        pass
    with urlopen(Request(STORAGE + '/object/sign/' + object_path,
                         b'{"expiresIn":604800}', headers), timeout=15) as response:
        signed = json.load(response)['signedURL']
    path = urlsplit(signed)
    if path.path != '/object/sign/' + object_path or not path.query.startswith('token='):
        raise ValueError('Unexpected signed object URL')
    return PAGES + '#' + urlencode({'id': record['id'], 'token': path.query[6:]})
