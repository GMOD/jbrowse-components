import type { GFF3FeatureLineWithRefs } from 'gff-nostream'

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

  const defaultFields = new Set([
    'start',
    'end',
    'seq_id',
    'score',
    'type',
    'source',
    'phase',
    'strand',
  ])
  const dataAttributes = attributes || {}
  const resultAttributes = {} as Record<string, unknown>
  for (const a of Object.keys(dataAttributes)) {
    let b = a.toLowerCase()
    if (defaultFields.has(b)) {
      // add "suffix" to tag name if it already exists
      // reproduces behavior of NCList
      b += '2'
    }
    if (dataAttributes[a] && a !== '_lineHash') {
      let attr: string | string[] | undefined = dataAttributes[a]
      if (Array.isArray(attr) && attr.length === 1) {
        ;[attr] = attr
      }
      resultAttributes[b] = attr
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
    subfeatures: child_features.flatMap(childLocs =>
      childLocs.map(childLoc => featureData(childLoc)),
    ),
  }
}
