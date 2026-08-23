import { downloadPhase, getLocationUri } from './getLocationUri.ts'

test('a relative uri resolves against its baseUri', () => {
  expect(
    getLocationUri({
      locationType: 'UriLocation',
      uri: 'hg38.chromAlias.txt',
      baseUri: 'https://example.com/hubs/hg38/hub.txt',
    }),
  ).toBe('https://example.com/hubs/hg38/hg38.chromAlias.txt')
})

test('an absolute uri is left alone', () => {
  expect(
    getLocationUri({
      locationType: 'UriLocation',
      uri: 'https://example.com/hg38.2bit',
    }),
  ).toBe('https://example.com/hg38.2bit')
})

test('a local path is its path', () => {
  expect(
    getLocationUri({
      locationType: 'LocalPathLocation',
      localPath: '/data/hg38.fa.fai',
    }),
  ).toBe('/data/hg38.fa.fai')
})

// bytes the user handed the page: no server to go and check, so the stalled
// notice has nothing to say and downloadPhase gives back the plain label
test('a blob has no address, and its phase stays a bare label', () => {
  const blob = {
    locationType: 'BlobLocation' as const,
    name: 'hg38.fa.fai',
    blobId: 'abc',
  }
  expect(getLocationUri(blob)).toBeUndefined()
  expect(downloadPhase('Downloading chromosome sizes', blob)).toBe(
    'Downloading chromosome sizes',
  )
})

test('a phase over a real location carries it', () => {
  expect(
    downloadPhase('Downloading cytobands', {
      locationType: 'UriLocation',
      uri: 'https://example.com/cytoband.txt.gz',
    }),
  ).toEqual({
    message: 'Downloading cytobands',
    source: 'https://example.com/cytoband.txt.gz',
  })
})
