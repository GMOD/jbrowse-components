export interface SequenceModeBasePairs {
  intronBp: number
  upDownBp: number
}

export type SeqType = 'cds' | 'protein' | 'cdna' | 'genomic'

interface SequenceModeTraits {
  seqtype: SeqType
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

const modes = {
  cds: { ...spliced, seqtype: 'cds', label: () => 'CDS' },
  protein: { ...spliced, seqtype: 'protein', label: () => 'Protein' },
  cdna: { ...spliced, seqtype: 'cdna', label: () => 'cDNA' },
  gene: {
    ...genomic,
    seqtype: 'cdna',
    introns: true,
    label: () => 'Genomic w/ full introns',
  },
  gene_updownstream: {
    ...genomic,
    seqtype: 'cdna',
    introns: true,
    upDownstream: true,
    label: ({ upDownBp }) =>
      `Genomic w/ full introns +/- ${upDownBp}bp up+down stream`,
  },
  gene_collapsed_intron: {
    ...genomic,
    seqtype: 'cdna',
    introns: true,
    collapsedIntrons: true,
    genomicCoords: false,
    label: ({ intronBp }) => `Genomic w/ ${intronBp}bp intron`,
  },
  gene_updownstream_collapsed_intron: {
    ...genomic,
    seqtype: 'cdna',
    introns: true,
    collapsedIntrons: true,
    upDownstream: true,
    genomicCoords: false,
    label: ({ intronBp, upDownBp }) =>
      `Genomic w/ ${intronBp}bp intron +/- ${upDownBp}bp up+down stream`,
  },
  genomic: { ...genomic, seqtype: 'genomic', label: () => 'Genomic' },
  genomic_sequence_updownstream: {
    ...genomic,
    seqtype: 'genomic',
    upDownstream: true,
    label: ({ upDownBp }) => `Genomic +/- ${upDownBp}bp up+down stream`,
  },
} satisfies Record<string, SequenceModeTraits>

export type SequenceDisplayMode = keyof typeof modes

export const sequenceModes: Record<SequenceDisplayMode, SequenceModeTraits> =
  modes

export function isSequenceDisplayMode(val: string): val is SequenceDisplayMode {
  return Object.hasOwn(sequenceModes, val)
}

/** in the order the sequence type selector lists them */
export const sequenceModeNames = Object.keys(sequenceModes).filter(
  isSequenceDisplayMode,
)
