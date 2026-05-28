// configs

import { ErrorBanner } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import config from '../../public/test_data/volvox/config.json' with { type: 'json' }
import { JBrowseLinearGenomeView } from '../../src/index.ts'

import type { ViewModel } from '../../src/index.ts'

export const ViewWithErrorHandling = observer(function ViewWithErrorHandling({
  state,
}: {
  state: ViewModel
}) {
  const error = state.session.view.error
  if (error) {
    return <ErrorBanner error={error} />
  }
  return <JBrowseLinearGenomeView viewState={state} />
})

export function addRelativeUris(
  config: Record<string, unknown>,
  baseUri: string,
) {
  for (const key of Object.keys(config)) {
    const val = config[key]
    if (typeof val === 'object' && val !== null) {
      addRelativeUris(val as Record<string, unknown>, baseUri)
    } else if (key === 'uri' && !config.baseUri) {
      config.baseUri = baseUri
    }
  }
}

export function getVolvoxConfig() {
  const configPath = 'test_data/volvox/config.json'
  addRelativeUris(config, new URL(configPath, window.location.href).href)
  const supported = new Set([
    'AlignmentsTrack',
    'FeatureTrack',
    'QuantitativeTrack',
    'VariantTrack',
    'WiggleTrack',
  ])

  const excludeIds = new Set(['gtf_plain_text_test', 'arc_track'])

  return {
    assembly: config.assemblies[0],
    tracks: config.tracks.filter(
      t => supported.has(t.type) && !excludeIds.has(t.trackId),
    ),
  }
}
