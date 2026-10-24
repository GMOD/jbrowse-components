import { DEFAULT_SHARE_URL, resolveShareUrl } from './defaultShareUrl.ts'

const page = 'https://example.org/jb2/index.html#config=c.json'

test.each([
  ['no config', undefined, DEFAULT_SHARE_URL],
  ['no shareURL', { configuration: {} }, DEFAULT_SHARE_URL],
  [
    'a non-string shareURL',
    { configuration: { shareURL: 5 } },
    DEFAULT_SHARE_URL,
  ],
  [
    'an absolute shareURL',
    { configuration: { shareURL: 'https://s.example/api/' } },
    'https://s.example/api/',
  ],
  [
    'a relative shareURL, against the page',
    { configuration: { shareURL: 'api/' } },
    'https://example.org/jb2/api/',
  ],
  // the page's directory, not `…/index.html`, which an appended endpoint would
  // turn into `…/index.html/load`
  [
    'an empty shareURL, as the page itself',
    { configuration: { shareURL: '' } },
    'https://example.org/jb2/',
  ],
])('%s', (_name, config, expected) => {
  expect(resolveShareUrl(config, page)).toBe(expected)
})
