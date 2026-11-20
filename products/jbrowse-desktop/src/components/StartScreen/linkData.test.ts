import { assertReadsNoLocalFiles, linkData } from './linkData.ts'

const page = 'https://jbrowse.org/code/jb2/main/'

const track = (location: object) => ({
  sessionTracks: [
    {
      type: 'AlignmentsTrack',
      trackId: 't',
      adapter: { type: 'BamAdapter', bamLocation: location },
    },
  ],
})

test.each([
  ['a localPath', { localPath: '/home/me/.ssh/id_rsa' }],
  ['a file: uri', { uri: 'file:///etc/passwd' }],
  // on Windows, opening this connects to the host and offers it credentials
  ['a network share', { uri: 'file://attacker.example/share/x.bam' }],
  ['a Windows path', { uri: 'C:\\Users\\me\\x.bam' }],
  [
    'a file: base under a relative uri',
    { uri: 'x.bam', baseUri: 'file:///home/me/' },
  ],
])('a link naming %s is refused', (_, location) => {
  expect(() => linkData(track(location), page)).toThrow(
    /names a file on this computer/,
  )
})

test('a bare file: string is refused wherever it sits', () => {
  expect(() => {
    assertReadsNoLocalFiles({
      adapter: { type: 'MultiWiggleAdapter', bigWigs: ['file:///a.bw'] },
    })
  }).toThrow(/file:\/\/\/a\.bw/)
})

// JBrowse Web resolves a spec's files against its page, so a path that would
// be local with no base is a file on that server
test("a spec's relative and rooted files resolve against the link's page", () => {
  const data = linkData(track({ uri: '/data/x.bam' }), page)
  expect(data.sessionTracks[0]!.adapter.bamLocation).toEqual({
    uri: '/data/x.bam',
    baseUri: page,
  })
})

test('remote data passes', () => {
  expect(() =>
    linkData(track({ uri: 'https://example.com/x.bam' }), page),
  ).not.toThrow()
})
