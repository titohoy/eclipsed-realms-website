"""Build small browser assets from the verified, private survey. Never alters the game."""
import hashlib, json, sys, struct
from pathlib import Path
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]; target=root/'dist/assets/cartography'
meta=json.loads((root/'content/atlas/terrain.json').read_text())
height=Path(sys.argv[1]); data=height.read_bytes()
if hashlib.sha256(data).hexdigest()!=meta['height16PngSha256']: raise ValueError('Review the recovered source heightmap before deriving new relief.')
a=np.asarray(Image.open(height)); assert a.shape==(4033,4033)
a[::8,::8].astype('<u2').tofile(target/'relief.bin')
src=next(r for r in meta['overlays'] if 'foliage_positions' in r['file']); foliage=Path(src['file']).read_bytes()
assert hashlib.sha256(foliage).hexdigest()==src['sha256']
trees=next(v for k,v in json.loads(foliage).items() if k.endswith('/SM_Tree01'))
cells=set(); output=bytearray()
for x,y,_ in sorted(trees):
    cell=(int(x//1000), int(y//1000))
    if cell in cells or max(abs(x),abs(y))>=201600: continue
    cells.add(cell)
    output+=struct.pack('<hh',round(x/10),round(y/10))
(target/'groves.bin').write_bytes(output)
print(len(cells),'surveyed tree positions; 505 × 505 terrain samples')
