import { lazy } from 'react'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { types } from '@jbrowse/mobx-state-tree'

import sharedLDConfigFactory from './SharedLDConfigSchema.ts'
import sharedModelFactory from './shared.ts'
import configSchema from '../LDRenderer/configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

const LazyLDDisplayComponent = lazy(
  () => import('./components/LDDisplayComponent.tsx'),
)

function makeLDConfigSchema(typeName: string) {
  return ConfigurationSchema(
    typeName,
    {
      renderer: configSchema,
      height: {
        type: 'number',
        defaultValue: 400,
      },
    },
    {
      baseConfiguration: sharedLDConfigFactory(),
      explicitlyTyped: true,
    },
  )
}

function makeLDStateModel(
  typeName: string,
  configSchema: AnyConfigurationSchemaType,
) {
  return sharedModelFactory(configSchema)
    .named(typeName)
    .props({ type: types.literal(typeName) })
}

export default function LDDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const cs = makeLDConfigSchema('LDDisplay')
    return new DisplayType({
      name: 'LDDisplay',
      displayName: 'LD heatmap display',
      helpText:
        'Displays a linkage disequilibrium (LD) heatmap showing pairwise R² values between variants computed directly from VCF genotypes',
      configSchema: cs,
      stateModel: makeLDStateModel('LDDisplay', cs),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LazyLDDisplayComponent,
    })
  })

  pluginManager.addDisplayType(() => {
    const cs = makeLDConfigSchema('LDTrackDisplay')
    return new DisplayType({
      name: 'LDTrackDisplay',
      displayName: 'LD heatmap display',
      helpText:
        'Displays a linkage disequilibrium (LD) heatmap from pre-computed LD data (e.g., PLINK --r2 output)',
      configSchema: cs,
      stateModel: makeLDStateModel('LDTrackDisplay', cs),
      trackType: 'LDTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LazyLDDisplayComponent,
    })
  })
}
