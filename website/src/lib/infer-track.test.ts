/// <reference types="jest" />
import { formats, matchFormat } from '../../../packages/add-track-core/src/index.ts'
import PluginManager from '../../../packages/core/src/PluginManager.ts'
import { expandLooseTrackConfig } from '../../../packages/core/src/util/tracks.ts'
import { expandTrackShorthand } from './infer-track.ts'

const SAMPLES = [
  'reads.bam',
  'reads.cram',
  'reads.sam.gz',
  'genes.gff3.gz',
  'genes.gff3',
  'genes.gtf.gz',
  'genes.gtf',
  'calls.vcf.gz',
  'calls.vcf',
  'pairs.ld.gz',
  'pairs.ld',
  'svs.bedpe.gz',
  'star-fusion.fusion_predictions.tsv',
  'calls.bedmethyl.gz',
  'peaks.bed.gz',
  'cov.bedgraph.gz',
  'cov.bedgraph',
  'cov.bg.gz',
  'cov.bg',
  'aln.pif.gz',
  'peaks.bed',
  'peaks.bb',
  'cov.bw',
  'rmsk.txt.gz',
  'genome.fa.gz',
  'genome.fa',
  'genome.2bit',
  'genome.chrom.sizes',
  'trackData.json',
  'sparql',
  'contacts.hic',
  'aln.paf',
  'aln.out',
  'aln.chain',
  'aln.delta',
  'grape.peach.anchors.simple',
  'grape.peach.anchors',
]

function appPluginManager() {
  const pm = new PluginManager([])
  jest.spyOn(pm, 'hasAdapterType').mockReturnValue(true)
  return pm
}

test('every format with an adapter has a sample', () => {
  const sampled = new Set(SAMPLES.map(name => matchFormat(name)))
  const unsampled = formats.filter(
    f => f.regex && 'adapterType' in f.spec && !sampled.has(f),
  )
  expect(unsampled.map(f => String(f.regex))).toEqual([])
})

test.each(SAMPLES)('%s expands as the app expands it', name => {
  const shorthand = {
    trackId: 't',
    uri: `https://example.com/data/${name}?sig=1`,
    assemblyNames: ['hg38'],
  }
  expect(expandTrackShorthand(shorthand)).toEqual(
    expandLooseTrackConfig(shorthand, appPluginManager()),
  )
})

test('an index, a baseUri and the keys beside uri expand as in the app', () => {
  const shorthand = {
    trackId: 't',
    name: 'Reads',
    type: 'FeatureTrack',
    uri: 'reads.bam',
    index: 'reads.bam.csi',
    baseUri: 'https://example.com/config.json',
    assemblyNames: ['hg38'],
    category: ['A'],
  }
  expect(expandTrackShorthand(shorthand)).toEqual(
    expandLooseTrackConfig(shorthand, appPluginManager()),
  )
})
