import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { types } from '@jbrowse/mobx-state-tree'

import ldTrackDisplayConfigSchema from './configSchemaLDTrack.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const LazyLDDisplayComponent = lazy(
  () => import('./components/LDDisplayComponent.tsx'),
)

// The name/trackType pair stays spelled with string literals in the object
// literal: `website/scripts/api-docs/util.ts` finds every display↔track link by
// matching them there, and it is the only place that link is declared. Fed
// identifiers it silently finds nothing, and the display drops out of the
// track-type table in `config_guides/tracks.md` with no error anywhere.
export default function LDDisplayF(pluginManager: PluginManager) {
  const configSchema = ldTrackDisplayConfigSchema()
  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LDTrackDisplay',
        displayName: 'LD heatmap display',
        helpText:
          'Displays a linkage disequilibrium (LD) heatmap from pre-computed LD data (e.g., PLINK --r2 output)',
        configSchema,
        stateModel: () =>
          import('./shared.ts').then(f =>
            f
              .default(configSchema)
              .named('LDTrackDisplay')
              .props({ type: types.literal('LDTrackDisplay') }),
          ),
        trackType: 'LDTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: LazyLDDisplayComponent,
      }),
  )
}
