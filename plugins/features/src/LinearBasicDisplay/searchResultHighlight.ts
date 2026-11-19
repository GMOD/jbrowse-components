import { readConfObject } from '@jbrowse/core/configuration'
import { getSession, parseLocString } from '@jbrowse/core/util'

import type { FeatureHighlight } from './featureHighlight.ts'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface FeatureHighlightCapableDisplay {
  setSearchHighlight: (highlight: FeatureHighlight) => void
  clearSearchHighlight: () => void
}

function isFeatureHighlightCapable(
  d: unknown,
): d is FeatureHighlightCapableDisplay {
  return (
    typeof d === 'object' &&
    d !== null &&
    'setSearchHighlight' in d &&
    typeof d.setSearchHighlight === 'function' &&
    'clearSearchHighlight' in d &&
    typeof d.clearSearchHighlight === 'function'
  )
}

export function highlightSearchResultFeature({
  result,
  model,
  assemblyName,
}: {
  result: BaseResult
  model: LinearGenomeViewModel
  assemblyName: string
}) {
  const loc = result.getLocation()
  const trackId = result.getTrackId()
  if (loc && trackId) {
    const { assemblyManager } = getSession(model)
    const parsed = parseLocString(loc, ref =>
      assemblyManager.isValidRefName(ref, assemblyName),
    )
    if (parsed.start !== undefined && parsed.end !== undefined) {
      // Trix records the source file's refName while regions carry the
      // canonical one, and `featureMatchesHighlight` compares them directly.
      const assembly = assemblyManager.get(assemblyName)
      const highlight: FeatureHighlight = {
        refName:
          assembly?.getCanonicalRefName2(parsed.refName) ?? parsed.refName,
        start: parsed.start,
        end: parsed.end,
        name: result.getLabel(),
      }
      // Every track, so the last search's box leaves the track it was on when
      // this hit is on another.
      for (const track of model.tracks) {
        const hit = readConfObject(track.configuration, 'trackId') === trackId
        for (const display of track.displays) {
          if (isFeatureHighlightCapable(display)) {
            if (hit) {
              display.setSearchHighlight(highlight)
            } else {
              display.clearSearchHighlight()
            }
          }
        }
      }
    }
  }
}
