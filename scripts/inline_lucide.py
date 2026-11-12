#!/usr/bin/env python3
"""Replace Lucide runtime placeholders with the same inline static SVG icons."""
from __future__ import annotations
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'node_modules' / 'lucide-static'
PAGES = [entry['path'] for entry in json.loads((ROOT / 'assets/js/pages-manifest.json').read_text())]
PAGE_FILES = [ROOT / page for page in PAGES] + [ROOT / 'site-templates' / page for page in PAGES]
ICON_PATTERN = re.compile(r'<i\b(?P<attrs>[^>]*\bdata-lucide="[^"]+"[^>]*)>\s*</i>', re.I)
NAME_PATTERN = re.compile(r'\bdata-lucide="([a-z0-9-]+)"')
CLASS_PATTERN = re.compile(r'\bclass="([^"]*)"')
STYLE_PATTERN = re.compile(r'\bstyle="([^"]*)"')
CACHE = {}


def svg_for(icon: str, css_class: str, style: str | None) -> str:
    if icon not in CACHE:
        options = [PACKAGE / 'icons' / f'{icon}.svg',
                   PACKAGE / 'icons' / 'svg' / f'{icon}.svg']
        options += list(PACKAGE.glob(f'**/{icon}.svg'))
        path = next((p for p in options if p.is_file()), None)
        if path is None:
            raise ValueError(f'Missing Lucide icon asset: {icon}')
        source = path.read_text(encoding='utf-8').strip()
        # Lucide static assets may begin with an XML declaration or comments.
        start = source.find('<svg')
        if start != -1:
            source = source[start:]
        if not source.startswith('<svg'):
            raise ValueError(f'Invalid SVG icon: {icon}')
        CACHE[icon] = source
    markup = CACHE[icon]
    head = re.search(r'<svg\b[^>]*>', markup)
    if not head:
        raise ValueError(f'SVG start tag missing: {icon}')
    attrs = head.group(0)
    classes = re.search(r'\bclass="([^"]*)"', attrs)
    merged = ((classes.group(1) + ' ') if classes else f'lucide lucide-{icon} ') + css_class
    if classes:
        attrs = attrs.replace(classes.group(0), f'class="{merged.strip()}"', 1)
    else:
        attrs = attrs[:-1] + f' class="{merged.strip()}">'
    attrs = attrs[:-1] + ' aria-hidden="true" focusable="false"'
    if style:
        attrs += f' style="{style}"'
    attrs += '>'
    return markup.replace(head.group(0), attrs, 1)


def replace(match: re.Match) -> str:
    attrs = match.group('attrs')
    name = NAME_PATTERN.search(attrs)
    if not name:
        return match.group(0)
    css_class = CLASS_PATTERN.search(attrs)
    style = STYLE_PATTERN.search(attrs)
    return svg_for(name.group(1), css_class.group(1) if css_class else '',
                   style.group(1) if style else None)


def main():
    total = 0
    for path in PAGE_FILES:
        text = path.read_text(encoding='utf-8')
        result, count = ICON_PATTERN.subn(replace, text)
        total += count
        if count:
            path.write_text(result, encoding='utf-8')
        if 'unpkg.com/lucide@' in result:
            raise ValueError(f'External Lucide still included: {path}')
    print(f'Pre-rendered {total} Lucide SVG instances from {len(CACHE)} unique icons.')
    if total < 600:
        raise ValueError('Too few icons converted; expected all fourteen website pages.')


if __name__ == '__main__':
    main()
