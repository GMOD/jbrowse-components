import PluginManager from '@jbrowse/core/PluginManager'
import { guessTrackConf } from '@jbrowse/core/util/tracks'

import AlignmentsPlugin from '../index.ts'

// guessTrackConf is generic core logic, but its inference is driven by the
// per-format plugins' guessers; exercise it end-to-end through a real
// PluginManager with the alignments plugin registered (BamAdapter/CramAdapter).
function setup() {
  const pluginManager = new PluginManager([new AlignmentsPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager
}

test('builds a full BAM track config from a bare uri', () => {
  const conf = guessTrackConf('https://x.org/reads.bam', setup(), 'hg38')
  expect(conf.type).toBe('AlignmentsTrack')
  expect(conf.name).toBe('reads.bam')
  expect(conf.assemblyNames).toEqual(['hg38'])
  expect(conf.trackId).toMatch(/^reads\.bam-/)
  expect(conf.adapter).toMatchObject({
    type: 'BamAdapter',
    bamLocation: { uri: 'https://x.org/reads.bam' },
    index: {
      location: { uri: 'https://x.org/reads.bam.bai' },
      indexType: 'BAI',
    },
  })
})

test('honors an explicit index and detects a .csi index', () => {
  const conf = guessTrackConf(
    { uri: 'https://x.org/reads.bam', index: 'https://x.org/reads.bam.csi' },
    setup(),
    'hg38',
  )
  expect(conf.adapter).toMatchObject({
    index: {
      location: { uri: 'https://x.org/reads.bam.csi' },
      indexType: 'CSI',
    },
  })
})

test('builds a CRAM track with a default craiLocation', () => {
  const conf = guessTrackConf('https://x.org/reads.cram', setup(), 'hg38')
  expect(conf.adapter).toMatchObject({
    type: 'CramAdapter',
    cramLocation: { uri: 'https://x.org/reads.cram' },
    craiLocation: { uri: 'https://x.org/reads.cram.crai' },
  })
})

test('extra keys override the inferred defaults', () => {
  const conf = guessTrackConf(
    { uri: 'https://x.org/reads.bam', name: 'Tumor' },
    setup(),
  )
  expect(conf.name).toBe('Tumor')
  expect(conf.assemblyNames).toEqual([])
})

test('throws on an extension no plugin recognizes', () => {
  expect(() => guessTrackConf('https://x.org/mystery.xyz', setup())).toThrow(
    /could not infer/,
  )
})
