#!/usr/bin/env python3
"""Key-free official RSS/Atom + GDELT collection with per-source failure isolation."""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import html
import json
import os
from pathlib import Path
from urllib.parse import urlencode, urljoin, urlparse, urlunparse, parse_qsl
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

OUT = Path(os.getenv('NEWS_OUTPUT', 'data/news-feed.json'))
CONFIG = Path(os.getenv('NEWS_SOURCES', 'data/news-sources.json'))
MAX_BYTES = 2_000_000


def timestamp():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def date_iso(value):
    if not value:
        return None
    for parse in (lambda s: datetime.fromisoformat(s.replace('Z', '+00:00')),
                  lambda s: datetime.strptime(s, '%Y%m%dT%H%M%SZ'), parsedate_to_datetime):
        try:
            d = parse(str(value))
            return d.replace(tzinfo=d.tzinfo or timezone.utc).astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
        except (ValueError, TypeError, OverflowError):
            pass
    return None


def safe_url(value):
    try:
        u = urlparse(str(value))
        if u.scheme not in ('http', 'https') or not u.hostname:
            return ''
        params = sorted((k, v) for k, v in parse_qsl(u.query, keep_blank_values=True)
                        if not k.lower().startswith('utm_') and k.lower() not in ('fbclid', 'gclid'))
        return urlunparse((u.scheme, u.netloc, u.path, u.params, urlencode(params), ''))
    except ValueError:
        return ''


def clean(raw, source):
    title = html.unescape(str(raw.get('title') or '')).strip()[:500]
    url = safe_url(raw.get('url'))
    if not title or not url:
        return None
    return {'title': title, 'url': url, 'domain': urlparse(url).hostname,
            'sourceId': source['id'], 'source': source['name'],
            'publishedAt': date_iso(raw.get('publishedAt') or raw.get('seendate')), 'category': 'economy'}


def parse_feed(xml, source):
    doc = ET.fromstring(xml)
    rows = []
    for node in doc.iter():
        if node.tag.split('}')[-1] not in ('item', 'entry'):
            continue
        fields, links = {}, []
        for child in node:
            tag = child.tag.split('}')[-1]
            fields[tag] = ''.join(child.itertext()).strip()
            if tag == 'link' and child.get('rel', 'alternate') == 'alternate':
                links.append(child.get('href') or fields[tag])
        rows.append({'title': fields.get('title'),
                     'url': urljoin(source['url'], links[0] if links else fields.get('guid', '')),
                     'publishedAt': fields.get('pubDate') or fields.get('published') or fields.get('updated') or fields.get('date')})
    return rows[:100]


def fetch_source(source):
    url = source['url']
    if source['kind'] == 'gdelt':
        url += '?' + urlencode({'query': '("US economy" OR "Federal Reserve" OR inflation OR tariffs OR "oil prices") sourcelang:english',
                                'mode': 'artlist', 'format': 'json', 'timespan': '24h', 'maxrecords': 75, 'sort': 'datedesc'})
    req = Request(url, headers={'User-Agent': 'MACROSCOPE/10.0 (public economic release reader)'})
    with urlopen(req, timeout=15) as response:
        payload = response.read(MAX_BYTES + 1)
    if len(payload) > MAX_BYTES:
        raise ValueError('Feed exceeds 2 MB')
    if source['kind'] == 'gdelt':
        rows = json.loads(payload).get('articles')
        if not isinstance(rows, list):
            raise ValueError('Invalid GDELT article list')
    else:
        rows = parse_feed(payload, source)
    return [item for row in rows if (item := clean(row, source))]


def collect(sources, old, fetcher=fetch_source):
    now = timestamp()
    items, statuses = [], {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(fetcher, source): source for source in sources}
        for future in as_completed(futures):
            source = futures[future]
            previous = [x for x in old.get('items', []) if x.get('sourceId') == source['id']]
            last_success = old.get('sourceStatus', {}).get(source['id'], {}).get('lastSuccess')
            try:
                fresh = future.result()
                usable = fresh or previous
                items.extend(usable)
                statuses[source['id']] = {'name': source['name'], 'url': source['url'], 'ok': True,
                    'count': len(usable), 'fallback': not bool(fresh), 'checkedAt': now,
                    'lastSuccess': now if fresh else last_success}
            except Exception as exc:
                items.extend(previous)
                statuses[source['id']] = {'name': source['name'], 'url': source['url'], 'ok': False,
                    'count': len(previous), 'fallback': True, 'checkedAt': now,
                    'lastSuccess': last_success, 'error': str(exc)[:180]}
    items.extend(x for x in old.get('items', []) if not x.get('sourceId'))
    seen, dedup = set(), []
    for item in sorted(items, key=lambda x: x.get('publishedAt') or '', reverse=True):
        key = safe_url(item.get('url'))
        if key and key not in seen:
            seen.add(key)
            dedup.append({**item, 'url': key})
    refreshed = any(x['ok'] and not x['fallback'] for x in statuses.values())
    return {'schemaVersion': 2, 'generatedAt': now if refreshed else old.get('generatedAt'),
            'checkedAt': now, 'provider': 'Official releases and GDELT',
            'sourceStatus': statuses, 'items': dedup[:250]}


def main():
    old = {}
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text())
        except (ValueError, OSError):
            pass
    sources = json.loads(CONFIG.read_text())['sources']
    result = collect(sources, old)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUT.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    temporary.replace(OUT)
    print(f'Wrote {len(result["items"])} articles; {sum(s["ok"] for s in result["sourceStatus"].values())}/{len(sources)} sources available')


if __name__ == '__main__':
    main()
