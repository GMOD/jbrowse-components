import type { SequenceDisplayMode } from './model.ts'

export interface SequenceModeBasePairs {
  intronBp: number
  upDownBp: number
}

interface SequenceModeTraits {
  introns: boolean
  collapsedIntrons: boolean
  upDownstream: boolean
  revcomp: boolean
  genomicCoords: boolean
  label: (bp: SequenceModeBasePairs) => string
}

const spliced = {
  introns: false,
  collapsedIntrons: false,
  upDownstream: false,
  revcomp: false,
  genomicCoords: false,
} as const

const genomic = {
  introns: false,
  collapsedIntrons: false,
  upDownstream: false,
  revcomp: true,
  genomicCoords: true,
} as const

export const sequenceModes: Record<SequenceDisplayMode, SequenceModeTraits> = {
  cds: { ...spliced, label: () => 'CDS' },
  protein: { ...spliced, label: () => 'Protein' },
  cdna: { ...spliced, label: () => 'cDNA' },
  gene: {
    ...genomic,
    introns: true,
    label: () => 'Genomic w/ full introns',
  },
  gene_updownstream: {
    ...genomic,
    introns: true,
    upDownstream: true,
    label: ({ upDownBp }) =>
      `Genomic w/ full introns +/- ${upDownBp}bp up+down stream`,
  },
  gene_collapsed_intron: {
    ...genomic,
    introns: true,
    collapsedIntrons: true,
    genomicCoords: false,
    label: ({ intronBp }) => `Genomic w/ ${intronBp}bp intron`,
  },
  gene_updownstream_collapsed_intron: {
    ...genomic,
    introns: true,
    collapsedIntrons: true,
    upDownstream: true,
    genomicCoords: false,
    label: ({ intronBp, upDownBp }) =>
      `Genomic w/ ${intronBp}bp intron +/- ${upDownBp}bp up+down stream`,
  },
  genomic: { ...genomic, label: () => 'Genomic' },
  genomic_sequence_updownstream: {
    ...genomic,
    upDownstream: true,
    label: ({ upDownBp }) => `Genomic +/- ${upDownBp}bp up+down stream`,
  },
}
