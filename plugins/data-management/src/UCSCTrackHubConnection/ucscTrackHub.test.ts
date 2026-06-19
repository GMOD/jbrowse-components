import { GenomesFile, TrackDbFile } from '@gmod/ucsc-hub'

import { generateAssembly } from './generateAssembly.ts'
import { generateTracks } from './ucscTrackHub.ts'
import { hubBaseUrl } from './util.ts'

import type { HubLocation } from './util.ts'

function local(localPath: string): HubLocation {
  return { localPath, locationType: 'LocalPathLocation' }
}
function uri(s: string): HubLocation {
  return { uri: s, locationType: 'UriLocation' }
}

const trackDb = new TrackDbFile(`track volvoxBam
type bam
shortLabel BAM
longLabel BAM alignments
bigDataUrl tiny.bam
`)

test('generateTracks resolves bigDataUrl + index against a local trackDb', () => {
  const tracks = generateTracks({
    trackDb,
    trackDbLoc: local('/home/u/volvox/trackDb.txt'),
    assemblyName: 'volvox',
    baseUrl: 'file:///home/u/hub.txt',
  })
  expect(tracks[0]).toMatchObject({
    adapter: {
      type: 'BamAdapter',
      bamLocation: {
        localPath: '/home/u/volvox/tiny.bam',
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: '/home/u/volvox/tiny.bam.bai',
          locationType: 'LocalPathLocation',
        },
      },
    },
  })
})

test('generateTracks keeps remote locations remote', () => {
  const tracks = generateTracks({
    trackDb,
    trackDbLoc: uri('https://x.org/volvox/trackDb.txt'),
    assemblyName: 'volvox',
    baseUrl: 'https://x.org/hub.txt',
  })
  expect(tracks[0]).toMatchObject({
    adapter: {
      bamLocation: {
        uri: 'https://x.org/volvox/tiny.bam',
        locationType: 'UriLocation',
      },
    },
  })
})

const genome = new GenomesFile(`genome volvox
trackDb volvox/trackDb.txt
twoBitPath volvox/volvox.2bit
`).data.volvox!

test('generateAssembly resolves twoBit against a local genomes.txt', () => {
  const asm = generateAssembly(genome, hubBaseUrl(local('/home/u/genomes.txt')))
  expect(asm.sequence.adapter.twoBitLocation).toEqual({
    localPath: '/home/u/volvox/volvox.2bit',
    locationType: 'LocalPathLocation',
  })
})
