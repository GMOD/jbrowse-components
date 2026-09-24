import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import { configSchemaFactory } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const ReactComponent = lazyWithPreload(
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
      // Every adapter behind these answers `getFeaturesArray`, so a `marks`
      // entry over a BAM is a declared pileup and one over a VCF a stacked
      // variant strip. What differs is which fields answer: a read's `score`
      // is its MAPQ, a variant's quality is `QUAL`, a BigWig's `score` past
      // its raw section is a zoom level's mean, with `minScore` and
      // `maxScore` beside it, and a multi-BigWig's rows carry `source`, the
      // field a `facet` bands them by (ADR-126).
      trackType: [
        'FeatureTrack',
        'AlignmentsTrack',
        'VariantTrack',
        'QuantitativeTrack',
        'MultiQuantitativeTrack',
      ],
      viewType: 'LinearGenomeView',
      ReactComponent,
    })
  })
}
