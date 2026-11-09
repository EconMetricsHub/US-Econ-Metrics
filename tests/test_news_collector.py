import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('collector', Path(__file__).parents[1] / 'scripts/update_news.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class CollectorTest(unittest.TestCase):
    def test_rss_and_atom(self):
        source = {'id': 'feed', 'name': 'Feed', 'url': 'https://example.org/rss'}
        rss = '<rss><channel><item><title>GDP &amp; prices</title><link>https://example.org/gdp</link><pubDate>Mon, 09 Nov 2026 12:00:00 GMT</pubDate></item></channel></rss>'
        atom = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Jobs</title><link href="/jobs"/><updated>2026-11-09T12:00:00Z</updated></entry></feed>'
        self.assertEqual(m.clean(m.parse_feed(rss, source)[0], source)['publishedAt'], '2026-11-09T12:00:00Z')
        self.assertEqual(m.parse_feed(atom, source)[0]['url'], 'https://example.org/jobs')

    def test_partial_failure_preserves_previous_source(self):
        sources = [{'id': x, 'name': x, 'url': 'https://example.org/'+x} for x in ['ok', 'fail']]
        previous = {'title': 'Previous', 'url': 'https://example.org/old', 'sourceId': 'fail', 'publishedAt': '2026-11-01T12:00:00Z'}
        old = {'generatedAt': '2026-11-01T12:00:00Z', 'items': [previous]}
        def fetch(source):
            if source['id'] == 'fail':
                raise RuntimeError('Unavailable')
            return [{'title': 'Fresh', 'url': 'https://example.org/new', 'sourceId': 'ok', 'publishedAt': '2026-11-09T12:00:00Z'}]
        result = m.collect(sources, old, fetch)
        self.assertEqual(len(result['items']), 2)
        self.assertFalse(result['sourceStatus']['fail']['ok'])
        self.assertIn(previous, result['items'])

    def test_total_failure_keeps_old_generated_timestamp(self):
        sources = [{'id': 'fail', 'name': 'fail', 'url': 'https://example.org/rss'}]
        old = {'generatedAt': '2026-11-01T12:00:00Z', 'items': []}
        def fail(source):
            raise RuntimeError('Offline')
        self.assertEqual(m.collect(sources, old, fail)['generatedAt'], old['generatedAt'])
        self.assertEqual(m.collect(sources, old, lambda s: [])['generatedAt'], old['generatedAt'])

    def test_url_safety(self):
        self.assertEqual(m.safe_url('javascript:alert(1)'), '')
        self.assertEqual(m.safe_url('https://example.org/a?utm_source=x#top'), 'https://example.org/a')


if __name__ == '__main__':
    unittest.main()
