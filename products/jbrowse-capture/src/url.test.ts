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

// The round trip a browser actually performs: parse the query, read the param
// (which decodes it once), strip the prefix, parse the JSON. A double-encoded
// spec passes an eyeball check on the URL and fails here.
function readSession(url: string) {
  const value = new URL(url).searchParams.get('session')!
  return JSON.parse(value.replace(/^spec-/, '')) as unknown
}

const params = (url: string) =>
  Object.fromEntries(new URL(url).searchParams.entries())

test('the session survives the query-string round trip', () => {
  expect(readSession(jbrowseUrl({ hub: 'hg38', session }))).toEqual(session)
})

test('a hub becomes its genomes.jbrowse.org config URL and names the assembly', () => {
  const url = new URL(jbrowseUrl({ hub: 'hg38', loc: 'BRCA1' }))
  expect(url.searchParams.get('config')).toBe(
    'https://jbrowse.org/ucsc/hg38/config.json',
  )
  expect(url.searchParams.get('assembly')).toBe('hg38')
  expect(url.origin + url.pathname).toBe('https://jbrowse.org/code/jb2/latest/')
})

test('tracks join into one comma-separated parameter', () => {
  const url = jbrowseUrl({ hub: 'hg38', tracks: ['a', 'b'] })
  expect(new URL(url).searchParams.get('tracks')).toBe('a,b')
})

test('a session suppresses the url parameters it would fight with', () => {
  const url = jbrowseUrl({ hub: 'hg38', loc: 'BRCA1', tracks: ['a'], session })
  expect(params(url)).toEqual({
    config: 'https://jbrowse.org/ucsc/hg38/config.json',
    session: expect.stringMatching(/^spec-\{/),
  })
})

test('an explicit config wins over a hub, which still names the assembly', () => {
  const url = jbrowseUrl({ hub: 'hg38', config: 'https://x.test/config.json' })
  expect(params(url)).toEqual({
    config: 'https://x.test/config.json',
    assembly: 'hg38',
  })
})

test('instance selects the deployment', () => {
  const url = jbrowseUrl({ instance: 'http://localhost:3000/', hub: 'hg38' })
  expect(url.startsWith('http://localhost:3000/?')).toBe(true)
})

test('no config and no session yields the bare instance', () => {
  expect(jbrowseUrl({})).toBe('https://jbrowse.org/code/jb2/latest/')
})
