import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type { DotplotTablesArgs, SyntenyTablesArgs } from './index.ts'

const VOLVOX = path.resolve('test_data/volvox')
const uri = (file: string) => ({
  uri: pathToFileURL(path.join(VOLVOX, file)).href,
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
