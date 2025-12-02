import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { getEnv, types } from '@jbrowse/mobx-state-tree'
import {
  FeatureDensityMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

function formatResolution(res: number) {
  if (res >= 1_000_000) {
    return `${res / 1_000_000}M`
  }
  if (res >= 1_000) {
    return `${res / 1_000}K`
  }
  return `${res}`
}

/**
 * #stateModel LinearHicDisplay
 * #category display
 * Non-block-based Hi-C display that renders to a single canvas
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 * - [FeatureDensityMixin](../featuredensitymixin)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearHicDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      FeatureDensityMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearHicDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * explicit resolution value from availableResolutions, or 0 for auto
         */
        resolution: types.optional(types.number, 0),
        /**
         * #property
         */
        useLogScale: false,
        /**
         * #property
         */
        colorScheme: types.maybe(types.string),
        /**
         * #property
         */
        activeNormalization: 'KR',
        /**
         * #property
         */
        mode: 'triangular',
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      availableNormalizations: undefined as string[] | undefined,
      /**
       * #volatile
       */
      availableResolutions: undefined as number[] | undefined,
      /**
       * #volatile
       */
      loading: false,
      /**
       * #volatile
       */
      lastDrawnOffsetPx: undefined as number | undefined,
      /**
       * #volatile
       */
      lastDrawnBpPerPx: 0,
      /**
       * #volatile
       */
      ref: null as HTMLCanvasElement | null,
      /**
       * #volatile
       */
      renderingImageData: undefined as ImageBitmap | undefined,
      /**
       * #volatile
       */
      renderingStopToken: undefined as string | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get drawn() {
        return self.lastDrawnOffsetPx !== undefined
      },
      /**
       * #getter
       */
      get rendererTypeName() {
        return 'HicRenderer'
      },
      /**
       * #method
       */
      renderProps() {
        return {
          config: self.rendererType.configSchema.create(
            {
              ...getConf(self, 'renderer'),
              ...(self.colorScheme
                ? { color: 'jexl:interpolate(count,scale)' }
                : {}),
            },
            getEnv(self),
          ),
          resolution: self.resolution,
          useLogScale: self.useLogScale,
          colorScheme: self.colorScheme,
          normalization: self.activeNormalization,
          displayHeight: self.mode === 'adjust' ? self.height : undefined,
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setLastDrawnOffsetPx(n: number) {
        self.lastDrawnOffsetPx = n
      },
      /**
       * #action
       */
      setLastDrawnBpPerPx(n: number) {
        self.lastDrawnBpPerPx = n
      },
      /**
       * #action
       */
      setLoading(f: boolean) {
        self.loading = f
      },
      /**
       * #action
       */
      setRef(ref: HTMLCanvasElement | null) {
        self.ref = ref
      },
      /**
       * #action
       */
      setRenderingImageData(imageData: ImageBitmap | undefined) {
        self.renderingImageData = imageData
      },
      /**
       * #action
       */
      setRenderingStopToken(token: string | undefined) {
        self.renderingStopToken = token
      },
      /**
       * #action
       */
      reload() {
        self.error = undefined
      },
      /**
       * #action
       */
      setResolution(n: number) {
        self.resolution = n
      },
      /**
       * #action
       */
      setUseLogScale(f: boolean) {
        self.useLogScale = f
      },
      /**
       * #action
       */
      setColorScheme(f?: string) {
        self.colorScheme = f
      },
      /**
       * #action
       */
      setActiveNormalization(f: string) {
        self.activeNormalization = f
      },
      /**
       * #action
       */
      setAvailableNormalizations(f: string[]) {
        self.availableNormalizations = f
      },
      /**
       * #action
       */
      setAvailableResolutions(f: number[]) {
        self.availableResolutions = f
      },
      /**
       * #action
       */
      setMode(arg: string) {
        self.mode = arg
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Use log scale',
              type: 'checkbox',
              checked: self.useLogScale,
              onClick: () => {
                self.setUseLogScale(!self.useLogScale)
              },
            },
            {
              label: 'Rendering mode',
              type: 'subMenu',
              subMenu: [
                {
                  label: 'Triangular',
                  type: 'radio',
                  checked: self.mode === 'triangular',
                  onClick: () => {
                    self.setMode('triangular')
                  },
                },
                {
                  label: 'Adjust to height of display',
                  type: 'radio',
                  checked: self.mode === 'adjust',
                  onClick: () => {
                    self.setMode('adjust')
                  },
                },
              ],
            },
            {
              label: 'Color scheme',
              type: 'subMenu',
              subMenu: [
                {
                  label: 'Fall',
                  type: 'radio',
                  checked: self.colorScheme === 'fall',
                  onClick: () => {
                    self.setColorScheme('fall')
                  },
                },
                {
                  label: 'Viridis',
                  type: 'radio',
                  checked: self.colorScheme === 'viridis',
                  onClick: () => {
                    self.setColorScheme('viridis')
                  },
                },
                {
                  label: 'Juicebox',
                  type: 'radio',
                  checked: self.colorScheme === 'juicebox',
                  onClick: () => {
                    self.setColorScheme('juicebox')
                  },
                },
                {
                  label: 'Default',
                  type: 'radio',
                  checked: self.colorScheme === undefined,
                  onClick: () => {
                    self.setColorScheme(undefined)
                  },
                },
              ],
            },

            ...(self.availableResolutions
              ? [
                  {
                    label: 'Resolution',
                    subMenu: [
                      {
                        label: 'Auto',
                        type: 'radio',
                        checked: self.resolution === 0,
                        onClick: () => {
                          self.setResolution(0)
                        },
                      },
                      ...self.availableResolutions.map(res => ({
                        label: formatResolution(res),
                        type: 'radio',
                        checked: self.resolution === res,
                        onClick: () => {
                          self.setResolution(res)
                        },
                      })),
                    ],
                  },
                ]
              : []),
            ...(self.availableNormalizations
              ? [
                  {
                    label: 'Normalization scheme',
                    subMenu: self.availableNormalizations.map(norm => ({
                      label: norm,
                      type: 'radio',
                      checked: norm === self.activeNormalization,
                      onClick: () => {
                        self.setActiveNormalization(norm)
                      },
                    })),
                  },
                ]
              : []),
          ]
        },
      }
    })
    .actions(self => ({
      beforeDestroy() {
        if (self.renderingStopToken) {
          stopStopToken(self.renderingStopToken)
        }
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
    }))
}

export type LinearHicDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearHicDisplayModel = Instance<LinearHicDisplayStateModel>
