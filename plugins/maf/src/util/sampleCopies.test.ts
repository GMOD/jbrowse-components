import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom, of } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { parseMafBlocks } from '../BgzipMafAdapter/mafParsing.ts'
import { blockToFeature } from '../BgzipTaffyAdapter/tafParsing.ts'
import BigMafAdapter from '../BigMafAdapter/BigMafAdapter.ts'
import BigMafConfigSchema from '../BigMafAdapter/configSchema.ts'
import { MafRegionSink } from '../LinearMafGetAlignmentDataRpc/mafRegionSink.ts'
import MafTabixAdapter from '../MafTabixAdapter/MafTabixAdapter.ts'
import MafTabixConfigSchema from '../MafTabixAdapter/configSchema.ts'
import { featureBlocks } from './mafBlockSink.ts'
import { makeSourceResolver } from './parseAssemblyName.ts'
import {
  copyParent,
  freeRowId,
  placeCopyRows,
  withCopyRows,
} from './sampleCopies.ts'

import type { AlignmentRecord } from '../types.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'

// Two consecutive blocks of HPRC v2.1's Minigraph-Cactus MAF at the amylase
// locus, cut to GRCh38 and HG01175#1, which carries six copies of the segment.
const SEQ1 = 'TATGCTAAGCTGCCTGACCAGTGGGCGTGTGGCTGTGTAATTGGC'
const SEQ2 = 'GATACCTGTGTTTCTCCAAATCATAAAAAACTTCG'
const CONTIG = 'HG01175.1.JAHAMA020000037.1'
const BLOCKS = [
  {
    ref: ['GRCh38.chr1', 103703095, SEQ1],
    copies: [
      [103991902, '+'],
      [104185974, '+'],
      [104380060, '+'],
      [33500074, '-'],
      [33694160, '-'],
      [33888223, '-'],
    ],
  },
  {
    ref: ['GRCh38.chr1', 103703642, SEQ2],
    copies: [
      [103992449, '+'],
      [104186521, '+'],
      [104380607, '+'],
      [33500621, '-'],
      [33694707, '-'],
      [33888770, '-'],
    ],
  },
] as const

const COPY_IDS = [
  'HG01175.1',
  'HG01175.1~2',
  'HG01175.1~3',
  'HG01175.1~4',
  'HG01175.1~5',
  'HG01175.1~6',
]

function sLines({ ref, copies }: (typeof BLOCKS)[number]) {
  const [src, start, seq] = ref
  return [
    `s\t${src}\t${start}\t${seq.length}\t+\t248956422\t${seq}`,
    ...copies.map(
      ([at, strand]) =>
        `s\t${CONTIG}\t${at}\t${seq.length}\t${strand}\t137823019\t${seq}`,
    ),
  ]
}

const MAF = BLOCKS.map(b => ['a score=0', ...sLines(b), ''].join('\n')).join(
  '\n',
)

function copyStarts(alignments: Record<string, AlignmentRecord>) {
  return COPY_IDS.map(id => alignments[id]?.srcStart)
}

const region = { refName: 'chr1', start: 0, end: 2e8, assemblyName: 'hg38' }

const featuresOf = (adapter: BaseFeatureDataAdapter) =>
  firstValueFrom(adapter.getFeatures(region).pipe(toArray()))

const loaderOf = (features: Feature[]) => () =>
  Promise.resolve({
    dataAdapter: {
      getFeatures: () => of(...features),
    } as unknown as BaseFeatureDataAdapter,
    sessionIds: new Set<string>(),
  })

test('freeRowId numbers copies from 2 and copyParent inverts it', () => {
  const taken = new Set(['a', 'a~2'])
  expect(freeRowId('b', id => taken.has(id))).toBe('b')
  expect(freeRowId('a', id => taken.has(id))).toBe('a~3')
  expect(copyParent('a~3')).toBe('a')
  expect(copyParent('a')).toBeUndefined()
})

test('bgzip MAF keeps every copy, each on the same row in both blocks', () => {
  const blocks = [...parseMafBlocks(`${MAF}\n`, makeSourceResolver().resolve)]
  expect(blocks.map(b => copyStarts(b.alignments))).toEqual(
    BLOCKS.map(b => b.copies.map(([at]) => at)),
  )
})

test('bigMaf keeps every copy', async () => {
  const features = await featuresOf(
    new BigMafAdapter(
      BigMafConfigSchema.create({}),
      loaderOf(
        BLOCKS.map(
          (b, i) =>
            new SimpleFeature({
              uniqueId: `bb${i}`,
              refName: 'chr1',
              start: b.ref[1],
              end: b.ref[1] + b.ref[2].length,
              mafBlock: sLines(b).join(';').replaceAll('\t', ' '),
            }),
        ),
      ),
    ),
  )
  expect(
    features.map(f =>
      copyStarts(f.get('alignments') as Record<string, AlignmentRecord>),
    ),
  ).toEqual(BLOCKS.map(b => b.copies.map(([at]) => at)))
})

test('MAF-tabix keeps every copy', async () => {
  const features = await featuresOf(
    new MafTabixAdapter(
      MafTabixConfigSchema.create({}),
      loaderOf(
        BLOCKS.map(
          (b, i) =>
            new SimpleFeature({
              uniqueId: `line${i}`,
              refName: 'chr1',
              start: b.ref[1],
              end: b.ref[1] + b.ref[2].length,
              field5: sLines(b)
                .map(l => l.split('\t').slice(1).join(':'))
                .join(','),
            }),
        ),
      ),
    ),
  )
  expect(
    features.map(f =>
      copyStarts(f.get('alignments') as Record<string, AlignmentRecord>),
    ),
  ).toEqual(BLOCKS.map(b => b.copies.map(([at]) => at)))
})

test('TAF keeps every copy', () => {
  const [{ ref, copies }] = BLOCKS
  const row = (sequenceName: string, start: number, strand: number) => ({
    sequenceName,
    start,
    strand,
    sequenceLength: 1e9,
    bases: ref[2],
    length: ref[2].length,
  })
  const feature = blockToFeature(
    {
      rows: [
        row(ref[0], ref[1], 1),
        ...copies.map(([at, s]) => row(CONTIG, at, s === '+' ? 1 : -1)),
      ],
      columnNumber: ref[2].length,
    },
    makeSourceResolver().resolve,
  )!
  expect(copyStarts(feature.alignments)).toEqual(copies.map(([at]) => at))
})

test('a focus on a sample ships its copy rows', async () => {
  const sink = new MafRegionSink(new Set(['HG01175.1']))
  const blocks = [...parseMafBlocks(`${MAF}\n`, makeSourceResolver().resolve)]
  await featureBlocks(
    of(
      ...blocks.map(
        b =>
          new SimpleFeature({
            uniqueId: b.uniqueId,
            refName: 'chr1',
            start: b.start,
            end: b.end,
            alignments: b.alignments,
            seq: b.seq,
          }),
      ),
    ),
    sink,
  )
  expect([...sink.discovered]).toEqual(['GRCh38', ...COPY_IDS])
  expect([...sink.packer.finishBlocks().sampleIds].toSorted()).toEqual(COPY_IDS)
})

test('withCopyRows puts copies after their sample in its colour', () => {
  const rows = withCopyRows(
    [
      { id: 'GRCh38', label: 'GRCh38' },
      { id: 'HG01175.1', label: 'HG01175 hap1', color: 'red' },
      { id: 'HG00097.1', label: 'HG00097.1' },
    ],
    ['GRCh38', 'HG01175.1', 'HG01175.1~2', 'HG00097.1', 'HG01175.1~3'],
  )
  expect(rows.map(r => [r.id, r.label, r.color])).toEqual([
    ['GRCh38', 'GRCh38', undefined],
    ['HG01175.1', 'HG01175 hap1', 'red'],
    ['HG01175.1~2', 'HG01175 hap1 copy 2', 'red'],
    ['HG01175.1~3', 'HG01175 hap1 copy 3', 'red'],
    ['HG00097.1', 'HG00097.1', undefined],
  ])
})

test('placeCopyRows moves a late-found copy next to its sample', () => {
  expect(
    placeCopyRows(['a', 'b', 'a~2', 'c~2'].map(name => ({ name }))).map(
      r => r.name,
    ),
  ).toEqual(['a', 'a~2', 'b', 'c~2'])
})
