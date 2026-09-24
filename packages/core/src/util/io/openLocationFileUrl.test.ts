import { openLocation } from './index.ts'

// GenericFilehandle does not declare it, but every implementation carries the
// key it was opened under, which is what says which branch openLocation took
const keyOf = (f: unknown) => (f as { filename: string }).filename

// A file: URI is how every desktop shorthand arrives: a config.json opened from
// disk stamps its own directory as the baseUri, so the adapter's `uri` and each
// sibling the shorthand derives from it resolve to file: here. Reading them as a
// local path is what keeps them on the code path that can open a local file.
test('a file: uri opens as a local path, resolved through its baseUri', () => {
  const direct = openLocation({
    uri: 'file:///data/proj/reads.bam',
    locationType: 'UriLocation',
  })
  const viaBase = openLocation({
    uri: 'reads.bam',
    baseUri: 'file:///data/proj/',
    locationType: 'UriLocation',
  })
  const asPath = openLocation({
    localPath: '/data/proj/reads.bam',
    locationType: 'LocalPathLocation',
  })
  expect(keyOf(direct)).toBe(keyOf(asPath))
  expect(keyOf(viaBase)).toBe(keyOf(asPath))
})

test('a percent-encoded file: uri decodes to the path it names', () => {
  const encoded = openLocation({
    uri: 'file:///data/my%20reads/a%2Bb.bam',
    locationType: 'UriLocation',
  })
  const asPath = openLocation({
    localPath: '/data/my reads/a+b.bam',
    locationType: 'LocalPathLocation',
  })
  expect(keyOf(encoded)).toBe(keyOf(asPath))
})

// Desktop gives a config opened from \\server\share\proj a baseUri of
// file://server/share/proj/; reading only the pathname dropped the server and
// looked for /share/proj/reads.bam on the local disk.
test('a file: uri naming a network share keeps its server', () => {
  const share = openLocation({
    uri: 'reads.bam',
    baseUri: 'file://server/share/proj/',
    locationType: 'UriLocation',
  })
  const asPath = openLocation({
    localPath: '//server/share/proj/reads.bam',
    locationType: 'LocalPathLocation',
  })
  expect(keyOf(share)).toBe(keyOf(asPath))
})

test('a bare absolute path with no baseUri opens as a local path', () => {
  const bare = openLocation({
    uri: '/data/proj/reads.bam',
    locationType: 'UriLocation',
  })
  const asPath = openLocation({
    localPath: '/data/proj/reads.bam',
    locationType: 'LocalPathLocation',
  })
  expect(keyOf(bare)).toBe(keyOf(asPath))
})

test('an http uri is still opened remotely', () => {
  const remote = openLocation({
    uri: 'https://example.com/x.bam',
    locationType: 'UriLocation',
  })
  const local = openLocation({
    localPath: '/data/x.bam',
    locationType: 'LocalPathLocation',
  })
  expect(remote.constructor.name).not.toBe(local.constructor.name)
  expect(remote.constructor.name).toBe('RemoteFileWithRangeCache')
})
