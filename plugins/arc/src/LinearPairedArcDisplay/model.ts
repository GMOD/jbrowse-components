import type React from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { openFeatureWidget } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  FeatureDensityMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel LinearPairedArcDisplay
 * this is a non-block-based track type, and can connect arcs across multiple
 * displayedRegions
 *
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 * - [FeatureDensityMixin](../featuredensitymixin)
 */
export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearPairedArcDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      FeatureDensityMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearPairedArcDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      features: undefined as Feature[] | undefined,
      loading: false,
    }))

    .views(self => ({
      get fetchSettled() {
        const fetchWillNotRun =
          !!self.error || !self.featureDensityStatsReadyAndRegionNotTooLarge
        return !self.loading && (self.features !== undefined || fetchWillNotRun)
      },
    }))

    .actions(self => ({
      /**
       * #action
       */
      selectFeature(feature: Feature) {
        openFeatureWidget(self, feature.toJSON(), {
          widget: { type: 'VariantFeatureWidget', id: 'variantFeature' },
        })
      },
      /**
       * #action
       */
      setLoading(flag: boolean) {
        self.loading = flag
      },
      /**
       * #action
       */
      setFeatures(f: Feature[]) {
        self.features = f
      },
    }))

    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach.tsx')
            doAfterAttach(self as LinearArcDisplayModel)
          } catch (e) {
            console.error(e)
            self.setError(e)
          }
        })()
      },
      /**
       * #action
       */
      async renderSvg(opts: {
        rasterizeLayers?: boolean
      }): Promise<React.ReactNode> {
        const { renderArcSvg } = await import('./renderSvg.tsx')
        return renderArcSvg(self as LinearArcDisplayModel, opts)
      },
    }))
}

export type LinearArcDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearArcDisplayModel = Instance<LinearArcDisplayStateModel>
