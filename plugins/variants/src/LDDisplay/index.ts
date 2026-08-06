import { lazy } from 'react'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { types } from '@jbrowse/mobx-state-tree'

import sharedLDConfigFactory from './SharedLDConfigSchema.ts'
import sharedModelFactory from './shared.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const LazyLDDisplayComponent = lazy(
  () => import('./components/LDDisplayComponent.tsx'),
)

function makeLDConfigSchema(typeName: string) {
  return ConfigurationSchema(
    typeName,
    {
      height: {
        type: 'number',
        defaultValue: 400,
        description:
          'Starting height in pixels for the LD triangle, excluding the lineZoneHeight band; drag-resizable',
      },
    },
    {
      baseConfiguration: sharedLDConfigFactory(),
      explicitlyTyped: true,
    },
  )
}

function makeLDStateModel(typeName: string) {
  const configSchema = makeLDConfigSchema(typeName)
  return {
    configSchema,
    stateModel: sharedModelFactory(configSchema)
      .named(typeName)
      .props({ type: types.literal(typeName) }),
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
        ...makeLDStateModel('LDDisplay'),
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
        ...makeLDStateModel('LDTrackDisplay'),
        trackType: 'LDTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: LazyLDDisplayComponent,
      }),
  )
}
