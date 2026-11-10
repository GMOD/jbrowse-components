import { SPLICED_MARKS } from '../LinearMarkDisplay/markPlot.ts'
import { NORMAL_ROW_PROPORTION } from '../LinearMarkDisplay/markVocabulary.ts'

import type {
  MarkSnapshot,
  StepSnapshot,
} from '../LinearMarkDisplay/markProblems.ts'
import type { DefaultPlot } from '../LinearMarkDisplay/plotDefault.ts'
import type { PlotFields } from '../LinearMarkDisplay/scanPlotFields.ts'

/** A rect per feature. */
export const RECT_MARKS: MarkSnapshot[] = [{ mark: 'rect' }]

// the SO type domains2genome --gff3 and InterProScan's GFF3 write a domain hit as
const PROTEIN_MATCH = 'protein_match'

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
 * full height, with the protein matches placed over its coding exons at the
 * same height: the transcript marks state their own greys, keyed as UTR and
 * coding, so the display's color reaches the matches alone.
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
    transform: childOfType(PROTEIN_MATCH),
  },
]

const REPEAT_CLASS_FIELD = 'repClass'
const NAME_FIELD = 'name'
const TRANSCRIPT_FIELD = 'transcript'
const FAMILY_FIELD = 'name'

// the columns domains2genome writes on each protein feature of its BED
const PROTEIN_FEATURE_FIELDS = ['proteinStart', TRANSCRIPT_FIELD]

/**
 * A painting off the scanned fields: the formats it knows, then what the scan
 * found. Transcripts carrying protein matches (domains2genome --gff3) draw as
 * transcripts with the matches over them, a row per transcript `name`,
 * colored by family; protein features alone (domains2genome's BED) take a row
 * per `transcript` they sit on, colored by family; RepeatMasker rows take a
 * row per `repClass`. Any other file rows on the scan's `lane` field, the one
 * whose values each hold features that never overlap, and draws one lane
 * where the scan found none. An adapter listing several sources rows on them
 * before any of these. A feature's blocks are joined by a line where the
 * features are spliced, and each feature paints its own BED color where the
 * file states any.
 */
export function multiRowPlot(fields: PlotFields): DefaultPlot {
  const attributes = fields.attributes ?? []
  const carriesMatches = !!fields.childTypes?.includes(PROTEIN_MATCH)
  const placesProteins = PROTEIN_FEATURE_FIELDS.every(f =>
    attributes.includes(f),
  )
  return {
    marks: carriesMatches
      ? TRANSCRIPT_PROTEIN_MARKS
      : fields.spliced
        ? SPLICED_MARKS
        : RECT_MARKS,
    rows:
      fields.rows ??
      (carriesMatches && attributes.includes(NAME_FIELD)
        ? NAME_FIELD
        : placesProteins
          ? TRANSCRIPT_FIELD
          : attributes.includes(REPEAT_CLASS_FIELD)
            ? REPEAT_CLASS_FIELD
            : fields.lane),
    ...(fields.bedColored
      ? { color: { scale: { type: 'identity' } } }
      : carriesMatches || placesProteins
        ? { color: { field: FAMILY_FIELD } }
        : {}),
  }
}
