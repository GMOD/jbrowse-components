import { SPLICED_PLOT_EXAMPLE } from '../LinearMarkDisplay/markPlot.ts'
import { NORMAL_ROW_PROPORTION } from '../LinearMarkDisplay/markVocabulary.ts'

import type {
  MarkSnapshot,
  StepSnapshot,
} from '../LinearMarkDisplay/markProblems.ts'
import type { PlotExample } from '@jbrowse/core/configuration'

const childOfType = (type: string): StepSnapshot[] => [
  { type: 'flatten' },
  { type: 'filter', expr: `jexl:feature.type == '${type}'` },
]

// one scale for the exon and CDS marks, so the key lists both greys under
// one title; an exon shows only where no CDS covers it, which is the UTR
const TRANSCRIPT_PART_COLOR = {
  field: 'type',
  scale: {
    domain: ['exon', 'CDS'],
    range: ['#c4c4c4', '#9a9a9a'],
    names: ['UTR', 'coding'],
  },
  legend: { title: 'Transcript' },
}

/**
 * A transcript as a gene track draws one, its UTR thin and its coding exons
 * full height, with its protein matches (domains2genome --gff3, InterProScan's
 * GFF3) over its coding exons at the same height. The transcript marks state
 * their own greys, keyed as UTR and coding, so the display's color reaches
 * the matches alone.
 */
export const TRANSCRIPT_PROTEIN_MARKS: MarkSnapshot[] = [
  {
    mark: { type: 'rect', height: { band: 0 } },
    encoding: { color: { value: '#777777' } },
  },
  {
    mark: { type: 'rect', height: { band: 0.25 } },
    transform: childOfType('exon'),
    encoding: { color: TRANSCRIPT_PART_COLOR },
  },
  {
    mark: { type: 'rect', height: { band: NORMAL_ROW_PROPORTION } },
    transform: childOfType('CDS'),
    encoding: { color: TRANSCRIPT_PART_COLOR },
  },
  {
    mark: { type: 'rect', height: { band: NORMAL_ROW_PROPORTION } },
    transform: childOfType('protein_match'),
  },
]

/**
 * A row per transcript `name`, drawn as a transcript with its protein matches
 * over it, each match colored by its family's `name`.
 */
export const TRANSCRIPT_PROTEIN_PLOT = {
  rows: 'name',
  marks: TRANSCRIPT_PROTEIN_MARKS,
  encoding: { color: { field: 'name' } },
}

/** What "Edit plot..." offers as buttons on a multi-row feature track. */
export const MULTI_ROW_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "encoding": { "color": "strand" } }',
    description: 'forward strand red, reverse blue',
  },
  {
    plot: '{ "encoding": { "color": { "value": "#1f77b4" } } }',
    description: 'one color for everything',
  },
  {
    plot: SPLICED_PLOT_EXAMPLE,
    description: "each feature's blocks joined by a line",
  },
  {
    plot: JSON.stringify(TRANSCRIPT_PROTEIN_PLOT),
    description:
      'a row per transcript, its protein domains over its coding exons',
  },
]
