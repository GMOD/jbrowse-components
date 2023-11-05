import React from 'react'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
  getConf,
} from '@jbrowse/core/configuration'
import { Instance, types } from 'mobx-state-tree'
import {
  getEnv,
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
 * #stateModel LinearArcDisplay
 * extends BaseDisplay
 */
export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearArcDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      FeatureDensityMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearArcDisplay'),
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
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get displayModeSetting() {
        return self.displayMode ?? getConf(self, ['renderer', 'displayMode'])
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rendererConfig() {
        const configBlob = getConf(self, ['renderer']) || {}
        const config = configBlob as Omit<typeof configBlob, symbol>
        return self.rendererType.configSchema.create(
          {
            ...config,
            displayMode: self.displayModeSetting,
          },
          getEnv(self),
        )
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
            'BaseFeatureWidget',
            'baseFeature',
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
    .views(self => {
      const superMenuItems = self.trackMenuItems
      return {
        /**
         * #method
         */
        trackMenuItems() {
          const { displayMode } = self
          return [
            ...superMenuItems(),
            {
              label: 'Display mode',
              subMenu: [
                {
                  type: 'radio',
                  label: 'Arcs',
                  onClick: () => self.setDisplayMode('arcs'),
                  checked: displayMode === 'arcs',
                },
                {
                  type: 'radio',
                  label: 'Semi-circles',
                  onClick: () => self.setDisplayMode('semicircles'),
                  checked: displayMode === 'semicircles',
                },
              ],
            },
          ]
        },
      }
    })
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
