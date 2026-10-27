import { matchFormat } from '@jbrowse/add-track-core'

import { adapterConfigFromSpec, makeIndex } from './formatGuessers.ts'

// An account picked in the file selector with no `domains` to match by: the
// index derived without its id was read unauthenticated and failed with a 401
test('a derived index keeps the internet account its file was picked with', () => {
  const bam = {
    locationType: 'UriLocation' as const,
    uri: 'https://private.example/reads.bam',
    internetAccountId: 'labAccount',
  }
  const spec = matchFormat('reads.bam')?.spec
  expect(spec && adapterConfigFromSpec(spec, bam)).toMatchObject({
    index: {
      location: {
        uri: 'https://private.example/reads.bam.bai',
        internetAccountId: 'labAccount',
      },
    },
  })
})

test('a derived index keeps a baseUri, and a Blob has no sibling', () => {
  expect(
    makeIndex(
      { locationType: 'UriLocation', uri: 'a.vcf.gz', baseUri: 'https://h/' },
      '.tbi',
    ),
  ).toEqual({
    locationType: 'UriLocation',
    uri: 'a.vcf.gz.tbi',
    baseUri: 'https://h/',
  })
  const blob = { locationType: 'BlobLocation' as const, name: 'a', blobId: 'b' }
  expect(makeIndex(blob, '.tbi')).toBe(blob)
})
