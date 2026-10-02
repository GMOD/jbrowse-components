import type { Feature, SimpleFeatureSerializedNoId } from './simpleFeature.ts'

/**
 * Which isoform of a gene a display shows first: the canvas gene glyph's
 * `longestCoding` collapse and the sequence panel's default transcript both
 * rank with this, so the panel opens on the isoform the track drew. Generic
 * over the feature shape because the worker ranks live `Feature`s and the
 * panel ranks their serialized form.
 */
export interface IsoformReader<T> {
  type: (feature: T) => string | undefined
  start: (feature: T) => number
  end: (feature: T) => number
  subfeatures: (feature: T) => readonly T[]
  attribute: (feature: T, field: string) => unknown
}

export const featureIsoformReader: IsoformReader<Feature> = {
  type: f => f.get('type'),
  start: f => f.get('start'),
  end: f => f.get('end'),
  subfeatures: f => f.get('subfeatures') ?? [],
  attribute: (f, field) => f.get(field),
}

export const serializedIsoformReader: IsoformReader<SimpleFeatureSerializedNoId> =
  {
    type: f => f.type,
    start: f => f.start,
    end: f => f.end,
    subfeatures: f => f.subfeatures ?? [],
    attribute: (f, field) => f[field],
  }

/**
 * The attribute naming a gene's representative isoform, and the values of it
 * that do, best first. The canvas display's `canonicalTranscriptField` and
 * `canonicalTranscriptTags` slots default to these.
 */
export interface CanonicalTranscripts {
  field: string
  tags: readonly string[]
}

export const DEFAULT_CANONICAL_TRANSCRIPTS: CanonicalTranscripts = {
  field: 'tag',
  tags: [
    'MANE Select',
    'MANE_Select',
    'RefSeq Select',
    'Ensembl_canonical',
    'MANE Plus Clinical',
    'MANE_Plus_Clinical',
  ],
}

export interface IsoformScore {
  canonical: number
  coding: boolean
  // protein length for a coding isoform, genomic span otherwise
  size: number
}

function isCDSType(type: string | undefined) {
  return type?.toLowerCase() === 'cds'
}

// The feature itself counts, because an isoform can BE the CDS: a viral
// polyprotein hangs its cleavage products off its CDS, not off further CDSs.
export function isCodingIsoform<T>(
  read: IsoformReader<T>,
  feature: T,
): boolean {
  return (
    isCDSType(read.type(feature)) ||
    read.subfeatures(feature).some(sub => isCodingIsoform(read, sub))
  )
}

// "Longest coding" is the longest protein — summed CDS length, not the widest
// genomic footprint an isoform with a large intron could win. A duplicated CDS
// row is a real GFF3 quirk that would otherwise inflate one isoform past a
// genuinely longer protein, so equal spans count once.
function codingLength<T>(read: IsoformReader<T>, feature: T) {
  const spans: [number, number][] = []
  const walk = (f: T) => {
    for (const sub of read.subfeatures(f)) {
      if (isCDSType(read.type(sub))) {
        spans.push([read.start(sub), read.end(sub)])
      } else {
        walk(sub)
      }
    }
  }
  walk(feature)
  if (spans.length === 0) {
    return isCDSType(read.type(feature))
      ? read.end(feature) - read.start(feature)
      : 0
  }
  spans.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  let sum = 0
  for (const [i, span] of spans.entries()) {
    const prev = spans[i - 1]
    if (!prev || prev[0] !== span[0] || prev[1] !== span[1]) {
      sum += span[1] - span[0]
    }
  }
  return sum
}

// A position in the tag list rather than a boolean, because the default list
// holds two tags one gene can carry at once and flattening them to "tagged"
// leaves the coding-length tiebreak to pick between them. A GFF3 attribute
// holding a comma list arrives as an array, hence both shapes.
function canonicalRank(value: unknown, wanted: string[]) {
  const values = Array.isArray(value)
    ? value.map(v => String(v).toLowerCase())
    : typeof value === 'string'
      ? [value.toLowerCase()]
      : []
  let best = Infinity
  for (const v of values) {
    const rank = wanted.indexOf(v)
    if (rank !== -1 && rank < best) {
      best = rank
    }
  }
  return best
}

export function isoformScorer<T>(
  read: IsoformReader<T>,
  { field, tags }: CanonicalTranscripts,
) {
  const wanted = tags.map(t => t.toLowerCase())
  return (feature: T): IsoformScore => {
    const coding = isCodingIsoform(read, feature)
    return {
      canonical: wanted.length
        ? canonicalRank(read.attribute(feature, field), wanted)
        : Infinity,
      coding,
      size: coding
        ? codingLength(read, feature)
        : read.end(feature) - read.start(feature),
    }
  }
}

// Best first. A curated tag outranks every measurement, because for a gene whose
// longest protein is a minor variant it is the only thing that picks the right
// isoform. A coding-length tie resolves to the LATER isoform, which a stable
// sort would break the other way — hence the explicit index term.
export function rankIsoforms<T>(
  isoforms: readonly T[],
  scoreOf: (feature: T) => IsoformScore,
): T[] {
  return isoforms
    .map((feature, index) => ({ feature, index, ...scoreOf(feature) }))
    .sort(
      (a, b) =>
        a.canonical - b.canonical ||
        Number(b.coding) - Number(a.coding) ||
        b.size - a.size ||
        b.index - a.index,
    )
    .map(s => s.feature)
}

export interface CanonicalTranscriptsHost {
  canonicalTranscripts: CanonicalTranscripts
}

export function isCanonicalTranscriptsHost(
  thing: unknown,
): thing is CanonicalTranscriptsHost {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'canonicalTranscripts' in thing
  )
}
