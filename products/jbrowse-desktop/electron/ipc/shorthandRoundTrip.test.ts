import { resolveUriLocation } from '@jbrowse/core/util/io'
import { normalizeSnapshot as bamNormalize } from '@jbrowse/plugin-alignments/src/BamAdapter/configSchema'

import { relativeUrisToLocalPaths } from './relativeUrisToLocalPaths.ts'

// The main process resolves relative uris; the renderer expands the shorthands.
// Neither half can see the other, and between them sits the only config a first
// -time user writes by hand. This walks a config.json the whole way across that
// boundary, because the failure it guards against is silent on both sides: the
// adapter kept its type and lost its file, so the track drew nothing.
test('a shorthand adapter survives the main-to-renderer trip with its siblings', () => {
  const cfg = {
    assemblies: [{ name: 'hg38', uri: 'hg38.fa.gz' }],
    tracks: [
      {
        type: 'AlignmentsTrack',
        trackId: 'reads',
        adapter: { type: 'BamAdapter', uri: 'reads.bam' },
      },
    ],
  }

  relativeUrisToLocalPaths(cfg, '/data/proj')

  const adapter = bamNormalize(cfg.tracks[0]!.adapter) as unknown as {
    type: string
    bamLocation: { uri: string; baseUri?: string }
    index: { indexType: string; location: { uri: string; baseUri?: string } }
  }

  expect(adapter.type).toBe('BamAdapter')
  expect(resolveUriLocation(adapter.bamLocation).uri).toBe(
    'file:///data/proj/reads.bam',
  )
  // the index the shorthand derives has to land beside its data file, not at
  // the app's own base url
  expect(adapter.index.indexType).toBe('BAI')
  expect(resolveUriLocation(adapter.index.location).uri).toBe(
    'file:///data/proj/reads.bam.bai',
  )
  // the flat assembly form reaches its own expander with the uri intact
  expect(cfg.assemblies[0]).toEqual({
    name: 'hg38',
    uri: 'hg38.fa.gz',
    baseUri: 'file:///data/proj/',
  })
})
