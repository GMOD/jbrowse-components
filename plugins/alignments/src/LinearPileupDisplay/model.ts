import { lazy } from 'react'
import { types, Instance } from 'mobx-state-tree'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
  readConfObject,
  getConf,
} from '@jbrowse/core/configuration'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { getEnv, getSession, getContainingView } from '@jbrowse/core/util'
import { getUniqueModificationValues } from '../shared'

import { createAutorun, randomColor, modificationColors } from '../util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// icons
import VisibilityIcon from '@mui/icons-material/Visibility'
import SortIcon from '@mui/icons-material/Sort'

// locals
import { SharedLinearPileupDisplayMixin } from './SharedLinearPileupDisplayMixin'
import { observable } from 'mobx'

// lzies
const SortByTagDialog = lazy(() => import('./components/SortByTag'))
const ModificationsDialog = lazy(
  () => import('./components/ColorByModifications'),
)

type LGV = LinearGenomeViewModel

/**
 * #stateModel LinearPileupDisplay
 * #category display
 * extends
 *- [SharedLinearPileupDisplayMixin](../sharedlinearpileupdisplaymixin)
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearPileupDisplay',
      SharedLinearPileupDisplayMixin(configSchema),
      types.model({
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),

        /**
         * #property
         */
        mismatchAlpha: types.maybe(types.boolean),

        /**
         * #property
         */
        showSoftClipping: false,

        /**
         * #property
         */
        sortedBy: types.maybe(
          types.model({
            assemblyName: types.string,
            pos: types.number,
            refName: types.string,
            tag: types.maybe(types.string),
            type: types.string,
          }),
        ),

        /**
         * #property
         */
        type: types.literal('LinearPileupDisplay'),
      }),
    )
    .volatile(() => ({
      currSortBpPerPx: 0,
      modificationTagMap: observable.map<string, string>({}),
      modificationsReady: false,
      sortReady: false,
    }))
    .actions(self => ({
      /**
       * #action
       */
      clearSelected() {
        self.sortedBy = undefined
      },

      /**
       * #action
       */
      setCurrSortBpPerPx(n: number) {
        self.currSortBpPerPx = n
      },

      /**
       * #action
       * overrides base from SharedLinearPileupDisplay to make sortReady false
       * since changing feature height destroys the sort-induced layout
       */
      setFeatureHeight(n?: number) {
        self.sortReady = false
        self.featureHeight = n
      },

      /**
       * #action
       */
      setModificationsReady(flag: boolean) {
        self.modificationsReady = flag
      },

      /**
       * #action
       */
      setSortReady(flag: boolean) {
        self.sortReady = flag
      },

      /**
       * #action
       */
      setSortedBy(type: string, tag?: string) {
        const { centerLineInfo } = getContainingView(self) as LGV
        if (!centerLineInfo) {
          return
        }
        const { refName, assemblyName, offset } = centerLineInfo
        const centerBp = Math.round(offset) + 1

        if (centerBp < 0 || !refName) {
          return
        }

        self.sortReady = false
        self.sortedBy = {
          assemblyName,
          pos: centerBp,
          refName,
          tag,
          type,
        }
      },

      /**
       * #action
       */
      toggleMismatchAlpha() {
        self.mismatchAlpha = !self.mismatchAlpha
      },

      /**
       * #action
       */
      toggleSoftClipping() {
        self.showSoftClipping = !self.showSoftClipping
      },

      /**
       * #action
       */
      updateModificationColorMap(uniqueModifications: string[]) {
        uniqueModifications.forEach(value => {
          if (!self.modificationTagMap.has(value)) {
            self.modificationTagMap.set(
              value,
              modificationColors[value] || randomColor(),
            )
          }
        })
      },
    }))
    .actions(self => {
      // resets the sort object and refresh whole display on reload
      const superReload = self.reload

      return {
        /**
         * #action
         */
        reload() {
          self.clearSelected()
          superReload()
        },
      }
    })

    .views(self => ({
      /**
       * #getter
       */
      get rendererConfig() {
        const {
          featureHeight,
          noSpacing,
          trackMaxHeight,
          mismatchAlpha,
          rendererTypeName,
        } = self
        const configBlob = getConf(self, ['renderers', rendererTypeName]) || {}
        return self.rendererType.configSchema.create(
          {
            ...configBlob,
            ...(featureHeight !== undefined ? { height: featureHeight } : {}),
            ...(noSpacing !== undefined ? { noSpacing } : {}),
            ...(mismatchAlpha !== undefined ? { mismatchAlpha } : {}),
            ...(trackMaxHeight !== undefined
              ? { maxHeight: trackMaxHeight }
              : {}),
          },
          getEnv(self),
        )
      },
    }))
    .views(self => {
      const { renderReady: superRenderReady } = self
      return {
        /**
         * #getter
         */
        get mismatchAlphaSetting() {
          return readConfObject(self.rendererConfig, 'mismatchAlpha')
        },
        /**
         * #method
         */
        renderReady() {
          const view = getContainingView(self) as LGV
          return (
            self.modificationsReady &&
            self.currSortBpPerPx === view.bpPerPx &&
            superRenderReady()
          )
        },
      }
    })
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderPropsPre: superRenderPropsPre,
        renderProps: superRenderProps,
        colorSchemeSubMenuItems: superColorSchemeSubMenuItems,
      } = self

      return {
        /**
         * #method
         */
        renderProps() {
          const { sortReady } = self
          const result = superRenderProps()
          return {
            ...result,
            notReady: result.notReady || !sortReady,
          }
        },

        /**
         * #method
         */
        renderPropsPre() {
          const { sortedBy, showSoftClipping, modificationTagMap } = self
          const superProps = superRenderPropsPre()
          return {
            ...superProps,
            modificationTagMap: Object.fromEntries(modificationTagMap.toJSON()),
            showSoftClip: showSoftClipping,
            sortedBy,
          }
        },

        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              checked: self.showSoftClipping,
              icon: VisibilityIcon,
              label: 'Show soft clipping',
              onClick: () => {
                self.toggleSoftClipping()
                // if toggling from off to on, will break sort for this track
                // so clear it
                if (self.showSoftClipping) {
                  self.clearSelected()
                }
              },
              type: 'checkbox',
            },
            {
              disabled: self.showSoftClipping,
              icon: SortIcon,
              label: 'Sort by',
              subMenu: [
                ...['Start location', 'Read strand', 'Base pair'].map(
                  option => ({
                    label: option,
                    onClick: () => self.setSortedBy(option),
                  }),
                ),
                {
                  label: 'Sort by tag...',
                  onClick: () => {
                    getSession(self).queueDialog(handleClose => [
                      SortByTagDialog,
                      { handleClose, model: self },
                    ])
                  },
                },
                {
                  label: 'Clear sort',
                  onClick: () => self.clearSelected(),
                },
              ],
            },
            {
              label: 'Color scheme',
              subMenu: [
                {
                  label: 'Pair orientation',
                  onClick: () =>
                    self.setColorScheme({ type: 'pairOrientation' }),
                },
                {
                  label: 'Modifications or methylation',
                  onClick: () => {
                    getSession(self).queueDialog(doneCallback => [
                      ModificationsDialog,
                      { handleClose: doneCallback, model: self },
                    ])
                  },
                },
                {
                  label: 'Insert size',
                  onClick: () => self.setColorScheme({ type: 'insertSize' }),
                },
                ...superColorSchemeSubMenuItems(),
              ],
            },
            {
              checked: self.mismatchAlphaSetting,
              label: 'Fade mismatches by quality',
              onClick: () => self.toggleMismatchAlpha(),
              type: 'checkbox',
            },
          ]
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        createAutorun(
          self,
          async () => {
            const view = getContainingView(self) as LGV
            if (!self.autorunReady) {
              return
            }

            const { bpPerPx } = view

            self.setCurrSortBpPerPx(bpPerPx)
          },
          { delay: 1000 },
        )
        createAutorun(
          self,
          async () => {
            const { rpcManager } = getSession(self)
            const view = getContainingView(self) as LGV
            if (!self.autorunReady) {
              return
            }

            const { sortedBy, adapterConfig, rendererType, sortReady } = self
            const { bpPerPx } = view

            if (
              sortedBy &&
              (!sortReady || self.currSortBpPerPx === view.bpPerPx)
            ) {
              const { pos, refName, assemblyName } = sortedBy
              // render just the sorted region first
              // @ts-expect-error
              await self.rendererType.renderInClient(rpcManager, {
                adapterConfig,
                assemblyName,
                layoutId: view.id,
                regions: [
                  {
                    assemblyName,
                    end: pos + 1,
                    refName,
                    start: pos,
                  },
                ],
                rendererType: rendererType.name,
                sessionId: getRpcSessionId(self),
                timeout: 1_000_000,
                ...self.renderPropsPre(),
              })
            }
            self.setCurrSortBpPerPx(bpPerPx)
            self.setSortReady(true)
          },
          { delay: 1000 },
        )

        createAutorun(self, async () => {
          if (!self.autorunReady) {
            return
          }
          const { parentTrack, colorBy } = self
          const { staticBlocks } = getContainingView(self) as LGV
          if (colorBy?.type === 'modifications') {
            const adapter = getConf(parentTrack, ['adapter'])
            const vals = await getUniqueModificationValues(
              self,
              adapter,
              colorBy,
              staticBlocks,
            )
            self.updateModificationColorMap(vals)
          }
          self.setModificationsReady(true)
        })
      },
    }))
}

export type LinearPileupDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearPileupDisplayModel = Instance<LinearPileupDisplayStateModel>
export default stateModelFactory
