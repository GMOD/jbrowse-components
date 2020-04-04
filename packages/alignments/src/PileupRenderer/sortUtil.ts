import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
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
  const featureArray = Array.from(features) // this is an array of arrays
  const featuresInCenterLine: [string, Feature][] = []
  const featuresOutsideCenter: [string, Feature][] = []

//   console.log(bpPerPx, sortObject.position)
  console.log('NEW SORT -------')
  featureArray.forEach((innerArray, idx) => {
    const feature = innerArray[1]
    console.log(feature.get('start'), feature.get('end'))
    if (
      sortObject.position <= feature.get('end') &&
      sortObject.position >= feature.get('start')
    ) {
      featuresInCenterLine.push(innerArray)
    } else featuresOutsideCenter.push(innerArray)
  })

  console.log(featureArray.length, featuresInCenterLine.length)

  // NOTE: is not sorted when the last sort call featuresInCenterLine length > 0, happens at zoom level 0.05
  switch (sortObject.by) {
    case 'Start Location': {
      featuresInCenterLine.sort(
        (a: [string, Feature], b: [string, Feature]) =>
          a[1].get('start') - b[1].get('start'),
      )
      break
    }

    // WORKS UP TO BPPERPX OF 0.1
    case 'Base Pair': {
      // first sort all mismatches, then all reference bases at the end
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
        const calculation =
          (aMismatch ? aMismatch.base.charCodeAt(0) : 0) -
          (bMismatch ? bMismatch.base.charCodeAt(0) : 0)

        // TODOSORT: on the last call, top 3 features are not included when passed to this util
        return (
          (bMismatch ? bMismatch.base.toUpperCase().charCodeAt(0) : 0) -
          (aMismatch ? aMismatch.base.toUpperCase().charCodeAt(0) : 0)
        )
      })

      break
    }

    // WORKS UP TO BPPERPX OF 0.1
    case 'Read Strand': {
      featuresInCenterLine.sort(
        (a: [string, Feature], b: [string, Feature]) => {
          if (a[1].get('strand') < b[1].get('strand')) return 1
          return -1
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
