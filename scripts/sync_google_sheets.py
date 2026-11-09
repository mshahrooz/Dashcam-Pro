#!/usr/bin/env python3
"""Turn the editable Google Sheet into static website content without Apps Script."""
import csv
import html
import io
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

SHEET_ID = '1_vfrLWtFR7sDy3rIZfCDvFAVbYjRanDsHBKZNcteflQ'
TABS = {
    'Website Text': 1530926478,
    'Products': 432746905,
    'Services': 1051518928,
    'Reviews': 1962525606,
    'Articles': 1798363659,
    'Showcase': 1819631290,
}
ROOT = Path(__file__).resolve().parents[1]


def read_tab(tab, gid):
    url = ('https://docs.google.com/spreadsheets/d/' + SHEET_ID +
           '/export?format=csv&gid=' + str(gid))
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; DashcamProSheetSync/1.0)',
        'Accept': 'text/csv,*/*',
    })
    error = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                response_type = response.headers.get('Content-Type', '')
                body = response.read(2_000_000).decode('utf-8-sig')
            if ('<html' in body[:512].lower() or '<!doctype html' in body[:512].lower()
                    or 'text/html' in response_type.lower()):
                raise RuntimeError('Google returned an HTML/sign-in page instead of CSV. '
                                   'Enable Anyone with the link -> Viewer on the content Sheet.')
            rows = list(csv.reader(io.StringIO(body)))
            if len(rows) < 5:
                raise RuntimeError('CSV is missing the fourth-row header or its content.')
            headers = [item.strip() for item in rows[3]]
            expected = {'Website Text': 'Key', 'Products': 'ID', 'Services': 'ID',
                        'Reviews': 'ID', 'Articles': 'ID', 'Showcase': 'Vehicle Brand'}[tab]
            if not headers or headers[0] != expected:
                raise RuntimeError(f'Unexpected CSV layout for {tab}: {headers[:4]}')
            return [dict(zip(headers, row)) for row in rows[4:]
                    if any(str(value).strip() for value in row)]
        except (OSError, urllib.error.URLError) as exc:
            error = exc
            if attempt < 2:
                time.sleep(3 * (attempt + 1))
        except RuntimeError:
            raise
    raise RuntimeError(f'Failed downloading tab {tab}: {error}')


def clean(value):
    return str(value or '').strip()


def published(value):
    return clean(value).lower() not in {'false', 'no', '0', 'hide', 'hidden', 'draft', 'off'}


def split_pipes(value):
    return [part.strip() for part in clean(value).split('|') if part.strip()]


def number(value, default=0):
    try:
        return float(clean(value).replace('$', '').replace(',', ''))
    except ValueError:
        return default


def optional_number(value):
    return None if not clean(value) else number(value, None)


def safe_image(value):
    value = clean(value)
    if value.startswith('https://') or re.fullmatch(r'(?:\./)?generated/[A-Za-z0-9._/-]+', value):
        return value
    return 'generated/hero.png'


def safe_link(value):
    value = clean(value)
    return value if re.match(r'^(#|https://|mailto:|tel:)', value, re.I) else '#contact'


def build_payload(data):
    site = {clean(r.get('Key')): str(r.get('Value', ''))
            for r in data['Website Text'] if clean(r.get('Key'))}
    products = [{
        'id': clean(r.get('ID')),
        'name': clean(r.get('Product Name')),
        'brand': clean(r.get('Brand')),
        'category': clean(r.get('Category')),
        'price': number(r.get('Price (CAD)')),
        'oldPrice': optional_number(r.get('Compare-at Price (CAD)')),
        'rating': number(r.get('Rating (1–5)')),
        'reviews': number(r.get('Review Count')),
        'blurb': clean(r.get('Description')),
        'tags': split_pipes(r.get('Tags (use | separator)')),
        'badges': split_pipes(r.get('Badges (use | separator)')),
        'list': split_pipes(r.get('Lists (top|best|new)')),
        'image': safe_image(r.get('Image Path')),
    } for r in data['Products'] if published(r.get('Published')) and clean(r.get('ID'))]
    services = [{
        'id': clean(r.get('ID')),
        'published': published(r.get('Published')),
        'title': clean(r.get('Service Title')),
        'description': clean(r.get('Description')),
        'linkText': clean(r.get('Link Text')),
        'linkUrl': safe_link(r.get('Link URL')),
    } for r in data['Services'] if clean(r.get('ID'))]
    reviews = [{
        'id': clean(r.get('ID')),
        'published': published(r.get('Published')),
        'quote': clean(r.get('Customer Quote')),
        'name': clean(r.get('Reviewer Name')),
        'role': clean(r.get('Reviewer Role / Location')),
        'rating': number(r.get('Rating'), 5),
    } for r in data['Reviews'] if clean(r.get('ID'))]
    articles = [{
        'id': clean(r.get('ID')),
        'published': published(r.get('Published')),
        'title': clean(r.get('Article Title')),
        'summary': clean(r.get('Summary')),
        'imagePath': safe_image(r.get('Image Path')),
        'linkText': clean(r.get('Link Text')),
        'linkUrl': safe_link(r.get('Link URL')),
    } for r in data['Articles'] if clean(r.get('ID'))]
    cars = [clean(r.get('Vehicle Brand')) for r in data['Showcase']
            if published(r.get('Published')) and clean(r.get('Vehicle Brand'))]
    if len(site) < 50 or not products or not services:
        raise RuntimeError('Missing critical content; refusing to replace the deployed site.')
    return {'ok': True, 'siteContent': site, 'products': products, 'services': services,
            'reviews': reviews, 'articles': articles, 'showcaseCars': cars}


def bake_seo_html(html_text, site):
    """Update SEO metadata in the HTML artifact, not only after JavaScript runs."""
    if 'data-cms="meta_title"' in html_text and site.get('meta_title'):
        html_text = re.sub(r'(<title\s+data-cms="meta_title">).*?(</title>)',
                           lambda m: m.group(1) + html.escape(site['meta_title']) + m.group(2),
                           html_text, count=1, flags=re.S | re.I)
    for key in ('meta_description', 'meta_keywords', 'og_title', 'og_description',
                'twitter_title', 'twitter_description'):
        if not site.get(key):
            continue
        regex = re.compile(r'<meta\b[^>]*\bdata-cms="' + re.escape(key) + r'"[^>]*>', re.I)
        def replace_tag(m):
            return re.sub(r'\bcontent="[^"]*"',
                          lambda a: 'content="' + html.escape(site[key], quote=True) + '"',
                          m.group(0), count=1, flags=re.I)
        html_text = regex.sub(replace_tag, html_text, count=1)
    return html_text


def main():
    data = {tab: read_tab(tab, gid) for tab, gid in TABS.items()}
    payload = build_payload(data)
    (ROOT / 'cms-data.json').write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    index = ROOT / 'index.html'
    index.write_text(bake_seo_html(index.read_text(encoding='utf-8'),
                                  payload['siteContent']), encoding='utf-8')
    print(f'Synced {len(payload["siteContent"])} fields, {len(payload["products"])} products, '
          f'{len(payload["services"])} services and {len(payload["articles"])} articles.')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'Google Sheets sync FAILED: {exc}', file=sys.stderr)
        sys.exit(1)
