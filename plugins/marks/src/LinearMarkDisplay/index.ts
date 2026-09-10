import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { configSchemaFactory } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const ReactComponent = lazy(
  () => import('./components/LinearMarkDisplayComponent.tsx'),
)

export default function LinearMarkDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearMarkDisplay',
      displayName: 'Marks',
      helpText:
        'Bars, points and spans drawn from an encoding declared in the track config',
      configSchema,
      stateModel: () =>
        import('./model.ts').then(f =>
          f.stateModelFactory(pluginManager, configSchema),
        ),
      // Every adapter behind these three answers `getFeaturesArray`, so a
      // `marks` entry over a BAM is a declared pileup and one over a VCF a
      // stacked variant strip. What differs is which fields answer: a read's
      // `score` is its MAPQ, a variant's quality is `QUAL`.
      trackType: ['FeatureTrack', 'AlignmentsTrack', 'VariantTrack'],
      viewType: 'LinearGenomeView',
      ReactComponent,
    })
  })
}
