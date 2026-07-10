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

test('generateTracks derives category from ancestor container shortLabels', () => {
  // a superTrack container whose child sets no `group`: the folder name must
  // come from the parent shortLabel, not be dropped
  const compositeDb = new TrackDbFile(`track testgroup
superTrack on
shortLabel Test group
longLabel A grouping of alignment tracks

track volvoxBam
parent testgroup
type bam
shortLabel BAM
longLabel BAM alignments
bigDataUrl tiny.bam
`)
  const tracks = generateTracks({
    trackDb: compositeDb,
    trackDbLoc: uri('https://x.org/volvox/trackDb.txt'),
    assemblyName: 'volvox',
    baseUrl: 'https://x.org/hub.txt',
  })
  // the container stanza itself is not emitted as a track
  expect(tracks).toHaveLength(1)
  expect(tracks[0]!.category).toEqual(['Test group'])
})

test('generateTracks inherits type from a composite parent named with a visibility suffix', () => {
  // a composite child commonly omits `type` and inherits it from the parent,
  // and `parent` carries a `on`/`off` visibility suffix. The parent lookup must
  // strip that suffix or the child falls through to an unknown track type.
  const compositeDb = new TrackDbFile(`track mycomposite
compositeTrack on
type bigBed
shortLabel Composite
longLabel A composite of bigBed subtracks

track child1
parent mycomposite on
shortLabel Child 1
longLabel A child bigBed
bigDataUrl child1.bb
`)
  const tracks = generateTracks({
    trackDb: compositeDb,
    trackDbLoc: uri('https://x.org/volvox/trackDb.txt'),
    assemblyName: 'volvox',
    baseUrl: 'https://x.org/hub.txt',
  })
  expect(tracks).toHaveLength(1)
  expect(tracks[0]).toMatchObject({
    type: 'FeatureTrack',
    adapter: {
      type: 'BigBedAdapter',
      bigBedLocation: {
        uri: 'https://x.org/volvox/child1.bb',
        locationType: 'UriLocation',
      },
    },
  })
})

test('generateTracks inherits type across a composite -> view -> track chain', () => {
  // UCSC multiView composites nest a `view` stanza between the composite and
  // its leaves. The leaf's type lives two levels up on the composite, so
  // single-level parent lookup would miss it and fall through to unknown.
  const multiViewDb = new TrackDbFile(`track mycomposite
compositeTrack on
type bigWig
shortLabel Composite
longLabel A multiView composite

track mycomposite_signal
view Signal
parent mycomposite
shortLabel Signal view

track child1
parent mycomposite_signal on
shortLabel Child 1
longLabel A child bigWig
bigDataUrl child1.bw
`)
  const tracks = generateTracks({
    trackDb: multiViewDb,
    trackDbLoc: uri('https://x.org/volvox/trackDb.txt'),
    assemblyName: 'volvox',
    baseUrl: 'https://x.org/hub.txt',
  })
  expect(tracks).toHaveLength(1)
  expect(tracks[0]).toMatchObject({
    type: 'QuantitativeTrack',
    adapter: { type: 'BigWigAdapter' },
    category: ['Composite', 'Signal view'],
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
