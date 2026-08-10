import { doesIntersect2 } from '@jbrowse/core/util'

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
  child_features?: FeatureLoc[]
  attributes: Record<string, string[]>
}

const strandMap = { '+': 1, '-': -1, '.': 0, '?': undefined } as const

// structural output fields an attribute must not overwrite; a clashing
// attribute key gets a `2` suffix instead (compared lowercase, so camelCase
// output fields like refName never collide). `subfeatures` is the one that
// matters beyond tidiness: on a feature with no children nothing overwrites it
// back, so an attribute of that name would leave a string where every consumer
// expects the child array
const reservedFields = new Set([
  'type',
  'source',
  'start',
  'end',
  'strand',
  'score',
  'phase',
  'subfeatures',
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
    ? data.child_features.map(childLoc => featureData(childLoc))
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
 * True when an entry opens a double quote it never closes, meaning the ';' it
 * was split on fell inside the value instead of ending the entry. A GTF value
 * is either bare or wholly quoted, so a second quote settles it — no need to
 * scan the rest of the entry.
 */
function hasUnclosedQuote(entry: string) {
  const first = entry.indexOf('"')
  return first !== -1 && !entry.includes('"', first + 1)
}

/**
 * Parse the GTF 9th column (`gene_id "X"; transcript_id "Y";`). Each `key
 * "value"` entry contributes one value; GTF expresses multiple values per key
 * via repeated keys (`tag "A"; tag "B"`), not comma separation, so the value is
 * taken whole (a comma inside it, e.g. `note "a, b"`, stays intact). Surrounding
 * double-quotes are stripped here.
 *
 * A quoted value may also contain the ';' the entries are split on
 * (`note "a; b"`), so the pieces of one are rejoined before the value is read.
 * Without that the value is silently truncated at the semicolon, and the
 * remainder — having no `key value` shape — is dropped rather than erroring.
 */
function parseGtfAttributes(attrString: string) {
  const attrs: Record<string, string[]> = {}
  if (attrString.length > 0 && attrString !== '.') {
    const entries = attrString.split(';')
    for (let i = 0; i < entries.length; i++) {
      let entry = entries[i]!
      while (hasUnclosedQuote(entry) && i + 1 < entries.length) {
        entry += `;${entries[++i]}`
      }
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

function synthesizeTranscript(child: FeatureLoc): FeatureLoc {
  return {
    seq_name: child.seq_name,
    source: child.source,
    featureType: 'transcript',
    start: child.start,
    end: child.end,
    score: null,
    strand: child.strand,
    frame: null,
    // seeded from the first child, then narrowed by narrowToCommonAttributes as
    // the rest arrive
    attributes: { ...child.attributes },
    child_features: [],
  }
}

/**
 * Keep only the attributes a synthesized transcript's children agree on,
 * dropping any key that is missing from `child` or carries a different value
 * there. Transcript- and gene-level tags (`transcript_id`, `gene_id`,
 * `gene_name`, biotypes, StringTie's `ref_gene_name`, …) repeat identically on
 * every line of a transcript and survive; per-line tags (`exon_number`,
 * `exon_id`, a CDS-only `protein_id`) differ or are absent and are dropped.
 *
 * Deriving the set this way rather than from a fixed whitelist is what lets any
 * `aggregateField` work: a hardcoded list silently failed to aggregate whenever
 * the configured field wasn't one of the three names it happened to enumerate.
 */
function narrowToCommonAttributes(
  attributes: Record<string, string[]>,
  child: FeatureLoc,
) {
  for (const key of Object.keys(attributes)) {
    const mine = attributes[key]!
    const theirs = child.attributes[key]
    if (
      theirs === undefined ||
      theirs.length !== mine.length ||
      theirs.some((v, i) => v !== mine[i])
    ) {
      delete attributes[key]
    }
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
  // transcripts with no explicit line of their own, whose attributes are still
  // being narrowed down to what their children agree on
  const synthesized = new Set<string>()
  for (const record of records) {
    // defensive: both of today's line sources already drop a CRLF terminator
    // (@gmod/tabix trims it in its line reader "matching htslib's", and the
    // plaintext path's parseLineByLine trims each line), so this normally does
    // nothing. It stays because an untrimmed \r is silent — on a line with no
    // trailing ';' it lands inside the last attribute value, corrupting the
    // transcript_id that drives both grouping and the feature name
    const line = record.line.endsWith('\r')
      ? record.line.slice(0, -1)
      : record.line
    if (line.length === 0 || line.startsWith('#')) {
      continue
    }
    const feature = parseGtfLine(line)
    // a line whose coordinate columns aren't numbers is not a feature, and
    // letting its NaN through is not a local failure: Math.min/Math.max against
    // NaN poisons the transcript spanning it, and a NaN-bounded transcript then
    // fails every intersection test, so one truncated line silently removes a
    // whole gene rather than itself
    if (Number.isNaN(feature.start) || Number.isNaN(feature.end)) {
      continue
    }
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
        synthesized.delete(transcriptId)
      } else {
        feature.child_features = []
        const parsed = { feature, record }
        topLevel.push(parsed)
        byTranscript.set(transcriptId, parsed)
      }
    } else {
      let transcript = byTranscript.get(transcriptId)
      if (transcript) {
        // an explicit transcript line's own attributes are authoritative, so
        // only a synthesized one gets narrowed against this child
        if (synthesized.has(transcriptId)) {
          narrowToCommonAttributes(transcript.feature.attributes, feature)
        }
      } else {
        transcript = { feature: synthesizeTranscript(feature), record }
        topLevel.push(transcript)
        byTranscript.set(transcriptId, transcript)
        synthesized.add(transcriptId)
      }
      transcript.feature.child_features!.push(feature)
      transcript.feature.start = Math.min(
        transcript.feature.start,
        feature.start,
      )
      transcript.feature.end = Math.max(transcript.feature.end, feature.end)
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

/** The value if it is a non-empty string, otherwise undefined. */
function nonEmptyString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * GTF has no spanning gene line, so a gene is synthesized by grouping related
 * transcript features and spanning them. An explicit `gene` line is held aside
 * rather than aggregated — the parser hangs exons off the transcript, so a gene
 * line is childless and the synthesized parent supersedes it — and emitted only
 * if no synthesized gene claimed its `gene_id`, which is what keeps a file of
 * nothing but `gene` rows from rendering as an empty track. A gene line with no
 * `gene_id` at all (AUGUSTUS writes a bare `g1` in column 9, which parses to no
 * attributes) has no key to be superseded by, and is dropped.
 *
 * Grouping is keyed by `gene_id` where a transcript carries one, falling back to
 * the aggregate value; `aggregateField` supplies the gene's display `name`. The
 * two are separate because neither alone works:
 *
 * - `gene_name` (the default aggregate field, and the only one suitable as a
 *   label) is not unique within a reference sequence. A GENCODE chromosome holds
 *   hundreds of separate genes named `U6`, `Y_RNA` or `5S_rRNA`, and keying on
 *   the name alone fused all of them into one feature spanning the whole
 *   chromosome. `gene_id` is unique per gene by the GTF spec, so it splits those
 *   back apart while still merging the transcripts that really do share a gene.
 * - Plenty of GTFs carry `gene_id` and no `gene_name` at all — UCSC's
 *   `genePredToGtf` emits `gene_id "TP53"; transcript_id "NM_000546";` and
 *   nothing else, and AUGUSTUS is the same shape. Keying only on the aggregate
 *   value left those with no gene model whatsoever: every transcript passed
 *   through bare. Keying on `gene_id` gives them genes, named by the `gene_id`
 *   when there's no better label.
 *
 * A feature with neither key still passes through unchanged.
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
  const parentAggregation = new Map<
    string,
    { name: string | undefined; subfeatures: SimpleFeatureSerialized[] }
  >()
  const explicitGenes = new Map<string, SimpleFeatureSerialized>()
  for (const feat of feats) {
    const geneId = nonEmptyString(feat.gene_id)
    if (feat.type === 'gene') {
      if (geneId !== undefined) {
        explicitGenes.set(geneId, feat)
      }
      continue
    }
    const name = nonEmptyString(feat[aggregateField])
    const key = geneId ?? name
    if (key !== undefined) {
      let group = parentAggregation.get(key)
      if (group) {
        // a transcript that carries the aggregate value names the gene even
        // when the first one grouped under this key didn't
        group.name ??= name
      } else {
        group = { name, subfeatures: [] }
        parentAggregation.set(key, group)
      }
      group.subfeatures.push(feat)
    } else if (
      // a childless transcript with nothing to group on is a stray container
      // line rather than a feature — AUGUSTUS's bare `transcript` line, whose
      // real model arrives as the exon/CDS lines below it. One carrying a
      // gene_id is a real transcript and was aggregated above; dropping those
      // too made a transcript-only GTF render nothing at all
      (feat.type !== 'transcript' || feat.subfeatures?.length) &&
      doesIntersect2(feat.start, feat.end, regionStart, regionEnd)
    ) {
      // passthrough features (neither a gene_id nor an aggregate value) must
      // be clipped to the original query too, else a redispatch's expanded
      // fetch leaks features outside the view (aggregated genes are already
      // intersection-checked)
      out.push(feat)
    }
  }

  for (const [geneId, feat] of explicitGenes) {
    if (
      !parentAggregation.has(geneId) &&
      doesIntersect2(feat.start, feat.end, regionStart, regionEnd)
    ) {
      // labeled the way a synthesized gene is: featureData names a feature from
      // its transcript_id, which a gene line hasn't got
      out.push({
        ...feat,
        name:
          nonEmptyString(feat.name) ??
          nonEmptyString(feat[aggregateField]) ??
          geneId,
      })
    }
  }

  for (const [key, { name, subfeatures }] of parentAggregation) {
    let start = Number.POSITIVE_INFINITY
    let end = Number.NEGATIVE_INFINITY
    for (const f of subfeatures) {
      if (f.start < start) {
        start = f.start
      }
      if (f.end > end) {
        end = f.end
      }
    }
    if (doesIntersect2(start, end, regionStart, regionEnd)) {
      out.push({
        type: 'gene',
        subfeatures,
        strand: subfeatures[0]!.strand,
        // falls back to the grouping key, so a gene_id-only file (UCSC,
        // AUGUSTUS) still gets a labeled gene rather than an unnamed one
        name: name ?? key,
        start,
        end,
        refName,
        // stable across fetch windows: the same gene keeps one id while panning,
        // unlike a subfeature-derived id where the "first" transcript (and thus
        // the id) shifts with whatever the current window happened to pull in.
        // the grouping key is unique within a ref, so refName+key is unique
        uniqueId: `${idPrefix}-${refName}-gene-${key}`,
      })
    }
  }
  return out
}
