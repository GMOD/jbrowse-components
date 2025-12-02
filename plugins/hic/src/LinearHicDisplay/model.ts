import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { getContainingView } from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { getEnv, types } from '@jbrowse/mobx-state-tree'
import {
  FeatureDensityMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
         */
        resolution: types.optional(types.number, 1),
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
    .views(self => {
      const superHeight = Object.getOwnPropertyDescriptor(self, 'height')
      return {
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
         * #getter
         * override height to calculate triangular height when not in adjust mode
         */
        get height() {
          const configHeight = superHeight?.get?.call(self) ?? 100
          if (self.mode === 'adjust') {
            return configHeight
          }
          // In triangular mode, calculate height based on view width
          // The triangle's height is width / 2 for a 45-degree rotation
          // @ts-expect-error
          const view = getContainingView(self) as { dynamicBlocks?: { totalWidthPx: number } }
          const width = view?.dynamicBlocks?.totalWidthPx ?? 800
          return Math.round(width / 2)
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

            {
              label: 'Resolution',
              subMenu: [
                {
                  label: 'Finer resolution',
                  onClick: () => {
                    self.setResolution(self.resolution * 2)
                  },
                },
                {
                  label: 'Coarser resolution',
                  onClick: () => {
                    self.setResolution(self.resolution / 2)
                  },
                },
              ],
            },
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
