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
}
