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

export function featureData(data: FeatureLoc, id?: string) {
  const f: Record<string, unknown> = { ...data }
  f.start = data.start - 1 // convert to interbase
  f.strand = strandMap[data.strand]
  f.phase = data.frame !== null ? Number(data.frame) : undefined
  f.refName = data.seq_name
  if (data.score === null) {
    f.score = undefined
  }
  for (const a of Object.keys(data.attributes)) {
    let b = a.toLowerCase()
    if (defaultFields.has(b)) {
      // add "suffix" to tag name if it already exists
      // reproduces behavior of NCList
      b += '2'
    }
    if (data.attributes[a]) {
      let attr = data.attributes[a] as string[] | string
      if (Array.isArray(attr) && attr.length === 1) {
        // gtf uses double quotes for text values in the attributes column,
        // remove them
        attr = attr[0]!.replaceAll(/^"|"$/g, '')
      }
      f[b] = attr
    }
  }
  f.type = f.featureType

  // the SimpleFeature constructor takes care of recursively inflating subfeatures
  if (data.child_features?.length) {
    f.subfeatures = data.child_features.flatMap(childLocs =>
      childLocs.map(childLoc => featureData(childLoc)),
    )
  }

  f.child_features = undefined
  f.data = undefined
  f.derived_features = undefined
  f._linehash = undefined
  f.attributes = undefined
  f.seq_name = undefined
  f.featureType = undefined
  f.frame = undefined

  if (f.transcript_id) {
    f.name = f.transcript_id
  }
  if (id !== undefined) {
    f.uniqueId = id
  }
  return f
}
