import { doesIntersect2, max, min } from '@jbrowse/core/util'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export type Strand = '+' | '-' | '.' | '?'
export interface FeatureLoc {
  start: number
  end: number
  strand: Strand
  seq_name: string
  featureType?: string | null
  source?: string | null
  score?: number | null
  frame?: string | null
  child_features?: FeatureLoc[][]
  attributes: Record<string, string[]>
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
  // lowercase keys, suffix clashes with reserved fields, unwrap single-element
  // arrays (quotes were already stripped at parse time)
  const processedAttrs = Object.fromEntries(
    Object.entries(data.attributes).map(([a, vals]) => {
      const lower = a.toLowerCase()
      const key = reservedFields.has(lower) ? `${lower}2` : lower
      return [key, vals.length === 1 ? vals[0] : vals] as const
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
    score: data.score ?? undefined,
    phase: data.frame ? Number(data.frame) : undefined,
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
 * taken whole (a comma inside it, e.g. `note "a, b"`, stays intact). Surrounding
 * double-quotes are stripped here.
 */
function parseGtfAttributes(attrString: string) {
  const attrs: Record<string, string[]> = {}
  if (attrString.length > 0 && attrString !== '.') {
    for (const entry of attrString.split(';')) {
      const trimmed = entry.trim()
      const sp = trimmed.indexOf(' ')
      if (sp !== -1) {
        const key = trimmed.slice(0, sp)
        const value = trimmed
          .slice(sp + 1)
          .trim()
          .replaceAll(/^"|"$/g, '')
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

// a transcript with no explicit line carries only the gene/transcript-level
// attributes needed for grouping and display, not its children's exon fields
const SYNTHESIZED_TRANSCRIPT_ATTRS = ['gene_id', 'transcript_id', 'gene_name']

function synthesizeTranscript(child: FeatureLoc): FeatureLoc {
  const attributes: Record<string, string[]> = {}
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

/** A raw GTF feature line; callers may extend it with their own identity. */
export interface GtfLineRecord {
  line: string
}

/**
 * A top-level parsed feature paired with the record it came from. The parser
 * stamps no identity onto the feature; callers that need a stable per-feature
 * id (e.g. a tabix byte offset) read it off their own `record`. Mirrors
 * gff-nostream's `ParsedRecord`.
 */
export interface ParsedGtfRecord<R extends GtfLineRecord = GtfLineRecord> {
  feature: FeatureLoc
  record: R
}

/**
 * Parse an array of records wrapping raw GTF lines into top-level features.
 * Lines sharing a `transcript_id` are grouped under a transcript feature
 * (synthesized if the file has no explicit `transcript` line, per the
 * Cufflinks/StringTie convention); the transcript is spanned to cover its
 * children. Lines without a `transcript_id` (e.g. a `gene` line) pass through
 * as standalone features. Each top-level feature is returned paired with the
 * record that defined it (the explicit line, or a synthesized transcript's
 * first child), so callers can attach a stable id.
 */
export function parseGtf<R extends GtfLineRecord>(
  records: readonly R[],
): ParsedGtfRecord<R>[] {
  const topLevel: ParsedGtfRecord<R>[] = []
  const byTranscript = new Map<string, ParsedGtfRecord<R>>()
  for (const record of records) {
    // tabix-read lines retain the trailing \r of CRLF files (unlike the
    // plaintext path, which trims it); left in, it corrupts the final
    // attribute value, e.g. transcript_id "t1"\r
    const line = record.line.endsWith('\r')
      ? record.line.slice(0, -1)
      : record.line
    if (line.length > 0 && !line.startsWith('#')) {
      const feature = parseGtfLine(line)
      const transcriptId = feature.attributes.transcript_id?.[0]
      if (transcriptId === undefined) {
        topLevel.push({ feature, record })
      } else if (feature.featureType === 'transcript') {
        const existing = byTranscript.get(transcriptId)
        if (existing) {
          // explicit transcript line seen after its children: keep the
          // collected children, but use the explicit line as the container
          feature.child_features = existing.feature.child_features
          feature.start = Math.min(feature.start, existing.feature.start)
          feature.end = Math.max(feature.end, existing.feature.end)
          existing.feature = feature
          existing.record = record
        } else {
          feature.child_features = []
          const parsed = { feature, record }
          topLevel.push(parsed)
          byTranscript.set(transcriptId, parsed)
        }
      } else {
        let transcript = byTranscript.get(transcriptId)
        if (!transcript) {
          transcript = { feature: synthesizeTranscript(feature), record }
          topLevel.push(transcript)
          byTranscript.set(transcriptId, transcript)
        }
        transcript.feature.child_features!.push([feature])
        transcript.feature.start = Math.min(
          transcript.feature.start,
          feature.start,
        )
        transcript.feature.end = Math.max(transcript.feature.end, feature.end)
      }
    }
  }
  return topLevel
}

/**
 * Parse GTF records and serialize each top-level feature. Shared by the
 * plain-text and tabix adapters, which differ only in how they source records
 * and derive the uniqueId (parse index vs. tabix byte offset).
 */
export function parseGtfToFeatures<R extends GtfLineRecord>(
  records: readonly R[],
  makeUniqueId: (record: R, index: number) => string,
): SimpleFeatureSerialized[] {
  return parseGtf(records).map(
    ({ feature, record }, i) =>
      featureData(feature, makeUniqueId(record, i)) as SimpleFeatureSerialized,
  )
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
  idPrefix,
}: {
  feats: SimpleFeatureSerialized[]
  aggregateField: string
  refName: string
  regionStart: number
  regionEnd: number
  idPrefix: string
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
      } else if (doesIntersect2(feat.start, feat.end, regionStart, regionEnd)) {
        // passthrough features (no aggregate field) must be clipped to the
        // original query too, else a redispatch's expanded fetch leaks features
        // outside the view (aggregated genes are already intersection-checked)
        out.push(feat)
      }
    }
  }

  for (const [name, subfeatures] of Object.entries(parentAggregation)) {
    const start = min(subfeatures.map(f => f.start))
    const end = max(subfeatures.map(f => f.end))
    if (doesIntersect2(start, end, regionStart, regionEnd)) {
      out.push({
        type: 'gene',
        subfeatures,
        strand: subfeatures[0]!.strand,
        name,
        start,
        end,
        refName,
        // stable across fetch windows: the same gene keeps one id while panning,
        // unlike a subfeature-derived id where the "first" transcript (and thus
        // the id) shifts with whatever the current window happened to pull in.
        // aggregation groups by name within a ref, so refName+name is unique
        uniqueId: `${idPrefix}-${refName}-gene-${name}`,
      })
    }
  }
  return out
}
