import { doesIntersect2 } from '@jbrowse/core/util'
import type { Mismatch, SortedBy } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'

export const sortFeature = (
  features: Map<string, Feature>,
  sortedBy: SortedBy,
) => {
  const featureArray = Array.from(features.values())
  const featuresInCenterLine: Feature[] = []
  const featuresOutsideCenter: Feature[] = []
  const { pos, type } = sortedBy

  // only sort on features that intersect center line, append those outside post-sort
  featureArray.forEach(innerArray => {
    const feature = innerArray
    const start = feature.get('start')
    const end = feature.get('end')
    if (doesIntersect2(pos - 1, pos, start, end)) {
      featuresInCenterLine.push(innerArray)
    } else {
      featuresOutsideCenter.push(innerArray)
    }
  })

  const isCram = featureArray.length ? featureArray[0]!.get('tags') : false
  switch (type) {
    case 'Start location': {
      featuresInCenterLine.sort((a, b) => a.get('start') - b.get('start'))
      break
    }

    case 'tag': {
      const tag = sortedBy.tag!
      const getTag = (f: Feature, t: string) => {
        return isCram ? f.get('tags')[t] : f.get(t)
      }
      const isString =
        featuresInCenterLine[0] &&
        typeof getTag(featuresInCenterLine[0], tag) === 'string'
      if (isString) {
        featuresInCenterLine.sort((a, b) =>
          getTag(b, tag).localeCompare(getTag(a, tag)),
        )
      } else {
        featuresInCenterLine.sort(
          (a, b) => (getTag(b, tag) || 0) - (getTag(a, tag) || 0),
        )
      }
      break
    }

    // first sort all mismatches, then all reference bases at the end
    case 'Base pair': {
      const baseSortArray: [string, Mismatch][] = []
      for (const feature of featuresInCenterLine) {
        const mismatches: Mismatch[] = feature.get('mismatches')
        for (const m of mismatches) {
          const start = feature.get('start')
          const offset = start + m.start + 1
          const consuming = m.type === 'insertion' || m.type === 'softclip'
          const len = consuming ? 0 : m.length
          if (pos >= offset && pos < offset + len) {
            baseSortArray.push([feature.id(), m])
          }
        }
      }

      const baseMap = new Map(baseSortArray)
      featuresInCenterLine.sort((a, b) => {
        const aMismatch = baseMap.get(a.id())
        const bMismatch = baseMap.get(b.id())
        const acode = bMismatch?.base.toUpperCase()
        const bcode = aMismatch?.base.toUpperCase()
        return acode === bcode && acode === '*'
          ? // @ts-expect-error
            aMismatch.length - bMismatch.length
          : (acode ? acode.charCodeAt(0) : 0) -
              (bcode ? bcode.charCodeAt(0) : 0)
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

  return new Map(
    [...featuresInCenterLine, ...featuresOutsideCenter].map(feature => [
      feature.id(),
      feature,
    ]),
  )
}
