import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  ALL_VS_ALL,
  CONTIG_SWAP,
  GENE_BLOCKS,
  INV_INDELS,
  STAR,
  SYRI,
} from '../synteny.fixture.ts'
import {
  chromSizesAssembly,
  fastaAssembly,
  fileUri,
} from './comparative/testEnv.ts'

import type { AssemblyConfig, ComparativeAxis } from './comparative/testEnv.ts'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'

export interface ComparativeFixture {
  adapterConfig: Record<string, unknown>
  query: ComparativeAxis
  target: ComparativeAxis
}

const VOLVOX = fastaAssembly('volvox', 'test_data/volvox/volvox.fa')
const VOLVOX_INV = fastaAssembly(
  'volvox_random_inv',
  'test_data/volvox/output_prefix3.simseq.genome.fa',
)

const CTGA_INV = { refName: 'ctgA', start: 0, end: 49186 }
const CTGA = { refName: 'ctgA', start: 0, end: 50001 }
const CTGB = { refName: 'ctgB', start: 0, end: 6079 }

/**
 * Seven minimap2 blocks of a volvox with an inversion and indels against
 * volvox ctgA, two reverse, five carrying `zd`, the first three a text `gr`
 * of `a` or `b` and the rest none, and every one `tp`, `P` or `I`.
 */
function labelledInversions() {
  const lines = readFileSync(
    path.resolve('test_data/volvox/volvox_inv_indels.paf'),
    'utf8',
  )
    .trim()
    .split('\n')
    .map((line, i) => (i < 3 ? `${line}\tgr:Z:${i % 2 ? 'b' : 'a'}` : line))
  const dir = mkdtempSync(path.join(tmpdir(), 'parity-paf-'))
  const paf = path.join(dir, 'labelled.paf')
  writeFileSync(paf, `${lines.join('\n')}\n`)
  return {
    ...INV_INDELS.adapterConfig,
    pafLocation: fileUri(paf),
    attributeColumns: ['gr', 'zd', 'tp'],
  }
}

/** Both whole contigs at 800 px, all but one indel sub-pixel. */
export const INVERSIONS: ComparativeFixture = {
  adapterConfig: labelledInversions(),
  query: { assembly: VOLVOX_INV, regions: [CTGA_INV], width: 800 },
  target: { assembly: VOLVOX, regions: [CTGA], width: 800 },
}

/** Both whole contigs at 4000 px, wide enough for a dotplot's CIGAR steps. */
export const INVERSIONS_WIDE: ComparativeFixture = {
  ...INVERSIONS,
  query: { ...INVERSIONS.query, width: 4000 },
  target: { ...INVERSIONS.target, width: 4000 },
}

/** 3 kb of each at 800 px, inside the first block, its indels drawn. */
export const INVERSIONS_ZOOMED: ComparativeFixture = {
  ...INVERSIONS,
  query: {
    assembly: VOLVOX_INV,
    regions: [{ refName: 'ctgA', start: 27000, end: 30000 }],
    width: 800,
  },
  target: {
    assembly: VOLVOX,
    regions: [{ refName: 'ctgA', start: 27450, end: 30450 }],
    width: 800,
  },
}

/**
 * 3.2 kb of each at 800 px, the second block ending at query 15925, 1 px
 * left of the horizontal window, inside the round cap a dotplot line keeps.
 */
export const INVERSIONS_EDGE: ComparativeFixture = {
  ...INVERSIONS,
  query: {
    assembly: VOLVOX_INV,
    regions: [{ refName: 'ctgA', start: 15929, end: 19129 }],
    width: 800,
  },
  target: {
    assembly: VOLVOX,
    regions: [{ refName: 'ctgA', start: 15000, end: 18200 }],
    width: 800,
  },
}

/**
 * 3 kb of each, the upper row inside the first block and the lower inside
 * the second, so each row's ribbons run to mates past the other row's
 * overdraw: the band culls them and its strips mark them.
 */
export const INVERSIONS_APART: ComparativeFixture = {
  ...INVERSIONS_ZOOMED,
  target: {
    assembly: VOLVOX,
    regions: [{ refName: 'ctgA', start: 10_000, end: 13_000 }],
    width: 800,
  },
}

/**
 * volvox ctgA against ctgB and back, both rows showing ctgB then ctgA, the
 * reverse of the assembly's order.
 */
export const CONTIGS: ComparativeFixture = {
  adapterConfig: CONTIG_SWAP.adapterConfig,
  query: { assembly: VOLVOX, regions: [CTGB, CTGA], width: 800 },
  target: { assembly: VOLVOX, regions: [CTGB, CTGA], width: 800 },
}

/** Both rows on ctgA, so each block's mate is on a contig neither shows. */
export const OFFSCREEN: ComparativeFixture = {
  adapterConfig: CONTIG_SWAP.adapterConfig,
  query: { assembly: VOLVOX, regions: [CTGA], width: 800 },
  target: { assembly: VOLVOX, regions: [CTGA], width: 800 },
}

/** 4 kb of ctgA on the upper row, inside the contig, its mates on ctgB. */
export const OFFSCREEN_WINDOW: ComparativeFixture = {
  ...OFFSCREEN,
  query: {
    assembly: VOLVOX,
    regions: [{ refName: 'ctgA', start: 4000, end: 8000 }],
    width: 800,
  },
}

/** A multi-way track's adapter, the anchor it shows, and every lane's genome. */
export interface MultiwayFixture {
  adapterConfig: Record<string, unknown>
  assemblies: AssemblyConfig[]
  anchor: {
    assemblyName: string
    regions: TablesRegion[]
    displayedRegions?: TablesRegion[]
    width: number
  }
}

const VOLVOX_LANES = [
  VOLVOX,
  fastaAssembly('volvox_ins', 'test_data/volvox/volvox_ins.fa'),
  fastaAssembly('volvox_del', 'test_data/volvox/volvox_del.fa'),
]

/** volvox, an insertion and a deletion, each against the others. */
export const ALL_VS_ALL_LANES: MultiwayFixture = {
  adapterConfig: ALL_VS_ALL.adapterConfig,
  assemblies: VOLVOX_LANES,
  anchor: { assemblyName: 'volvox', regions: [CTGA], width: 800 },
}

/** 4 kb of volvox around the insertion, its CIGAR steps wide enough to draw. */
export const ALL_VS_ALL_ZOOMED: MultiwayFixture = {
  ...ALL_VS_ALL_LANES,
  anchor: {
    assemblyName: 'volvox',
    regions: [{ refName: 'ctgA', start: 29_000, end: 33_000 }],
    width: 800,
  },
}

/**
 * 4 kb of volvox just past the deletion. The static blocks fetched start
 * inside it, so the viewport edge cuts volvox_del's record past the tail of
 * the deletion it carries.
 */
export const ALL_VS_ALL_PAST_DELETION: MultiwayFixture = {
  ...ALL_VS_ALL_LANES,
  anchor: {
    assemblyName: 'volvox',
    regions: [{ refName: 'ctgA', start: 34_000, end: 38_000 }],
    width: 800,
  },
}

/**
 * The all-vs-all PAF with the insertion's first match spelled as `=` and `X`
 * runs: two mismatches, 10 bp and 3 bp, under the zoomed window.
 */
function allVsAllMismatches() {
  const lines = readFileSync(
    path.resolve('test_data/volvox/volvox_all_vs_all.paf'),
    'utf8',
  )
    .trim()
    .split('\n')
    .map((line, i) =>
      i === 0 ? line.replace('cg:Z:31198M', 'cg:Z:30000=10X1000=3X185=') : line,
    )
  const dir = mkdtempSync(path.join(tmpdir(), 'parity-paf-'))
  const paf = path.join(dir, 'mismatches.paf')
  writeFileSync(paf, `${lines.join('\n')}\n`)
  return { ...ALL_VS_ALL.adapterConfig, pafLocation: fileUri(paf) }
}

/** The zoomed window, its insertion lane carrying two mismatch runs. */
export const ALL_VS_ALL_MISMATCHES: MultiwayFixture = {
  ...ALL_VS_ALL_ZOOMED,
  adapterConfig: allVsAllMismatches(),
}

/** volvox ctgB, which no lane aligns to. */
export const ALL_VS_ALL_UNALIGNED: MultiwayFixture = {
  ...ALL_VS_ALL_LANES,
  anchor: { assemblyName: 'volvox', regions: [CTGB], width: 800 },
}

/**
 * volvox ctgB's first 4 kb, with ctgA displayed before it, so the static
 * blocks fetched left of the window reach ctgA's end, which every lane aligns
 * to.
 */
export const TWO_CONTIGS_DISPLAYED: MultiwayFixture = {
  ...ALL_VS_ALL_LANES,
  anchor: {
    assemblyName: 'volvox',
    regions: [{ refName: 'ctgB', start: 0, end: 4000 }],
    displayedRegions: [CTGA, CTGB],
    width: 800,
  },
}

/** Two pairwise PAFs, each lane stated against volvox alone. */
export const STAR_LANES: MultiwayFixture = {
  adapterConfig: STAR.adapterConfig,
  assemblies: VOLVOX_LANES,
  anchor: { assemblyName: 'volvox', regions: [CTGA], width: 800 },
}

/** SyRI's calls for five accessions under Col-0 Chr1. */
export const SYRI_LANES: MultiwayFixture = {
  adapterConfig: SYRI.adapterConfig,
  assemblies: ['Col-0', 'Ler', 'Cvi', 'Eri', 'Kyo', 'Sha'].map(name =>
    chromSizesAssembly(name, `test_data/syri/${name}.chrom.sizes`),
  ),
  anchor: {
    assemblyName: 'Col-0',
    regions: [{ refName: 'Chr1', start: 0, end: 30_427_671 }],
    width: 800,
  },
}

/** Four grape genes, three placed on peach and three on cacao. */
export const GENE_BLOCK_LANES: MultiwayFixture = {
  adapterConfig: GENE_BLOCKS.adapterConfig,
  assemblies: ['grape', 'peach', 'cacao'].map(name =>
    chromSizesAssembly(name, `test_data/multiway_blocks/${name}.chrom.sizes`),
  ),
  anchor: {
    assemblyName: 'grape',
    regions: [{ refName: 'chr1', start: 0, end: 1000 }],
    width: 800,
  },
}

/**
 * Grape's four genes, each on one of two peach contigs: g2 and g3 on Pp1,
 * under the window, and g1 and g4 on Pp2, in the static blocks fetched past
 * either side of it. `aliased`, the peach bed spells the contigs `1` and `2`,
 * which peach's alias file maps onto Pp1 and Pp2, and peach's display name is
 * Peach.
 */
function copiesInTheMargin({ aliased = false } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'parity-copies-'))
  const write = (name: string, lines: string[]) => {
    const file = path.join(dir, name)
    writeFileSync(file, `${lines.join('\n')}\n`)
    return file
  }
  const genes = [
    ['1', 'Pp2', 100],
    ['2', 'Pp1', 300],
    ['3', 'Pp1', 500],
    ['4', 'Pp2', 700],
  ] as const
  const blocks = write(
    'grape.blocks',
    genes.map(([n]) => `g${n}\tp${n}`),
  )
  const bedName = (refName: string) =>
    aliased ? refName.replace('Pp', '') : refName
  const peachBed = write(
    'peach.bed',
    genes.map(
      ([n, refName, start]) =>
        `${bedName(refName)}\t${start}\t${start + 100}\tp${n}\t0\t+`,
    ),
  )
  const peachSizes = write('peach.chrom.sizes', ['Pp1\t1000', 'Pp2\t1000'])
  const peach = chromSizesAssembly('peach', peachSizes)
  return {
    adapterConfig: {
      type: 'MCScanBlocksAdapter',
      mcscanBlocksLocation: fileUri(blocks),
      blockAssemblies: ['grape', 'peach'],
      bedLocations: [
        fileUri('test_data/multiway_blocks/grape.bed'),
        fileUri(peachBed),
      ],
      assemblyNames: ['grape', 'peach'],
    },
    assemblies: [
      chromSizesAssembly(
        'grape',
        'test_data/multiway_blocks/grape.chrom.sizes',
      ),
      aliased
        ? {
            ...peach,
            displayName: 'Peach',
            refNameAliases: {
              adapter: {
                type: 'RefNameAliasAdapter',
                location: fileUri(
                  write('peach.aliases.txt', ['Pp1\t1', 'Pp2\t2']),
                ),
              },
            },
          }
        : peach,
    ],
  }
}

/** grape chr1:250..650, its Pp2 copy's genes all past the window. */
export const COPIES_IN_THE_MARGIN: MultiwayFixture = {
  ...copiesInTheMargin(),
  anchor: {
    assemblyName: 'grape',
    regions: [{ refName: 'chr1', start: 250, end: 650 }],
    width: 800,
  },
}

/** As COPIES_IN_THE_MARGIN, its peach contigs spelled by alias in the bed. */
export const ALIASED_COPIES: MultiwayFixture = {
  ...copiesInTheMargin({ aliased: true }),
  anchor: COPIES_IN_THE_MARGIN.anchor,
}
