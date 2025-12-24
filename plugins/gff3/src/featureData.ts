import type { GFF3FeatureLineWithRefs } from 'gff-nostream'

// Module-level constant to avoid recreating Set on every featureData() call
const DEFAULT_FIELDS = new Set([
  'start',
  'end',
  'seq_id',
  'score',
  'type',
  'source',
  'phase',
  'strand',
])

interface GFF3Feature {
  start: number
  end: number
  strand?: number
  type: string | null
  source: string | null
  refName: string
  derived_features: unknown[] | null
  phase?: number
  score?: number
  subfeatures: GFF3Feature[] | undefined
  [key: string]: unknown
}

export function featureData(data: GFF3FeatureLineWithRefs): GFF3Feature {
  const {
    end,
    start,
    child_features,
    derived_features,
    attributes,
    type,
    source,
    phase,
    seq_id,
    score,
    strand,
  } = data

  let strand2: number | undefined
  if (strand === '+') {
    strand2 = 1
  } else if (strand === '-') {
    strand2 = -1
  } else if (strand === '.') {
    strand2 = 0
  }

  const dataAttributes = attributes || {}
  const resultAttributes = {} as Record<string, unknown>
  for (const a in dataAttributes) {
    if (a === '_lineHash') {
      continue
    }
    const value = dataAttributes[a]
    if (!value) {
      continue
    }
    let b = a.toLowerCase()
    if (DEFAULT_FIELDS.has(b)) {
      // add "suffix" to tag name if it already exists
      // reproduces behavior of NCList
      b += '2'
    }
    let attr: string | string[] | undefined = value
    if (Array.isArray(attr) && attr.length === 1) {
      ;[attr] = attr
    }
    resultAttributes[b] = attr
  }

  let subfeatures: GFF3Feature[] | undefined
  if (child_features.length > 0) {
    subfeatures = []
    for (const childLocs of child_features) {
      for (const childLoc of childLocs) {
        subfeatures.push(featureData(childLoc))
      }
    }
  }

  return {
    ...resultAttributes,
    start: start! - 1,
    end: end!,
    strand: strand2,
    type,
    source,
    refName: seq_id!,
    derived_features,
    phase: phase === null ? undefined : Number(phase),
    score: score === null ? undefined : score,
    subfeatures,
  }
}
