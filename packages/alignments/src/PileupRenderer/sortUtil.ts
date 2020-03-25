import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import { featureSpanPx } from '@gmod/jbrowse-core/util'
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
  horizontallyFlipped: boolean,
) => {
  const featureArray = Array.from(features) // this is an array of arrays
  const featuresInCenterLine: [string, Feature][] = []
  const featuresOutsideCenter: [string, Feature][] = []

  featureArray.forEach((innerArray, idx) => {
    const feature = innerArray[1]
    if (
      sortObject.position <= feature.get('end') &&
      sortObject.position >= feature.get('start')
    ) {
      featuresInCenterLine.push(innerArray)
    } else featuresOutsideCenter.push(innerArray)
  })

  switch (sortObject.by) {
    case 'Start Location': {
      featuresInCenterLine.sort(
        (a: [string, Feature], b: [string, Feature]) =>
          a[1].get('start') - b[1].get('start'),
      )
      break
    }

    case 'Base Pair': {
      // first sort all mismatches, then all reference bases at the end
      const baseSortArray: [string, Mismatch][] = []
      featuresInCenterLine.map((array, idx) => {
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
        console.log(aMismatch, bMismatch, calculation)
        return (
          (aMismatch ? aMismatch.base.charCodeAt(0) : 0) -
          (bMismatch ? bMismatch.base.charCodeAt(0) : 0)
        )
      })

      // read strand feature.getstrand 1 or -1 sort on that
      break
    }
    default:
      break
  }

  //   featuresInCenterLine.map(f => console.log(f[1].get('start')))
  //   featureArray.splice(
  //     minIdx,
  //     featuresInCenterLine.length,
  //     ...featuresInCenterLine,
  //   )
  const sortedMap = new Map(featuresInCenterLine.concat(featuresOutsideCenter))
  //   featureArray.forEach((element, idx) => sortedMap.set(element[0], element[1]))

  return sortedMap
}
