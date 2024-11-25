import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getContainingTrack, getSession } from '@jbrowse/core/util'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'
import { types, getEnv, addDisposer } from 'mobx-state-tree'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

/**
 * #stateModel LinearHicDisplay
 * #category display
 * extends `BaseLinearDisplay`
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearHicDisplay',
      BaseLinearDisplay,
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
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      availableNormalizations: undefined as string[] | undefined,
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #getter
         */
        get blockType() {
          return 'dynamicBlocks'
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
          const config = self.rendererType.configSchema.create(
            {
              ...getConf(self, 'renderer'),

              // add specific jexl color callback when using pre-defined color schemes
              ...(self.colorScheme
                ? { color: 'jexl:interpolate(count,scale)' }
                : {}),
            },
            getEnv(self),
          )

          return {
            ...superRenderProps(),
            config,
            normalization: self.activeNormalization,
            rpcDriverName: self.rpcDriverName,
            displayModel: self,
            resolution: self.resolution,
            useLogScale: self.useLogScale,
            colorScheme: self.colorScheme,
          }
        },
      }
    })
    .actions(self => ({
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
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #getter
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
              label: 'Color scheme',
              type: 'subMenu',
              subMenu: [
                {
                  label: 'Fall',
                  onClick: () => {
                    self.setColorScheme('fall')
                  },
                },
                {
                  label: 'Viridis',
                  onClick: () => {
                    self.setColorScheme('viridis')
                  },
                },
                {
                  label: 'Juicebox',
                  onClick: () => {
                    self.setColorScheme('juicebox')
                  },
                },
                {
                  label: 'Clear',
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
                      type: 'checkbox',
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
      afterAttach() {
        addDisposer(
          self,
          autorun(async () => {
            try {
              const { rpcManager } = getSession(self)
              const track = getContainingTrack(self)
              const adapterConfig = getConf(track, 'adapter')
              const { norms } = (await rpcManager.call(
                getConf(track, 'trackId'),
                'CoreGetInfo',
                {
                  adapterConfig,
                },
              )) as { norms?: string[] }
              if (norms) {
                self.setAvailableNormalizations(norms)
              }
            } catch (e) {
              console.error(e)
              getSession(self).notifyError(`${e}`, e)
            }
          }),
        )
      },
    }))
}
