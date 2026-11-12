#!/usr/bin/env python3
"""Generate small WebP variants and responsive srcset attributes for site images."""
import html
import json
import re
from pathlib import Path

from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
PATHS=[r['path'] for r in json.loads((ROOT/'assets/js/pages-manifest.json').read_text())]
DIRS=[ROOT/'generated',ROOT/'assets'/'images'/'before-after']
IMG=re.compile(r'<img\b[^>]*>',re.I)
SRC=re.compile(r'\bsrc="([^"]+\.webp)"',re.I)
WIDTHS=(480,768)
srcset_map={}

for directory in DIRS:
    for source in sorted(directory.glob('*.webp')):
        if re.search(r'-(480|768)\.webp$',source.name):
            continue
        with Image.open(source) as im:
            w,h=im.size
            options=[]
            for new_width in WIDTHS:
                if w<=new_width:
                    continue
                filename=source.with_name(f'{source.stem}-{new_width}.webp')
                if not filename.exists():
                    new_height=round(h*new_width/w)
                    resized=im.resize((new_width,new_height),Image.Resampling.LANCZOS)
                    resized.save(filename,format='WEBP',quality=86,method=6)
                options.append((new_width,filename))
            options.append((w,source))
            srcset_map[source.resolve()]=sorted(options)

def optimize_tag(m,page):
    tag=m.group(0)
    if 'srcset=' in tag:
        return tag
    src=SRC.search(tag)
    if not src:
        return tag
    url=html.unescape(src.group(1))
    path=(ROOT/Path(page).parent/url).resolve()
    variants=srcset_map.get(path)
    if not variants or len(variants)<2:
        return tag
    base_url=url.rsplit('/',1)[0]+'/' if '/' in url else ''
    srcset=', '.join(f'{base_url}{asset.name} {width}w' for width,asset in variants)
    if 'ba-before-img' in tag or 'ba-after-img' in tag:
        sizes='(max-width: 767px) calc(100vw - 32px), 600px'
    elif 'aspect-[16/10]' in tag or 'aspect-[4/3]' in tag:
        sizes='(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) 46vw, 360px'
    else:
        sizes='(max-width: 767px) calc(100vw - 32px), (max-width: 1279px) 50vw, 660px'
    return tag[:-1] + f' srcset="{srcset}" sizes="{sizes}">'

total=0
for page in PATHS:
    for destination in (ROOT/page,ROOT/'site-templates'/page):
        s=destination.read_text()
        improved,n=IMG.subn(lambda m:optimize_tag(m,page),s)
        total+=n
        destination.write_text(improved)
print('Responsive WebP variants for',len(srcset_map),'images; inspected',total,'HTML img elements.')
