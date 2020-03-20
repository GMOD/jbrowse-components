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
  console.log(sortObject)
  const featureArray = Array.from(features) // this is an array of arrays
  const featuresInCenterLine: Array<any> = []

  let minIdx = Number.MAX_VALUE
  featureArray.forEach((innerArray, idx) => {
    const feature = innerArray[1]
    if (
      sortObject.position <= feature.get('end') &&
      sortObject.position >= feature.get('start')
    ) {
      featuresInCenterLine.push(innerArray)
      minIdx = Math.min(minIdx, idx)
    }
  })

  switch (sortObject.by) {
    case 'Start Location': {
      featuresInCenterLine.sort((a: any, b: any) =>
        a[1].get('start') < b[1].get('start') ? 1 : -1,
      )
      break
    }

    case 'Base Pair': {
      featuresInCenterLine.map((array, idx) => {
        const feature = array[1]
        const mismatches: Mismatch[] = feature.get('mismatches')
        console.log(mismatches)
        mismatches.forEach(mismatch => {
          const positionOfMismatch = feature.get('start') + mismatch.start + 1
          //   if (positionOfMismatch === sortObject.position) {
          //   }
        })
      })
      break
    }
    case '':
      break
    default:
      break
  }

  featureArray.splice(
    minIdx,
    featuresInCenterLine.length,
    ...featuresInCenterLine,
  )
  const sortedMap = new Map()
  featureArray.forEach((element, idx) => sortedMap.set(element[0], element[1]))

  return sortedMap
}
