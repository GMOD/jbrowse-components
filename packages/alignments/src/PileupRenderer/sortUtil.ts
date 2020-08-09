import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { doesIntersect2 } from '@gmod/jbrowse-core/util/range'
import { Mismatch } from '../BamAdapter/MismatchParser'

interface SortObject {
  position: number
  by: string
}
export const sortFeature = (
  features: Map<string, Feature>,
  sortObject: SortObject,
) => {
  const featureArray = Array.from(features.values())
  const featuresInCenterLine: Feature[] = []
  const featuresOutsideCenter: Feature[] = []

  // only sort on features that intersect center line, append those outside post-sort
  featureArray.forEach(innerArray => {
    const feature = innerArray
    if (
      doesIntersect2(
        sortObject.position - 1,
        sortObject.position,
        feature.get('start'),
        feature.get('end'),
      )
    ) {
      featuresInCenterLine.push(innerArray)
    } else {
      featuresOutsideCenter.push(innerArray)
    }
  })

  switch (sortObject.by) {
    case 'Start location': {
      featuresInCenterLine.sort((a, b) => a.get('start') - b.get('start'))
      break
    }

    // first sort all mismatches, then all reference bases at the end
    case 'Base pair': {
      const baseSortArray: [string, Mismatch][] = []
      featuresInCenterLine.forEach(feature => {
        const mismatches: Mismatch[] = feature.get('mismatches')
        mismatches.forEach(mismatch => {
          const start = feature.get('start')
          if (
            sortObject.position >= start + mismatch.start &&
            sortObject.position <= start + mismatch.start + mismatch.length
          ) {
            baseSortArray.push([feature.id(), mismatch])
          }
        })
      })

      const baseMap = new Map(baseSortArray)
      featuresInCenterLine.sort((a, b) => {
        const aMismatch = baseMap.get(a.id())
        const bMismatch = baseMap.get(b.id())
        return (
          (bMismatch ? bMismatch.base.toUpperCase().charCodeAt(0) : 0) -
          (aMismatch ? aMismatch.base.toUpperCase().charCodeAt(0) : 0)
        )
      })

      break
    }

    // sorts positive strands then negative strands
    case 'Read strand': {
      featuresInCenterLine.sort((a, b) =>
        a.get('strand') <= b.get('strand') ? 1 : -1,
      )
      break
    }
  }

  const sortedMap = new Map(
    featuresInCenterLine
      .concat(featuresOutsideCenter)
      .map(feature => [feature.id(), feature]),
  )

  return sortedMap
}
