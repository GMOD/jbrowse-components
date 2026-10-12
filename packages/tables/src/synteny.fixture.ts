import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type {
  DotplotTablesArgs,
  MultiWayTablesArgs,
  SyntenyTablesArgs,
} from './index.ts'

const VOLVOX = path.resolve('test_data/volvox')
const uri = (file: string, dir = VOLVOX) => ({
  uri: pathToFileURL(path.join(dir, file)).href,
  locationType: 'UriLocation',
})

const CTGA_INV = { refName: 'ctgA', start: 0, end: 49186 }
const CTGA = { refName: 'ctgA', start: 0, end: 50001 }

/**
 * Seven minimap2 blocks of a simulated volvox with an inversion and indels
 * against volvox ctgA, two on the reverse strand, each with a CIGAR.
 */
export const INV_INDELS: SyntenyTablesArgs = {
  adapterConfig: {
    type: 'PAFAdapter',
    pafLocation: uri('volvox_inv_indels.paf'),
    queryAssembly: 'volvox_random_inv',
    targetAssembly: 'volvox',
  },
  query: { regions: [CTGA_INV], width: 800 },
  target: { regions: [CTGA], width: 800 },
}

export const INV_INDELS_DOTPLOT: DotplotTablesArgs = {
  adapterConfig: INV_INDELS.adapterConfig,
  x: { regions: [CTGA_INV], width: 600 },
  y: { regions: [CTGA], width: 600 },
}

/** ctgA of one volvox against ctgB of another and back, a self-alignment. */
export const CONTIG_SWAP: SyntenyTablesArgs = {
  adapterConfig: {
    type: 'PAFAdapter',
    pafLocation: uri('volvox_contig_swap.paf'),
    assemblyNames: ['volvox', 'volvox'],
  },
  query: { regions: [CTGA], width: 800 },
  target: { regions: [{ refName: 'ctgB', start: 0, end: 6079 }], width: 800 },
}

/**
 * volvox with a 4.8 kb insertion and a 4.86 kb deletion, each aligned to
 * volvox and to each other, under volvox ctgA.
 */
export const ALL_VS_ALL: MultiWayTablesArgs = {
  adapterConfig: {
    type: 'MultiGenomePAFAdapter',
    pafLocation: uri('volvox_all_vs_all.paf'),
  },
  anchor: { assemblyName: 'volvox', regions: [CTGA], width: 800 },
}

/**
 * SyRI's calls for five Arabidopsis accessions against Col-0 and each
 * against the next, under Col-0 Chr1.
 */
export const SYRI: MultiWayTablesArgs = {
  adapterConfig: {
    type: 'MultiGenomePAFAdapter',
    pafLocation: uri('syri_pangenome.paf', path.resolve('test_data/syri')),
    attributeColumns: ['syri', 'color'],
  },
  anchor: {
    assemblyName: 'Col-0',
    regions: [{ refName: 'Chr1', start: 0, end: 30_427_671 }],
    width: 800,
  },
  display: {
    rows: { domain: ['Ler', 'Cvi', 'Eri', 'Kyo', 'Sha'] },
    ribbonColor: {
      field: 'syri',
      domain: ['SYN', 'INV', 'TRANS', 'INVTR', 'DUP', 'INVDP'],
    },
  },
}

const BLOCKS = path.resolve('test_data/multiway_blocks')

/** Four grape genes, three placed on peach and three on cacao. */
export const GENE_BLOCKS: MultiWayTablesArgs = {
  adapterConfig: {
    type: 'MCScanBlocksAdapter',
    mcscanBlocksLocation: uri('grape.blocks', BLOCKS),
    blockAssemblies: ['grape', 'peach', 'cacao'],
    bedLocations: ['grape', 'peach', 'cacao'].map(n => uri(`${n}.bed`, BLOCKS)),
    assemblyNames: ['grape', 'peach', 'cacao'],
  },
  anchor: { regions: [{ refName: 'chr1', start: 0, end: 1000 }], width: 800 },
}

/** Two pairwise PAFs against volvox, which state each lane against it alone. */
export const STAR: MultiWayTablesArgs = {
  adapterConfig: {
    type: 'MultiPairwiseSyntenyAdapter',
    adapters: ['volvox_ins', 'volvox_del'].map(name => ({
      type: 'PAFAdapter',
      pafLocation: uri(`${name}_cs.paf`),
      assemblyNames: [name, 'volvox'],
    })),
  },
  anchor: { assemblyName: 'volvox', regions: [CTGA], width: 800 },
}
