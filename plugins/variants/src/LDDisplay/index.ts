import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { types } from '@jbrowse/mobx-state-tree'

import ldTrackDisplayConfigSchema from './configSchemaLDTrack.ts'
import ldDisplayConfigSchema from './configSchemaVariant.ts'

import type { LDDisplayConfigSchema } from './SharedLDConfigSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

const LazyLDDisplayComponent = lazy(
  () => import('./components/LDDisplayComponent.tsx'),
)

// The schema is passed in rather than built from `typeName` here, and that is
// the same rule as the one below in a second guise: the doc generator keys a
// `#config` block to its FILE, so while both schemas came from one
// `makeLDConfigSchema(typeName)` helper neither registered display type had a
// page or a name the generator could see. `SharedLDDisplay` had the only page,
// so its slot table told readers to write `type: 'SharedLDDisplay'`, which
// nothing accepts — and both displays were missing from the "settings with a
// session-wide default" table (agent-docs/reference/DISPLAY_TYPE_DEFAULTS.md)
// even though their promotable `showLegend` pin works. Only the state model
// still takes the name, which nothing generates from.
function makeLDStateModel(
  typeName: string,
  configSchema: LDDisplayConfigSchema,
) {
  return {
    configSchema,
    // lazily loaded: the LD model carries the pairwise-R² machinery, and is
    // fetched when a track picks one of these displays or a session names one
    stateModel: () =>
      import('./shared.ts').then(f =>
        f
          .default(configSchema)
          .named(typeName)
          .props({ type: types.literal(typeName) }),
      ),
  }
}

/**
 * The same display against two track types: one computing LD from a
 * VariantTrack's own genotypes, one reading an LDTrack's pre-computed file.
 * Only the name, the track type and the help text differ.
 *
 * Written out twice rather than looped over a table, which is what the shape
 * invites: `website/scripts/api-docs/util.ts` finds every display↔track link by
 * matching `new DisplayType({ name: 'X', trackType: 'Y' })` with **string
 * literals** in the object literal, and it is the only place in the codebase
 * that link is declared. Fed identifiers from a loop it silently finds nothing,
 * and both LD displays drop out of the track-type table in
 * `config_guides/tracks.md` with no error anywhere.
 */
export default function LDDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LDDisplay',
        displayName: 'LD heatmap display',
        helpText:
          'Displays a linkage disequilibrium (LD) heatmap showing pairwise R² values between variants computed directly from VCF genotypes',
        ...makeLDStateModel('LDDisplay', ldDisplayConfigSchema()),
        trackType: 'VariantTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: LazyLDDisplayComponent,
      }),
  )

  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LDTrackDisplay',
        displayName: 'LD heatmap display',
        helpText:
          'Displays a linkage disequilibrium (LD) heatmap from pre-computed LD data (e.g., PLINK --r2 output)',
        ...makeLDStateModel('LDTrackDisplay', ldTrackDisplayConfigSchema()),
        trackType: 'LDTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: LazyLDDisplayComponent,
      }),
  )
}
