import React from 'react'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
  getConf,
} from '@jbrowse/core/configuration'
import { Instance, types } from 'mobx-state-tree'
import {
  Feature,
  getSession,
  isSessionModelWithWidgets,
  getContainingView,
  getContainingTrack,
  isSelectionContainer,
} from '@jbrowse/core/util'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  FeatureDensityMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

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
        configuration: ConfigurationReference(configSchema),

        /**
         * #property
         */
        displayMode: types.maybe(types.string),

        /**
         * #property
         */
        type: types.literal('LinearPairedArcDisplay'),
      }),
    )
    .volatile(() => ({
      drawn: true,
      features: undefined as Feature[] | undefined,
      lastDrawnOffsetPx: 0,
      loading: false,
    }))

    .views(self => ({
      /**
       * #getter
       */
      get displayModeSetting() {
        return self.displayMode ?? getConf(self, ['renderer', 'displayMode'])
      },
    }))

    .actions(self => ({
      /**
       * #action
       */
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const featureWidget = session.addWidget(
            'VariantFeatureWidget',
            'variantFeature',
            {
              featureData: feature.toJSON(),
              track: getContainingTrack(self),
              view: getContainingView(self),
            },
          )

          session.showWidget(featureWidget)
        }
        if (isSelectionContainer(session)) {
          session.setSelection(feature)
        }
      },

      /**
       * #action
       */
      setDisplayMode(flag: string) {
        self.displayMode = flag
      },

      /**
       * #action
       */
      setFeatures(f: Feature[]) {
        self.features = f
      },

      /**
       * #action
       */
      setLoading(flag: boolean) {
        self.loading = flag
      },
    }))

    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach')
            doAfterAttach(self)
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
        const { renderArcSvg } = await import('./renderSvg')
        // @ts-expect-error
        return renderArcSvg(self, opts)
      },
    }))
}

export type LinearArcDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearArcDisplayModel = Instance<LinearArcDisplayStateModel>
