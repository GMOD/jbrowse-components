import { getFileName } from './getFileName.ts'

const uri = (u: string) => ({ uri: u, locationType: 'UriLocation' }) as const

test('the last path segment of a uri', () => {
  expect(getFileName(uri('https://example.com/data/hg38.fa'))).toBe('hg38.fa')
})

test('the last segment of a local path, forward or back slashed', () => {
  expect(
    getFileName({
      localPath: '/data/hg38.fa',
      locationType: 'LocalPathLocation',
    }),
  ).toBe('hg38.fa')
  expect(
    getFileName({
      localPath: 'C:\\data\\hg38.fa',
      locationType: 'LocalPathLocation',
    }),
  ).toBe('hg38.fa')
})

test('a blob carries its name directly', () => {
  expect(
    getFileName({
      blobId: 'abc',
      name: 'hg38.2bit',
      locationType: 'BlobLocation',
    }),
  ).toBe('hg38.2bit')
})

// a presigned S3/GCS link is one of the two normal ways to share a genome, and
// the signature is a few hundred characters. Every consumer either shows this
// name or matches an extension against the end of it, so the whole query used
// to land in a track title and defeat every adapter guesser at once
test('a uri query string is not part of the name', () => {
  expect(
    getFileName(
      uri(
        'https://s3.amazonaws.com/j/hg38.fa.gz?X-Amz-Signature=deadbeef&X-Amz-Expires=86400',
      ),
    ),
  ).toBe('hg38.fa.gz')
  expect(getFileName(uri('https://example.com/hg38.2bit#frag'))).toBe(
    'hg38.2bit',
  )
})

// `?` is legal in a POSIX filename, so the local path is taken as given
test('but a local path keeps one', () => {
  expect(
    getFileName({
      localPath: '/data/why?not.fa',
      locationType: 'LocalPathLocation',
    }),
  ).toBe('why?not.fa')
})
