import {
  alignedReadBasesNumeric,
  getLengthSansClipping,
} from '@jbrowse/cigar-utils'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BamAdapter from '../BamAdapter/BamAdapter.ts'
import bamConfigSchema from '../BamAdapter/configSchema.ts'
import CramAdapter from '../CramAdapter/CramAdapter.ts'
import {
  getVolvoxSequenceSubAdapter,
  volvoxReference,
} from '../CramAdapter/CramTestAdapters.fixture.ts'
import cramConfigSchema from '../CramAdapter/configSchema.ts'
import SamAdapter from '../SamAdapter/SamAdapter.ts'
import samConfigSchema from '../SamAdapter/configSchema.ts'
import { forEachSAEntry } from '../features/sashimi/splitJunctions.ts'
import { isMismatchFeature } from './extractCigarFeatures.ts'
import { saTagOf } from './splitAlignment.ts'

import type { Feature } from '@jbrowse/core/util'

const FILE = '../../../../test_data/volvox/volvox-long-reads-sv'

const query = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 50001,
}

async function fetchAll(adapter: { getFeatures: BamAdapter['getFeatures'] }) {
  return firstValueFrom(adapter.getFeatures(query).pipe(toArray()))
}

function bamAdapter() {
  return new BamAdapter(
    bamConfigSchema.create({
      bamLocation: { localPath: require.resolve(`${FILE}.bam`) },
      index: { location: { localPath: require.resolve(`${FILE}.bam.bai`) } },
    }),
    getVolvoxSequenceSubAdapter,
    undefined,
    volvoxReference,
  )
}

function cramAdapter() {
  return new CramAdapter(
    cramConfigSchema.create({
      cramLocation: {
        localPath: require.resolve(`${FILE}.cram`),
        locationType: 'LocalPathLocation',
      },
      craiLocation: {
        localPath: require.resolve(`${FILE}.cram.crai`),
        locationType: 'LocalPathLocation',
      },
    }),
    getVolvoxSequenceSubAdapter,
    undefined,
    volvoxReference,
  )
}

function samLine(f: Feature) {
  const sa = saTagOf(f)
  return [
    f.get('name'),
    f.get('flags'),
    f.get('refName'),
    f.get('start') + 1,
    f.get('score'),
    f.get('CIGAR'),
    '*',
    0,
    0,
    f.get('seq'),
    '*',
    ...(sa ? [`SA:Z:${sa}`] : []),
  ].join('\t')
}

function samAdapter(records: Feature[]) {
  return new SamAdapter(
    samConfigSchema.create({
      samText: ['@SQ\tSN:ctgA\tLN:50001', ...records.map(samLine), ''].join(
        '\n',
      ),
    }),
    getVolvoxSequenceSubAdapter,
    undefined,
    volvoxReference,
  )
}

const keyOf = (f: Feature) =>
  `${f.get('name')}:${f.get('flags')}:${f.get('start')}`

function alignedBasesByRecord(features: Feature[]) {
  return Object.fromEntries(
    features.map(f => [
      keyOf(f),
      isMismatchFeature(f) ? f.alignedReadBases : Number.NaN,
    ]),
  )
}

test('BAM, CRAM and SAM records of one split read align the same read bases', async () => {
  const bam = await fetchAll(bamAdapter())
  const cram = await fetchAll(cramAdapter())
  const sam = await fetchAll(samAdapter(bam))
  const flags = new Set(bam.map(f => f.get('flags')))
  const cigars = bam.flatMap(f => {
    const cigar = f.get('CIGAR')
    return typeof cigar === 'string' ? [cigar] : []
  })
  expect(flags.has(2064)).toBe(true)
  expect(flags.has(16)).toBe(true)
  expect(cigars.some(c => /^\d+H/.test(c))).toBe(true)
  expect(cigars.some(c => /^\d+S|\d+S$/.test(c))).toBe(true)

  const walked = Object.fromEntries(
    bam.map(f => {
      const cigar = f.get('CIGAR')
      return [
        keyOf(f),
        typeof cigar === 'string' ? getLengthSansClipping(cigar) : Number.NaN,
      ]
    }),
  )
  expect(alignedBasesByRecord(bam)).toEqual(walked)
  expect(alignedBasesByRecord(cram)).toEqual(walked)
  expect(alignedBasesByRecord(sam)).toEqual(walked)
})

test('a record and its SA twin align the same read bases', async () => {
  const bam = await fetchAll(bamAdapter())
  const byLocus = new Map(
    bam.map(f => [
      `${f.get('name')}:${f.get('start')}:${f.get('strand')}`,
      isMismatchFeature(f) ? f.alignedReadBases : Number.NaN,
    ]),
  )
  let twins = 0
  for (const f of bam) {
    forEachSAEntry(
      saTagOf(f),
      (_nameStart, _nameEnd, start, _end, strand, _clip, _mapq, readBases) => {
        const own = byLocus.get(`${f.get('name')}:${start}:${strand}`)
        if (own !== undefined) {
          twins++
          expect(readBases).toBe(own)
        }
      },
    )
  }
  expect(twins).toBeGreaterThan(10)
})

test('a packed CIGAR aligns its stored sequence less the soft clips', () => {
  const S = 4
  const H = 5
  const M = 0
  const I = 1
  const D = 2
  const pack = (ops: [number, number][]) =>
    ops.map(([len, op]) => (len << 4) | op)
  expect(
    alignedReadBasesNumeric(
      pack([
        [10, S],
        [80, M],
        [5, I],
        [10, S],
      ]),
      105,
    ),
  ).toBe(85)
  expect(
    alignedReadBasesNumeric(
      pack([
        [300, H],
        [4, S],
        [90, M],
        [7, D],
        [6, S],
        [2, H],
      ]),
      100,
    ),
  ).toBe(90)
  expect(
    alignedReadBasesNumeric(
      pack([
        [300, H],
        [90, M],
        [7, D],
        [5, I],
      ]),
      95,
    ),
  ).toBe(95)
  expect(
    alignedReadBasesNumeric(
      pack([
        [300, H],
        [90, M],
        [7, D],
        [5, I],
      ]),
      0,
    ),
  ).toBe(95)
  expect(alignedReadBasesNumeric([], 0)).toBe(0)
})
