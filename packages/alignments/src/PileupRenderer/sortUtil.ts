import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { doesIntersect2 } from '@gmod/jbrowse-core/util/range'
import { IRegion } from '@gmod/jbrowse-core/util/types/mst'
import { Mismatch } from '../BamAdapter/BamSlightlyLazyFeature'

interface SortObject {
  position: number
  by: string
}
export const sortFeature = (
  features: Map<string, Feature>,
  sortObject: SortObject,
  bpPerPx: number,
  region: IRegion,
) => {
  const featureArray = Array.from(features)
  const featuresInCenterLine: typeof featureArray = []
  const featuresOutsideCenter: typeof featureArray = []

  // only sort on features that intersect center line, append those outside post-sort
  featureArray.forEach((innerArray, idx) => {
    const feature = innerArray[1]
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
      featuresInCenterLine.sort(
        (a: [string, Feature], b: [string, Feature]) =>
          a[1].get('start') - b[1].get('start'),
      )
      break
    }

    // first sort all mismatches, then all reference bases at the end
    case 'Base pair': {
      const baseSortArray: [string, Mismatch][] = []
      featuresInCenterLine.forEach((array, idx) => {
        const feature = array[1]
        const mismatches: Mismatch[] = feature.get('mismatches')
        mismatches.forEach(mismatch => {
          const positionOfMismatch = feature.get('start') + mismatch.start + 1
          if (positionOfMismatch === sortObject.position) {
            baseSortArray.push([feature.id(), mismatch])
          }
        })
      })

      const baseMap = new Map(baseSortArray)
      featuresInCenterLine.sort((a, b) => {
        const aMismatch = baseMap.get(a[1].id())
        const bMismatch = baseMap.get(b[1].id())

        return (
          (bMismatch ? bMismatch.base.toUpperCase().charCodeAt(0) : 0) -
          (aMismatch ? aMismatch.base.toUpperCase().charCodeAt(0) : 0)
        )
      })

      break
    }

    // sorts positive strands then negative strands
    case 'Read strand': {
      featuresInCenterLine.sort(
        (a: [string, Feature], b: [string, Feature]) => {
          return a[1].get('strand') <= b[1].get('strand') ? 1 : -1
        },
      )
      break
    }

    default:
      break
  }

  const sortedMap = new Map(featuresInCenterLine.concat(featuresOutsideCenter))

  return sortedMap
}
