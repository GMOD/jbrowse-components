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

// async
const SortByTagDlg = lazy(() => import('./components/SortByTag'))
const ModificationsDlg = lazy(() => import('./components/ColorByModifications'))

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
        type: types.literal('LinearPileupDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        showSoftClipping: false,
        /**
         * #property
         */
        mismatchAlpha: types.maybe(types.boolean),

        /**
         * #property
         */
        sortedBy: types.maybe(
          types.model({
            type: types.string,
            pos: types.number,
            tag: types.maybe(types.string),
            refName: types.string,
            assemblyName: types.string,
          }),
        ),
      }),
    )
    .volatile(() => ({
      sortReady: false,
      currSortBpPerPx: 0,
      modificationTagMap: observable.map<string, string>({}),
      modificationsReady: false,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setCurrSortBpPerPx(n: number) {
        self.currSortBpPerPx = n
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
      clearSelected() {
        self.sortedBy = undefined
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
      toggleMismatchAlpha() {
        self.mismatchAlpha = !self.mismatchAlpha
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
          type,
          pos: centerBp,
          refName,
          assemblyName,
          tag,
        }
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
        renderPropsPre() {
          const { sortedBy, showSoftClipping, modificationTagMap } = self
          const superProps = superRenderPropsPre()
          return {
            ...superProps,
            showSoftClip: showSoftClipping,
            sortedBy,
            modificationTagMap: Object.fromEntries(modificationTagMap.toJSON()),
          }
        },
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
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Show soft clipping',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: self.showSoftClipping,
              onClick: () => {
                self.toggleSoftClipping()
                // if toggling from off to on, will break sort for this track
                // so clear it
                if (self.showSoftClipping) {
                  self.clearSelected()
                }
              },
            },
            {
              label: 'Sort by',
              icon: SortIcon,
              disabled: self.showSoftClipping,
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
                      SortByTagDlg,
                      { model: self, handleClose },
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
                      ModificationsDlg,
                      { model: self, handleClose: doneCallback },
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
              label: 'Fade mismatches by quality',
              type: 'checkbox',
              checked: self.mismatchAlphaSetting,
              onClick: () => self.toggleMismatchAlpha(),
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
                assemblyName,
                regions: [
                  {
                    start: pos,
                    end: pos + 1,
                    refName,
                    assemblyName,
                  },
                ],
                adapterConfig,
                rendererType: rendererType.name,
                sessionId: getRpcSessionId(self),
                layoutId: view.id,
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
