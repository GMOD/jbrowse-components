import { GFF3FeatureLineWithRefs } from '@gmod/gff'

export function featureData(data: GFF3FeatureLineWithRefs) {
  const f: Record<string, unknown> = { ...data }
  ;(f.start as number) -= 1 // convert to interbase
  if (data.strand === '+') {
    f.strand = 1
  } else if (data.strand === '-') {
    f.strand = -1
  } else if (data.strand === '.') {
    f.strand = 0
  } else {
    f.strand = undefined
  }
  f.phase = Number(data.phase)
  f.refName = data.seq_id
  if (data.score === null) {
    f.score = undefined
  }
  if (data.phase === null) {
    f.score = undefined
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
  const dataAttributes = data.attributes || {}
  for (const a of Object.keys(dataAttributes)) {
    let b = a.toLowerCase()
    if (defaultFields.has(b)) {
      // add "suffix" to tag name if it already exists
      // reproduces behavior of NCList
      b += '2'
    }
    if (dataAttributes[a]) {
      let attr: string | string[] | undefined = dataAttributes[a]
      if (Array.isArray(attr) && attr.length === 1) {
        ;[attr] = attr
      }
      f[b] = attr
    }
  }
  f.refName = f.seq_id

  // the SimpleFeature constructor takes care of recursively inflating
  // subfeatures
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (data.child_features && data.child_features.length > 0) {
    f.subfeatures = data.child_features.flatMap(childLocs =>
      childLocs.map(childLoc => featureData(childLoc)),
    )
  }

  f.child_features = undefined
  f.data = undefined
  // delete f.derived_features
  f.attributes = undefined
  f.seq_id = undefined
  return f
}
