import { doesIntersect2 } from '@jbrowse/core/util'

import {
  CHAR_CODE_TO_STRING,
  TYPE_INSERTION,
  TYPE_SOFTCLIP,
  getMismatchesFromFeature,
} from '../shared/types'

import type { SortedBy } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'

interface MismatchInfo {
  base: string
  length: number
}

export function sortFeature(
  features: Map<string, Feature>,
  sortedBy: SortedBy,
) {
  const featuresInCenterLine: Feature[] = []
  const featuresOutsideCenter: Feature[] = []
  const { pos, type } = sortedBy

  // Partition features directly from map iterator (avoids intermediate array)
  let firstFeature: Feature | undefined
  for (const feature of features.values()) {
    if (!firstFeature) {
      firstFeature = feature
    }
    const start = feature.get('start')
    const end = feature.get('end')
    if (doesIntersect2(pos - 1, pos, start, end)) {
      featuresInCenterLine.push(feature)
    } else {
      featuresOutsideCenter.push(feature)
    }
  }

  const isCram = firstFeature ? firstFeature.get('tags') : false
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
      const baseMap = new Map<string, MismatchInfo>()
      for (const feature of featuresInCenterLine) {
        const mismatches = getMismatchesFromFeature(feature)
        if (!mismatches || mismatches.count === 0) {
          continue
        }
        const start = feature.get('start')
        const { count, starts, lengths, types, bases } = mismatches

        for (let i = 0; i < count; i++) {
          const mType = types[i]!
          const mStart = starts[i]!
          const mLen = lengths[i]!
          const offset = start + mStart + 1
          const consuming = mType === TYPE_INSERTION || mType === TYPE_SOFTCLIP
          const len = consuming ? 0 : mLen
          if (pos >= offset && pos < offset + len) {
            baseMap.set(feature.id(), {
              base: CHAR_CODE_TO_STRING[bases[i]!]!,
              length: mLen,
            })
          }
        }
      }

      featuresInCenterLine.sort((a, b) => {
        const aMismatch = baseMap.get(a.id())
        const bMismatch = baseMap.get(b.id())
        const acode = bMismatch?.base.toUpperCase()
        const bcode = aMismatch?.base.toUpperCase()
        return acode === bcode && acode === '*'
          ? (aMismatch?.length ?? 0) - (bMismatch?.length ?? 0)
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

  // Build result map directly without intermediate array spread
  const result = new Map<string, Feature>()
  for (const feature of featuresInCenterLine) {
    result.set(feature.id(), feature)
  }
  for (const feature of featuresOutsideCenter) {
    result.set(feature.id(), feature)
  }
  return result
}
