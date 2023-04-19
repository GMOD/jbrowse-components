export type Strand = '+' | '-' | '.' | '?'
export interface FeatureLoc {
  [key: string]: unknown
  start: number
  end: number
  strand: Strand
  seq_name: string
  child_features: FeatureLoc[][]
  data: unknown
  derived_features: unknown
  attributes: { [key: string]: unknown[] }
}

export function featureData(data: FeatureLoc) {
  const f: Record<string, unknown> = { ...data }
  ;(f.start as number) -= 1 // convert to interbase
  f.strand = { '+': 1, '-': -1, '.': 0, '?': undefined }[data.strand] // convert strand
  f.phase = Number(data.frame)
  f.refName = data.seq_name
  if (data.score === null) {
    delete f.score
  }
  if (data.frame === null) {
    delete f.score
  }
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
  for (const a of Object.keys(data.attributes)) {
    let b = a.toLowerCase()
    if (defaultFields.has(b)) {
      // add "suffix" to tag name if it already exists
      // reproduces behavior of NCList
      b += '2'
    }
    if (data.attributes[a] !== null) {
      let attr = data.attributes[a] as string[] | string
      if (Array.isArray(attr) && attr.length === 1) {
        // gtf uses double quotes for text values in the attributes column,
        // remove them
        attr = `${attr[0]}`.replace(/^"|"$/g, '')
      }
      f[b] = attr
    }
  }
  f.refName = f.seq_name
  f.type = f.featureType

  // the SimpleFeature constructor takes care of recursively inflating subfeatures
  if (data.child_features && data.child_features.length > 0) {
    f.subfeatures = data.child_features.flatMap(childLocs =>
      childLocs.map(childLoc => featureData(childLoc)),
    )
  }

  delete f.child_features
  delete f.data
  delete f.derived_features
  // eslint-disable-next-line no-underscore-dangle
  delete f._linehash
  delete f.attributes
  delete f.seq_name
  delete f.featureType
  delete f.frame

  if (f.transcript_id) {
    f.name = f.transcript_id
  }
  return f
}
