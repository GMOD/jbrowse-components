import type React from 'react'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  getSession,
  isSessionModelWithWidgets,
  getContainingView,
  getContainingTrack,
  isSelectionContainer,
} from '@jbrowse/core/util'
import {
  FeatureDensityMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from 'mobx-state-tree'

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
        /**
         * #property
         */
        displayMode: types.maybe(types.string),
      }),
    )
    .volatile(() => ({
      lastDrawnOffsetPx: 0,
      features: undefined as Feature[] | undefined,
      loading: false,
      drawn: true,
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
              view: getContainingView(self),
              track: getContainingTrack(self),
              featureData: feature.toJSON(),
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
      setLoading(flag: boolean) {
        self.loading = flag
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
      setDisplayMode(flag: string) {
        self.displayMode = flag
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
