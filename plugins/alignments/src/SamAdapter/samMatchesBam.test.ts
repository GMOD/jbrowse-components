import { LocalFile } from 'generic-filehandle2'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BamAdapter from '../BamAdapter/BamAdapter.ts'
import bamConfigSchema from '../BamAdapter/configSchema.ts'
import { SequenceAdapter } from '../CramAdapter/CramTestAdapters.ts'
import SamAdapter from './SamAdapter.ts'
import samConfigSchema from './configSchema.ts'

import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'

const getVolvoxSequenceSubAdapter: getSubAdapterType = async () => ({
  dataAdapter: new SequenceAdapter(
    new LocalFile(require.resolve('../../test_data/volvox.fa')),
  ),
  sessionIds: new Set(),
})

// getVolvoxSequenceSubAdapter ignores it and returns the test adapter
const sequenceAdapterConfig = { type: 'TestSequenceAdapter' }

const query = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 1,
  end: 10200,
}

// Only reads that fall entirely inside the queried region are compared. A read
// overhanging it has no fetched reference to compare its overhang against, so
// the two adapters legitimately disagree there: BAM walks a read carrying MD in
// full, needing no reference at all, while these SAM lines deliberately carry
// none.
const contained = (features: Feature[]) =>
  features.filter(
    f => f.get('start') >= query.start && f.get('end') <= query.end,
  )

function qualString(qual: unknown) {
  return qual instanceof Uint8Array && qual.length
    ? [...qual].map(q => String.fromCharCode(q + 33)).join('')
    : '*'
}

// Re-emit a BAM record as the SAM line it came from. Deliberately without an MD
// tag even where the BAM carries one: a converted alignment (a PSL hit, an
// aligner's raw output) states bases and no MD, so this exercises the
// compare-against-the-reference path that such records depend on.
function toSamLine(feature: Feature) {
  return [
    feature.get('name'),
    feature.get('flags'),
    feature.get('refName'),
    feature.get('start') + 1,
    feature.get('score'),
    feature.get('CIGAR'),
    '*',
    0,
    feature.get('template_length'),
    feature.get('seq'),
    qualString(feature.get('NUMERIC_QUAL')),
  ].join('\t')
}

const bamFeatures = async (file: string) => {
  const adapter = new BamAdapter(
    bamConfigSchema.create({
      bamLocation: { localPath: require.resolve(file) },
      index: { location: { localPath: require.resolve(`${file}.bai`) } },
    }),
    getVolvoxSequenceSubAdapter,
  )
  adapter.setSequenceAdapterConfig(sequenceAdapterConfig)
  return firstValueFrom(adapter.getFeatures(query).pipe(toArray()))
}

const samFeatures = async (features: Feature[]) => {
  const adapter = new SamAdapter(
    samConfigSchema.create({
      samText: ['@SQ\tSN:ctgA\tLN:50001', ...features.map(toSamLine), ''].join(
        '\n',
      ),
    }),
    getVolvoxSequenceSubAdapter,
  )
  adapter.setSequenceAdapterConfig(sequenceAdapterConfig)
  return firstValueFrom(adapter.getFeatures(query).pipe(toArray()))
}

const byName = (features: Feature[], field: string) =>
  Object.fromEntries(features.map(f => [f.get('name'), f.get(field)]))

// Clip marks are excluded: the two adapters bound the mismatch walk by different
// reference spans on purpose (SamAdapter adds one base of slack so a soft clip
// sitting at the last read's end position isn't dropped), and a clip is the one
// mark that can land exactly on that boundary. Clipping itself is asserted in
// SamAdapter.test.ts.
// altbase is lowercased on both sides: resolved from an MD tag it is always
// uppercase, resolved from the reference it keeps whatever case the FASTA used,
// and volvox.fa is soft-masked. Same base either way.
const alignmentMarks = (features: Feature[]) =>
  Object.fromEntries(
    features.map(f => [
      f.get('name'),
      (
        f.get('mismatches') as {
          type: string
          start: number
          altbase?: string
        }[]
      )
        .filter(m => m.type !== 'softclip' && m.type !== 'hardclip')
        .map(m => ({ ...m, altbase: m.altbase?.toLowerCase() }))
        .sort((a, b) => a.start - b.start),
    ]),
  )

async function bamAndSam(file: string) {
  const bam = contained(await bamFeatures(file))
  return { bam, sam: await samFeatures(bam) }
}

test.each([
  ['../../test_data/volvox-sorted.bam'],
  ['../../test_data/volvox-long-reads.fastq.sorted.bam'],
])('a SAM of %s serves the same reads', async file => {
  const { bam, sam } = await bamAndSam(file)
  expect(sam).toHaveLength(bam.length)
  expect(byName(sam, 'start')).toEqual(byName(bam, 'start'))
  expect(byName(sam, 'end')).toEqual(byName(bam, 'end'))
  expect(byName(sam, 'strand')).toEqual(byName(bam, 'strand'))
  expect(byName(sam, 'CIGAR')).toEqual(byName(bam, 'CIGAR'))
})

// The payoff: per-base detail resolved from SEQ against the assembly's sequence
// agrees with what BAM reports for the same reads (which for these files is
// resolved from their MD tags).
test.each([
  ['../../test_data/volvox-sorted.bam'],
  ['../../test_data/volvox-long-reads.fastq.sorted.bam'],
])('a SAM of %s calls the same mismatches and indels', async file => {
  const { bam, sam } = await bamAndSam(file)
  expect(alignmentMarks(sam)).toEqual(alignmentMarks(bam))
})
