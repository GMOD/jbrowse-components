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
  description: string
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
  cds: {
    ...spliced,
    seqtype: 'cds',
    label: () => 'CDS',
    description: 'the coding sequence, its CDS parts joined',
  },
  protein: {
    ...spliced,
    seqtype: 'protein',
    label: () => 'Protein',
    description:
      "the CDS translated with the feature's transl_table, else the assembly's genetic code, applying any transl_except",
  },
  cdna: {
    ...spliced,
    seqtype: 'cdna',
    label: () => 'cDNA',
    description: "the transcript's exons joined, UTRs included",
  },
  gene: {
    ...genomic,
    seqtype: 'cdna',
    introns: true,
    label: () => 'Genomic w/ full introns',
    description: 'the whole transcript with its introns',
  },
  gene_updownstream: {
    ...genomic,
    seqtype: 'cdna',
    introns: true,
    upDownstream: true,
    label: ({ upDownBp }) =>
      `Genomic w/ full introns +/- ${upDownBp}bp up+down stream`,
    description:
      'the whole transcript with its introns, plus flanking sequence on each side',
  },
  gene_collapsed_intron: {
    ...genomic,
    seqtype: 'cdna',
    introns: true,
    collapsedIntrons: true,
    genomicCoords: false,
    label: ({ intronBp }) => `Genomic w/ ${intronBp}bp intron`,
    description:
      'the transcript with each intron cut to the bases at either end',
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
    description:
      'the transcript with each intron cut short, plus flanking sequence on each side',
  },
  genomic: {
    ...genomic,
    seqtype: 'genomic',
    label: () => 'Genomic',
    description: 'the reference sequence under the feature',
  },
  genomic_sequence_updownstream: {
    ...genomic,
    seqtype: 'genomic',
    upDownstream: true,
    label: ({ upDownBp }) => `Genomic +/- ${upDownBp}bp up+down stream`,
    description:
      'the reference sequence under the feature, plus flanking sequence on each side',
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
