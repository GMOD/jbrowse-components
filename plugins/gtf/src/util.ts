export type Strand = '+' | '-' | '.' | '?'
export interface FeatureLoc {
  [key: string]: unknown
  start: number
  end: number
  strand: Strand
  seq_name: string
  child_features?: FeatureLoc[][]
  data: unknown
  derived_features: unknown
  attributes: Record<string, unknown[]>
}

const strandMap = { '+': 1, '-': -1, '.': 0, '?': undefined } as const

const defaultFields = new Set([
  'start',
  'end',
  'seq_name',
  'score',
  'featureType',
  'source',
  'frame',
  'strand',
])

export function featureData(
  data: FeatureLoc,
  id?: string,
): Record<string, unknown> {
  // process attributes: lowercase keys, suffix clashes with default fields,
  // unwrap single-element arrays, strip GTF double-quotes
  const processedAttrs = Object.fromEntries(
    Object.keys(data.attributes)
      .filter(a => data.attributes[a])
      .map(a => {
        const lower = a.toLowerCase()
        const key = defaultFields.has(lower) ? `${lower}2` : lower
        let attr = data.attributes[a] as string[] | string
        if (Array.isArray(attr) && attr.length === 1) {
          attr = attr[0]!.replaceAll(/^"|"$/g, '')
        }
        return [key, attr] as const
      }),
  )

  const subfeatures = data.child_features?.length
    ? data.child_features.flatMap(childLocs =>
        childLocs.map(childLoc => featureData(childLoc)),
      )
    : undefined

  return {
    ...data,
    start: data.start - 1,
    strand: strandMap[data.strand],
    phase: data.frame !== null ? Number(data.frame) : undefined,
    refName: data.seq_name,
    score: data.score === null ? undefined : data.score,
    ...processedAttrs,
    type: data.featureType,
    ...(subfeatures !== undefined && { subfeatures }),
    ...(processedAttrs.transcript_id && { name: processedAttrs.transcript_id }),
    ...(id !== undefined && { uniqueId: id }),
    // clear raw fields subsumed by the above
    child_features: undefined,
    data: undefined,
    derived_features: undefined,
    _linehash: undefined,
    seq_name: undefined,
    featureType: undefined,
    frame: undefined,
    attributes: undefined,
  }
}
