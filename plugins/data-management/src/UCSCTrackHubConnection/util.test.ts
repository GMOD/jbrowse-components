import { hubBaseUrl, makeLoc, makeLocFromUri } from './util.ts'

import type { HubLocation } from './util.ts'

function uri(s: string, baseUri?: string): HubLocation {
  return { uri: s, baseUri, locationType: 'UriLocation' }
}
function local(localPath: string): HubLocation {
  return { localPath, locationType: 'LocalPathLocation' }
}

test('hubBaseUrl resolves uri against baseUri', () => {
  expect(hubBaseUrl(uri('hub.txt', 'https://x.org/a/'))).toBe(
    'https://x.org/a/hub.txt',
  )
})

test('hubBaseUrl turns a posix local path into a file:// url', () => {
  expect(hubBaseUrl(local('/home/u/hub.txt'))).toBe('file:///home/u/hub.txt')
})

test('hubBaseUrl turns a windows local path into a file:// url', () => {
  expect(hubBaseUrl(local('C:\\Users\\u\\hub.txt'))).toBe(
    'file:///C:/Users/u/hub.txt',
  )
})

test('makeLocFromUri resolves a remote sibling path', () => {
  expect(makeLocFromUri('genomes.txt', 'https://x.org/a/hub.txt')).toEqual({
    uri: 'https://x.org/a/genomes.txt',
    locationType: 'UriLocation',
  })
})

test('makeLocFromUri resolves a local sibling path back to a local path', () => {
  expect(
    makeLocFromUri('genomes.txt', hubBaseUrl(local('/home/u/hub.txt'))),
  ).toEqual({
    localPath: '/home/u/genomes.txt',
    locationType: 'LocalPathLocation',
  })
})

test('makeLocFromUri resolves a local subdir + windows base', () => {
  expect(
    makeLocFromUri(
      'volvox/trackDb.txt',
      hubBaseUrl(local('C:\\Users\\u\\hub.txt')),
    ),
  ).toEqual({
    localPath: 'C:/Users/u/volvox/trackDb.txt',
    locationType: 'LocalPathLocation',
  })
})

test('makeLocFromUri decodes spaces in local paths', () => {
  expect(
    makeLocFromUri('my file.bam', hubBaseUrl(local('/home/u/trackDb.txt'))),
  ).toEqual({
    localPath: '/home/u/my file.bam',
    locationType: 'LocalPathLocation',
  })
})

test('makeLoc resolves remote track data against its trackDb', () => {
  expect(makeLoc('tiny.bam', uri('https://x.org/volvox/trackDb.txt'))).toEqual({
    uri: 'https://x.org/volvox/tiny.bam',
    locationType: 'UriLocation',
  })
})

test('makeLoc resolves local track data against its trackDb', () => {
  expect(makeLoc('tiny.bam', local('/home/u/volvox/trackDb.txt'))).toEqual({
    localPath: '/home/u/volvox/tiny.bam',
    locationType: 'LocalPathLocation',
  })
})

test('makeLoc resolves .. segments', () => {
  expect(makeLoc('../data/x.bw', local('/home/u/sub/trackDb.txt'))).toEqual({
    localPath: '/home/u/data/x.bw',
    locationType: 'LocalPathLocation',
  })
})

test('makeLoc uses the fallback when the path is empty', () => {
  expect(
    makeLoc('', local('/home/u/volvox/trackDb.txt'), 'tiny.bam.bai'),
  ).toEqual({
    localPath: '/home/u/volvox/tiny.bam.bai',
    locationType: 'LocalPathLocation',
  })
  expect(
    makeLoc('', uri('https://x.org/volvox/trackDb.txt'), 'tiny.bam.bai'),
  ).toEqual({
    uri: 'https://x.org/volvox/tiny.bam.bai',
    locationType: 'UriLocation',
  })
})
