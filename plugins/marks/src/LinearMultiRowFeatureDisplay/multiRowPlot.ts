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

/**
 * A transcript as a gene track draws one, its exons thin under its coding
 * exons, with the protein matches placed on it over the top: the transcript
 * marks state their own greys, so the display's color reaches the matches
 * alone.
 */
export const TRANSCRIPT_PROTEIN_MARKS: MarkSnapshot[] = [
  {
    mark: { type: 'rect', height: { band: 0 } },
    encoding: { color: { value: '#777777' } },
  },
  {
    mark: { type: 'rect', height: { band: 0.25 } },
    transform: childOfType('exon'),
    encoding: { color: { value: '#c4c4c4' } },
  },
  {
    mark: { type: 'rect', height: { band: 0.45 } },
    transform: childOfType('CDS'),
    encoding: { color: { value: '#9a9a9a' } },
  },
  {
    mark: { type: 'rect', height: { band: NORMAL_ROW_PROPORTION } },
    transform: childOfType(PROTEIN_MATCH),
  },
]

const PREFERRED_ROWS_FIELD = 'repClass'
const FALLBACK_ROWS_FIELD = 'name'
const TRANSCRIPT_FIELD = 'transcript'
const FAMILY_FIELD = 'name'

// the columns domains2genome writes on each protein feature of its BED
const PROTEIN_FEATURE_FIELDS = ['proteinStart', TRANSCRIPT_FIELD]

/**
 * A painting off the scanned fields. Transcripts carrying protein matches
 * (domains2genome --gff3) draw as transcripts with the matches over them,
 * a row each, colored by family; protein features alone (domains2genome's
 * BED) take a row per transcript they sit on, colored by family. Otherwise
 * a row per adapter source where it lists several, else per `repClass`
 * where the features carry one, else per `name`; a feature's blocks joined
 * by a line where the features are spliced; and each feature its own BED
 * color where the file states any.
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
      (placesProteins
        ? TRANSCRIPT_FIELD
        : attributes.includes(PREFERRED_ROWS_FIELD)
          ? PREFERRED_ROWS_FIELD
          : FALLBACK_ROWS_FIELD),
    ...(fields.bedColored
      ? { color: { scale: { type: 'identity' } } }
      : carriesMatches || placesProteins
        ? { color: { field: FAMILY_FIELD } }
        : {}),
  }
}
