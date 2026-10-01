import {
  downloadPhase,
  getLocationUri,
  redactSource,
} from './getLocationUri.ts'

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

// a presigned link carries its credential in the query string, and the notice
// renders on screen and into every screenshot of it
test('a presigned url shows its host and path, not its signature', () => {
  expect(
    getLocationUri({
      locationType: 'UriLocation',
      uri: 'https://s3.amazonaws.com/bucket/hg38.2bit?X-Amz-Signature=deadbeef&X-Amz-Expires=3600',
    }),
  ).toBe('https://s3.amazonaws.com/bucket/hg38.2bit')
})

test('redactSource drops userinfo, query and fragment from a URL', () => {
  expect(redactSource('https://user:pw@example.com/a.bam?sig=1#x')).toBe(
    'https://example.com/a.bam',
  )
  expect(redactSource('https://user@example.com/a.bam')).toBe(
    'https://example.com/a.bam',
  )
})

test('redactSource strips userinfo up to the last @ of the authority', () => {
  expect(redactSource('https://u:p@ss@host/x')).toBe('https://host/x')
  expect(redactSource('https://u:p@ss@host/a@b?q=c@d')).toBe('https://host/a@b')
})

test('redactSource keeps an @ in the path and drops one in the query', () => {
  expect(redactSource('https://example.com/a@b.bam')).toBe(
    'https://example.com/a@b.bam',
  )
  expect(redactSource('https://example.com?email=a@b')).toBe(
    'https://example.com',
  )
})

test('redactSource leaves a path alone', () => {
  expect(redactSource('/data/a@b?.txt')).toBe('/data/a@b?.txt')
})
