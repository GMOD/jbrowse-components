import { getFileName } from './getFileName.ts'

import type { FileLocation } from './types/data.ts'

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

test('a slash inside the query does not end the name', () => {
  expect(
    getFileName(
      uri(
        'https://s3.amazonaws.com/b/sample.bw?X-Amz-Credential=k/20260808/us-east-1/s3/aws4_request',
      ),
    ),
  ).toBe('sample.bw')
})

test('a location stored without its locationType', () => {
  expect(getFileName({ uri: 'https://x/a.bw' } as FileLocation)).toBe('a.bw')
  expect(getFileName({ localPath: '/d/b.bw' } as FileLocation)).toBe('b.bw')
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

// jest runs in Node, where openLocation opens these as local files, as Desktop
// does, so `?` and `#` stay in the name
test('a uri naming a local file names it as openLocation opens it', () => {
  expect(getFileName(uri('/data/run#2/sample#1.bw'))).toBe('sample#1.bw')
  expect(getFileName(uri('C:\\data\\a?b.bw'))).toBe('a?b.bw')
  expect(getFileName(uri('file:///d/x%232.bw'))).toBe('x#2.bw')
  expect(getFileName(uri('data/x.bw?v=1'))).toBe('x.bw')
})
