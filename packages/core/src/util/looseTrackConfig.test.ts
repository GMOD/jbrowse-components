import PluginManager from '../PluginManager.ts'
import {
  addAdapterGuesser,
  addTrackTypeGuesser,
  expandLooseTrackConfig,
  getFileName,
} from './tracks.ts'

import type { FileLocation } from './types/data.ts'

function uri(s: string): FileLocation {
  return { uri: s, locationType: 'UriLocation' }
}

function withBamGuessers() {
  const pm = new PluginManager([])
  addAdapterGuesser(pm, (file, index) =>
    getFileName(file).endsWith('.bam')
      ? {
          type: 'BamAdapter',
          bamLocation: file,
          index: {
            location: index ?? uri(`${(file as { uri: string }).uri}.bai`),
          },
        }
      : undefined,
  )
  addTrackTypeGuesser(pm, adapterName =>
    adapterName === 'BamAdapter' ? 'AlignmentsTrack' : undefined,
  )
  return pm
}

test('a { trackId, uri } becomes a whole track config', () => {
  const conf = expandLooseTrackConfig(
    { trackId: 'reads', uri: 'reads.bam', assemblyNames: ['hg38'] },
    withBamGuessers(),
  )
  expect(conf).toMatchObject({
    trackId: 'reads',
    type: 'AlignmentsTrack',
    name: 'reads.bam',
    assemblyNames: ['hg38'],
    adapter: { type: 'BamAdapter', bamLocation: uri('reads.bam') },
  })
  expect(conf).not.toHaveProperty('uri')
})

test('keys written beside uri override the inference', () => {
  const conf = expandLooseTrackConfig(
    {
      trackId: 'reads',
      uri: 'reads.bam',
      index: 'reads.csi',
      name: 'Reads',
      type: 'FeatureTrack',
      category: ['A'],
    },
    withBamGuessers(),
    'hg38',
  )
  expect(conf).toMatchObject({
    name: 'Reads',
    type: 'FeatureTrack',
    category: ['A'],
    assemblyNames: ['hg38'],
    adapter: { index: { location: uri('reads.csi') } },
  })
})

test('a full config and a non-object pass through untouched', () => {
  const pm = withBamGuessers()
  const full = { trackId: 't', type: 'X', adapter: { type: 'Y', uri: 'z' } }
  expect(expandLooseTrackConfig(full, pm)).toBe(full)
  expect(expandLooseTrackConfig('t', pm)).toBe('t')
})

test('an extension no format claims is an error naming the file', () => {
  expect(() =>
    expandLooseTrackConfig(
      { trackId: 't', uri: 'x.unknown' },
      new PluginManager([]),
    ),
  ).toThrow('could not infer a track type from "x.unknown"')
})
