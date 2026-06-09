import { doesIntersect2, max, min } from '@jbrowse/core/util'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export type Strand = '+' | '-' | '.' | '?'
export interface FeatureLoc {
  [key: string]: unknown
  start: number
  end: number
  strand: Strand
  seq_name: string
  child_features?: FeatureLoc[][]
  attributes: Record<string, unknown[]>
}

const strandMap = { '+': 1, '-': -1, '.': 0, '?': undefined } as const

// structural output fields an attribute must not overwrite; a clashing
// attribute key gets a `2` suffix instead (compared lowercase, so camelCase
// output fields like refName never collide)
const reservedFields = new Set([
  'type',
  'source',
  'start',
  'end',
  'strand',
  'score',
  'phase',
])

export function featureData(
  data: FeatureLoc,
  id?: string,
): Record<string, unknown> {
  // process attributes: lowercase keys, suffix clashes with reserved fields,
  // strip GTF double-quotes from every value, unwrap single-element arrays
  const processedAttrs = Object.fromEntries(
    Object.entries(data.attributes).map(([a, vals]) => {
      const lower = a.toLowerCase()
      const key = reservedFields.has(lower) ? `${lower}2` : lower
      const dequoted = vals.map(v => String(v).replaceAll(/^"|"$/g, ''))
      return [key, dequoted.length === 1 ? dequoted[0] : dequoted] as const
    }),
  )

  const subfeatures = data.child_features?.length
    ? data.child_features.flatMap(childLocs =>
        childLocs.map(childLoc => featureData(childLoc)),
      )
    : undefined

  // build the output explicitly rather than spreading `data` and clearing its
  // raw parser fields, which would leave them as `undefined`-valued keys
  return {
    refName: data.seq_name,
    type: data.featureType,
    source: data.source,
    start: data.start - 1,
    end: data.end,
    strand: strandMap[data.strand],
    score: data.score === null ? undefined : data.score,
    phase: data.frame !== null ? Number(data.frame) : undefined,
    ...processedAttrs,
    ...(subfeatures !== undefined && { subfeatures }),
    ...(processedAttrs.transcript_id && { name: processedAttrs.transcript_id }),
    ...(id !== undefined && { uniqueId: id }),
  }
}

function toStrand(s: string | undefined): Strand {
  return s === '+' || s === '-' || s === '?' ? s : '.'
}

function nullIfDot(s: string | undefined) {
  return s === undefined || s === '.' ? null : s
}

/**
 * Parse the GTF 9th column (`gene_id "X"; transcript_id "Y";`). Each `key
 * "value"` entry contributes one value; GTF expresses multiple values per key
 * via repeated keys (`tag "A"; tag "B"`), not comma separation, so the value is
 * taken whole (a comma inside it, e.g. `note "a, b"`, stays intact). Values keep
 * their surrounding quotes here; quote stripping happens in featureData.
 */
function parseGtfAttributes(attrString: string) {
  const attrs: Record<string, string[]> = {}
  if (attrString.length > 0 && attrString !== '.') {
    for (const entry of attrString.split(';')) {
      const trimmed = entry.trim()
      const sp = trimmed.indexOf(' ')
      if (sp !== -1) {
        const key = trimmed.slice(0, sp)
        const value = trimmed.slice(sp + 1).trim()
        if (value.length > 0) {
          ;(attrs[key] ??= []).push(value)
        }
      }
    }
  }
  return attrs
}

function parseGtfLine(line: string): FeatureLoc {
  const c = line.split('\t')
  const score = c[5]
  return {
    seq_name: c[0] ?? '',
    source: nullIfDot(c[1]),
    featureType: nullIfDot(c[2]),
    start: Number(c[3]),
    end: Number(c[4]),
    score: score === undefined || score === '.' ? null : Number(score),
    strand: toStrand(c[6]),
    frame: nullIfDot(c[7]),
    attributes: parseGtfAttributes(c[8] ?? ''),
  }
}

function unquote(value: unknown) {
  return typeof value === 'string' ? value.replaceAll(/^"|"$/g, '') : undefined
}

// a transcript with no explicit line carries only the gene/transcript-level
// attributes needed for grouping and display, not its children's exon fields
const SYNTHESIZED_TRANSCRIPT_ATTRS = ['gene_id', 'transcript_id', 'gene_name']

function synthesizeTranscript(child: FeatureLoc): FeatureLoc {
  const attributes: Record<string, unknown[]> = {}
  for (const key of SYNTHESIZED_TRANSCRIPT_ATTRS) {
    const value = child.attributes[key]
    if (value) {
      attributes[key] = value
    }
  }
  return {
    seq_name: child.seq_name,
    source: child.source,
    featureType: 'transcript',
    start: child.start,
    end: child.end,
    score: null,
    strand: child.strand,
    frame: null,
    attributes,
    child_features: [],
  }
}

/**
 * Parse GTF text into top-level features. Lines sharing a `transcript_id` are
 * grouped under a transcript feature (synthesized if the file has no explicit
 * `transcript` line, per the Cufflinks/StringTie convention); the transcript is
 * spanned to cover its children. Lines without a `transcript_id` (e.g. a `gene`
 * line) pass through as standalone features.
 */
export function parseGtf(input: string): FeatureLoc[] {
  const topLevel: FeatureLoc[] = []
  const byTranscript = new Map<string, FeatureLoc>()
  for (const line of input.split('\n')) {
    if (line.length > 0 && !line.startsWith('#')) {
      const feat = parseGtfLine(line)
      const transcriptId = unquote(feat.attributes.transcript_id?.[0])
      if (transcriptId === undefined) {
        topLevel.push(feat)
      } else if (feat.featureType === 'transcript') {
        const existing = byTranscript.get(transcriptId)
        if (existing) {
          // explicit transcript line seen after its children: keep the
          // collected children, but use the explicit line as the container
          feat.child_features = existing.child_features
          feat.start = Math.min(feat.start, existing.start)
          feat.end = Math.max(feat.end, existing.end)
          topLevel[topLevel.indexOf(existing)] = feat
        } else {
          feat.child_features = []
          topLevel.push(feat)
        }
        byTranscript.set(transcriptId, feat)
      } else {
        let transcript = byTranscript.get(transcriptId)
        if (!transcript) {
          transcript = synthesizeTranscript(feat)
          topLevel.push(transcript)
          byTranscript.set(transcriptId, transcript)
        }
        transcript.child_features!.push([feat])
        transcript.start = Math.min(transcript.start, feat.start)
        transcript.end = Math.max(transcript.end, feat.end)
      }
    }
  }
  return topLevel
}

/** Read the feature type (column 3) from a raw GTF line without a full split. */
export function extractType(line: string) {
  const t1 = line.indexOf('\t')
  const t2 = line.indexOf('\t', t1 + 1)
  const t3 = line.indexOf('\t', t2 + 1)
  return line.slice(t2 + 1, t3)
}

/**
 * GTF has no spanning gene line, so a gene is synthesized by grouping transcript
 * features that share `aggregateField` (e.g. gene_name) and spanning them. Any
 * explicit `gene` line is dropped, since the parser leaves it childless and the
 * synthesized parent supersedes it; a childless `transcript` line is dropped too
 * (e.g. AUGUSTUS emits a bare `transcript` line whose 9th column has no parseable
 * attributes). Features without the aggregate field pass through unchanged.
 */
export function aggregateGtfFeatures({
  feats,
  aggregateField,
  refName,
  regionStart,
  regionEnd,
}: {
  feats: SimpleFeatureSerialized[]
  aggregateField: string
  refName: string
  regionStart: number
  regionEnd: number
}): SimpleFeatureSerialized[] {
  const out: SimpleFeatureSerialized[] = []
  const parentAggregation: Record<string, SimpleFeatureSerialized[]> = {}
  for (const feat of feats) {
    const childlessTranscript =
      feat.type === 'transcript' && !feat.subfeatures?.length
    if (feat.type !== 'gene' && !childlessTranscript) {
      const aggr = feat[aggregateField]
      if (typeof aggr === 'string' && aggr.length > 0) {
        ;(parentAggregation[aggr] ??= []).push(feat)
      } else {
        out.push(feat)
      }
    }
  }

  for (const [name, subfeatures] of Object.entries(parentAggregation)) {
    const start = min(subfeatures.map(f => f.start))
    const end = max(subfeatures.map(f => f.end))
    if (doesIntersect2(start, end, regionStart, regionEnd)) {
      const { uniqueId, strand } = subfeatures[0]!
      out.push({
        type: 'gene',
        subfeatures,
        strand,
        name,
        start,
        end,
        refName,
        uniqueId: `${uniqueId}-parent`,
      })
    }
  }
  return out
}
