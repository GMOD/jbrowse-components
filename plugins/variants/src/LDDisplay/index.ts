import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import ldTrackDisplayConfigSchema from './configSchemaLDTrack.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// The name/trackType pair stays literal strings: the api-docs generator finds
// display↔track links by matching them here.
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
          import('./model.ts').then(f => f.default(configSchema)),
        trackType: 'LDTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: lazyWithPreload(
          () => import('./components/LDDisplayComponent.tsx'),
        ),
      }),
  )
}
