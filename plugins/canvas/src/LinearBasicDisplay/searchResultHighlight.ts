import { readConfObject } from '@jbrowse/core/configuration'
import { getSession, parseLocString } from '@jbrowse/core/util'

import type { FeatureHighlight } from './featureHighlight.ts'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface FeatureHighlightCapableDisplay {
  setFeatureHighlights: (highlights: FeatureHighlight[]) => void
}

function isFeatureHighlightCapable(
  d: unknown,
): d is FeatureHighlightCapableDisplay {
  return (
    typeof d === 'object' &&
    d !== null &&
    'setFeatureHighlights' in d &&
    typeof d.setFeatureHighlights === 'function'
  )
}

// Turn a chosen text-search result into a feature highlight on its track's
// canvas display. Trix records the feature's exact span plus its indexed name
// (never the uniqueId), so we pass that signature through as a declarative
// highlight and let the display resolve it to the specific rendered feature.
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
  if (!loc || !trackId) {
    return
  }
  const { assemblyManager } = getSession(model)
  const parsed = parseLocString(loc, ref =>
    assemblyManager.isValidRefName(ref, assemblyName),
  )
  if (parsed.start !== undefined && parsed.end !== undefined) {
    const highlight: FeatureHighlight = {
      refName: parsed.refName,
      start: parsed.start,
      end: parsed.end,
      name: result.getLabel(),
    }
    const track = model.tracks.find(
      t => readConfObject(t.configuration, 'trackId') === trackId,
    )
    for (const display of track?.displays ?? []) {
      if (isFeatureHighlightCapable(display)) {
        display.setFeatureHighlights([highlight])
      }
    }
  }
}
