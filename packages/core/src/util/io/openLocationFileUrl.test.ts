import { openLocation } from './index.ts'

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
  expect(direct.filename).toBe(asPath.filename)
  expect(viaBase.filename).toBe(asPath.filename)
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
  expect(encoded.filename).toBe(asPath.filename)
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
