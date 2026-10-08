import { parseMafBlocks } from '../BgzipMafAdapter/mafParsing.ts'
import { makeSourceResolver } from '../util/parseAssemblyName.ts'
import { MafRegionSink } from './mafRegionSink.ts'

function referenceSampleId(...named: (string | undefined)[]) {
  const sink = new MafRegionSink(undefined)
  for (const refSampleId of named) {
    sink.startBlock('b', 0, 4, 1, 'ACGT', 0, 4, refSampleId)
    sink.addRow('panTro6', 'ACGT', 0, 4, 'chr1', 0, 1, undefined, undefined)
  }
  return sink.refSampleId
}

test('the reference is the row the reader names', () => {
  expect(referenceSampleId('hg38')).toBe('hg38')
})

// A reference the sample set leaves out has no row. A row byte-identical to it
// (any pangenome haplotype over a short block) is still that haplotype.
test('a row identical to an unlisted reference is not the reference', () => {
  expect(referenceSampleId(undefined)).toBeUndefined()
})

test('the first block that names a reference decides', () => {
  expect(referenceSampleId(undefined, 'mm39', 'hg38')).toBe('mm39')
})

const STANZA = [
  'a score=1',
  's hg38.chr1 100 4 + 5000 ACGT',
  's panTro6.chr3 40 4 + 5000 ACGT',
  '',
  '',
].join('\n')

function parsedReference(sampleIds?: string[]) {
  const { resolve } = makeSourceResolver(sampleIds && new Set(sampleIds))
  return [...parseMafBlocks(STANZA, resolve)].map(b => b.refSampleId)
}

test('the MAF parse names the first s line’s row', () => {
  expect(parsedReference()).toEqual(['hg38'])
  expect(parsedReference(['hg38', 'panTro6'])).toEqual(['hg38'])
})

test('the MAF parse names no row for a reference its sample set leaves out', () => {
  expect(parsedReference(['panTro6'])).toEqual([undefined])
})
