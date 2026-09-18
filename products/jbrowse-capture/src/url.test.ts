import { jbrowseUrl } from './url.ts'

const session = {
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

test('the session survives the round trip', () => {
  expect(readSession(jbrowseUrl({ hub: 'hg38', session }))).toEqual(session)
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

test('a session carries the config and nothing the spec already says', () => {
  expect(
    Object.fromEntries(params(jbrowseUrl({ hub: 'hg38', session }))),
  ).toEqual({
    config: 'https://jbrowse.org/ucsc/hg38/config.json',
    session: expect.stringMatching(/^spec-\{/),
  })
})

// The URL can carry only one of them, and the session gate used to wait for
// the dropped --track, timing out on a track the config does define.
test.each([
  ['assembly', { assembly: 'hg38' }],
  ['loc', { loc: 'BRCA1' }],
  ['tracks', { tracks: ['a'] }],
])('a session refuses %s beside it', (_name, extra) => {
  expect(() => jbrowseUrl({ hub: 'hg38', session, ...extra })).toThrow(
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
