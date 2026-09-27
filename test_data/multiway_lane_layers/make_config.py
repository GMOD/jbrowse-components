import json
import sys

src, out = sys.argv[1], sys.argv[2]
config = json.load(open(src))

def gc_uri(db):
    if db == 'hg38':
        return 'https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.gc5Base.bw'
    return f'https://hgdownload.soe.ucsc.edu/gbdb/{db}/bbi/gc5BaseBw/gc5Base.bw'

dbs = [a['name'] for a in config['assemblies']]
gc_ids = []
for db in dbs:
    track_id = f'{db}-gc5Base'
    gc_ids.append(track_id)
    config['tracks'].append({
        'type': 'QuantitativeTrack',
        'trackId': track_id,
        'name': f'{db} GC percent',
        'category': ['GC percent'],
        'assemblyNames': [db],
        'adapter': {'type': 'BigWigAdapter', 'uri': gc_uri(db)},
    })

for track in config['tracks']:
    if track['type'] == 'SyntenyTrack':
        for display in track.get('displays', []):
            if display['type'] == 'MultiWaySyntenyDisplay':
                display['laneLayers'] = [{
                    'name': 'GC %',
                    'tracks': gc_ids,
                    'height': 24,
                    'marks': [{'mark': 'bar', 'encoding': {'y': 'score'}}],
                }]
                display['height'] = 700

json.dump(config, open(out, 'w'), indent=2)
print(out, len(config['tracks']), 'tracks')
