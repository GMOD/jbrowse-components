import { jbrowseUrl } from './url.ts'

const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'hg38',
      loc: 'chr1:1,000-2,000',
      tracks: ['a&b'],
    },
  ],
}

// The parameters travel in the fragment, so this reads them from there.
const params = (url: string) => new URLSearchParams(new URL(url).hash.slice(1))

// The round trip a browser actually performs: parse the fragment, read the
// param (which decodes it once), strip the prefix, parse the JSON. A
// double-encoded spec passes an eyeball check on the URL and fails here.
function readSession(url: string) {
  return JSON.parse(
    params(url)
      .get('session')!
      .replace(/^spec-/, ''),
  ) as unknown
}

test('the spec survives the round trip', () => {
  expect(readSession(jbrowseUrl({ hub: 'hg38', spec }))).toEqual(spec)
})

// "Export session..." writes `{ session: {...} }`, which is what `json-` reads;
// the bare snapshot inside it is accepted too, and wrapped the same way
test.each([
  ['the exported document', { session: { name: 'saved', views: [] } }],
  ['the snapshot inside it', { name: 'saved', views: [] }],
])('a saved session opens as json-, from %s', (_name, session) => {
  const value = params(jbrowseUrl({ hub: 'hg38', session })).get('session')!
  expect(JSON.parse(value.replace(/^json-/, ''))).toEqual({
    session: { name: 'saved', views: [] },
  })
})

test('a spec and a saved session together are refused', () => {
  expect(() =>
    jbrowseUrl({ hub: 'hg38', spec, session: { views: [] } }),
  ).toThrow('pass a session spec or a saved session, not both')
})

test('a hub becomes its genomes.jbrowse.org config URL and names the assembly', () => {
  const url = jbrowseUrl({ hub: 'hg38', loc: 'BRCA1' })
  expect(params(url).get('config')).toBe(
    'https://jbrowse.org/ucsc/hg38/config.json',
  )
  expect(params(url).get('assembly')).toBe('hg38')
  expect(url.startsWith('https://jbrowse.org/code/jb2/latest/#')).toBe(true)
})

test('tracks join into one comma-separated parameter', () => {
  const url = jbrowseUrl({ hub: 'hg38', tracks: ['a', 'b'] })
  expect(params(url).get('tracks')).toBe('a,b')
})

test('a spec carries the config and nothing the spec already says', () => {
  expect(Object.fromEntries(params(jbrowseUrl({ hub: 'hg38', spec })))).toEqual(
    {
      config: 'https://jbrowse.org/ucsc/hg38/config.json',
      session: expect.stringMatching(/^spec-\{/),
    },
  )
})

// The URL can carry only one of them, and the session gate used to wait for
// the dropped --track, timing out on a track the config does define.
test.each([
  ['assembly', { assembly: 'hg38' }],
  ['loc', { loc: 'BRCA1' }],
  ['tracks', { tracks: ['a'] }],
])('a spec refuses %s beside it', (_name, extra) => {
  expect(() => jbrowseUrl({ hub: 'hg38', spec, ...extra })).toThrow(
    'cannot be combined with assembly, loc or tracks',
  )
})

test('an explicit config wins over a hub, which still names the assembly', () => {
  const url = jbrowseUrl({ hub: 'hg38', config: 'https://x.test/config.json' })
  expect(Object.fromEntries(params(url))).toEqual({
    config: 'https://x.test/config.json',
    assembly: 'hg38',
  })
})

test('instance selects the deployment', () => {
  const url = jbrowseUrl({ instance: 'http://localhost:3000/', hub: 'hg38' })
  expect(url.startsWith('http://localhost:3000/#')).toBe(true)
})

test('no config and no session yields the bare instance', () => {
  expect(jbrowseUrl({})).toBe('https://jbrowse.org/code/jb2/latest/')
})

test.each([
  [
    'a directory without its slash gains one',
    'https://x.org/jb2/v4.0.0',
    'https://x.org/jb2/v4.0.0/',
  ],
  ['an origin is its root', 'http://localhost:3000', 'http://localhost:3000/'],
  [
    'a page is left alone',
    'https://x.org/jb2/index.html',
    'https://x.org/jb2/index.html',
  ],
])('%s', (_name, instance, expected) => {
  expect(jbrowseUrl({ instance })).toBe(expected)
})
