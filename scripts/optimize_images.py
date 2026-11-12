#!/usr/bin/env python3
"""Reencode display images to high-quality WebP without modifying the originals."""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DIRECTORIES = [ROOT / 'generated', ROOT / 'assets' / 'images' / 'before-after']


def convert_file(path: Path) -> None:
    target = path.with_suffix('.webp')
    with Image.open(path) as image:
        image = ImageOps.exif_transpose(image)
        if image.mode not in ('RGB', 'RGBA'):
            image = image.convert('RGBA' if 'transparency' in image.info else 'RGB')
        if max(image.size) > 1440:
            image.thumbnail((1440, 1440), Image.Resampling.LANCZOS)
        image.save(target, format='WEBP', quality=88, method=6)
    original_size = path.stat().st_size
    optimized_size = target.stat().st_size
    print(f'{path.relative_to(ROOT)} {original_size:,} B -> '
          f'{target.relative_to(ROOT)} {optimized_size:,} B '
          f'({100 * optimized_size / original_size:.1f}%)')


def main() -> None:
    for directory in DIRECTORIES:
        for path in sorted(directory.glob('*.png')):
            convert_file(path)


if __name__ == '__main__':
    main()
