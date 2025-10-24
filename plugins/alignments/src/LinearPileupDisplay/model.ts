import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getContainingView, getEnv, getSession } from '@jbrowse/core/util'
import ColorLensIcon from '@mui/icons-material/ColorLens'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import VisibilityIcon from '@mui/icons-material/Visibility'
import WorkspacesIcon from '@mui/icons-material/Workspaces'
import { observable } from 'mobx'
import { types } from 'mobx-state-tree'

import { SharedLinearPileupDisplayMixin } from './SharedLinearPileupDisplayMixin'
import { modificationData } from '../shared/modificationData'
import { getColorForModification } from '../util'

import type {
  ModificationType,
  ModificationTypeWithColor,
  SortedBy,
} from '../shared/types'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Instance } from 'mobx-state-tree'

// lazies
const SortByTagDialog = lazy(() => import('./components/SortByTagDialog'))
const GroupByDialog = lazy(() => import('./components/GroupByDialog'))
const SetModificationThresholdDialog = lazy(
  () => import('./components/SetModificationThresholdDialog'),
)

type LGV = LinearGenomeViewModel

/**
 * #stateModel LinearPileupDisplay
 * #category display
 * extends
 * - [SharedLinearPileupDisplayMixin](../sharedlinearpileupdisplaymixin)
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
        modificationThreshold: types.optional(types.number, 10),

        /**
         * #property
         */
        sortedBy: types.frozen<SortedBy | undefined>(),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      sortReady: false,
      /**
       * #volatile
       */
      currSortBpPerPx: 0,
      /**
       * #volatile
       */
      visibleModifications: observable.map<string, ModificationTypeWithColor>(
        {},
      ),
      /**
       * #volatile
       */
      simplexModifications: new Set<string>(),
      /**
       * #volatile
       */
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
      updateVisibleModifications(uniqueModifications: ModificationType[]) {
        for (const value of uniqueModifications) {
          if (!self.visibleModifications.has(value.type)) {
            self.visibleModifications.set(value.type, {
              ...value,
              color: getColorForModification(value.type),
            })
          }
        }
      },
      /**
       * #action
       */
      setSimplexModifications(simplex: string[]) {
        for (const entry of simplex) {
          self.simplexModifications.add(entry)
        }
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
      setModificationThreshold(threshold: number) {
        self.modificationThreshold = threshold
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
      /**
       * #action
       * overrides base from SharedLinearPileupDisplay to make sortReady false
       * since changing feature height destroys the sort-induced layout
       */
      setFeatureHeight(n?: number) {
        self.sortReady = false
        self.featureHeight = n
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
      get visibleModificationTypes() {
        return [...self.visibleModifications.keys()]
      },
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
          hideSmallIndels,
        } = self
        const configBlob = getConf(self, ['renderers', rendererTypeName]) || {}
        return self.rendererType.configSchema.create(
          {
            ...configBlob,
            ...(featureHeight !== undefined ? { height: featureHeight } : {}),
            ...(hideSmallIndels !== undefined ? { hideSmallIndels } : {}),
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
          const {
            sortedBy,
            showSoftClipping,
            visibleModifications,
            simplexModifications,
            modificationThreshold,
          } = self
          const superProps = superRenderPropsPre()
          return {
            ...superProps,
            showSoftClip: showSoftClipping,
            sortedBy,
            visibleModifications: Object.fromEntries(
              visibleModifications.toJSON(),
            ),
            simplexModifications: [...simplexModifications],
            modificationThreshold,
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
              label: 'Sort by...',
              icon: SwapVertIcon,
              disabled: self.showSoftClipping,
              subMenu: [
                ...['Start location', 'Read strand', 'Base pair'].map(
                  option => ({
                    label: option,
                    onClick: () => {
                      self.setSortedBy(option)
                    },
                  }),
                ),
                {
                  label: 'Sort by tag...',
                  onClick: () => {
                    getSession(self).queueDialog(handleClose => [
                      SortByTagDialog,
                      {
                        model: self,
                        handleClose,
                      },
                    ])
                  },
                },
                {
                  label: 'Clear sort',
                  onClick: () => {
                    self.clearSelected()
                  },
                },
              ],
            },
            {
              label: 'Color by...',
              icon: ColorLensIcon,
              subMenu: [
                {
                  label: 'Pair orientation',
                  onClick: () => {
                    self.setColorScheme({
                      type: 'pairOrientation',
                    })
                  },
                },
                {
                  label: 'Modifications',
                  type: 'subMenu',
                  subMenu: self.modificationsReady
                    ? [
                        {
                          label: `All modifications (>= ${self.modificationThreshold}% prob)`,
                          onClick: () => {
                            self.setColorScheme({
                              type: 'modifications',
                            })
                          },
                        },
                        ...self.visibleModificationTypes.map(key => ({
                          label: `Show only ${modificationData[key]?.name || key}  (>= ${self.modificationThreshold}% prob)`,
                          onClick: () => {
                            self.setColorScheme({
                              type: 'modifications',
                              modifications: {
                                isolatedModification: key,
                              },
                            })
                          },
                        })),
                        { type: 'divider' },
                        {
                          label: 'All modifications (<50% prob colored blue)',
                          onClick: () => {
                            self.setColorScheme({
                              type: 'modifications',
                              modifications: {
                                twoColor: true,
                              },
                            })
                          },
                        },
                        ...self.visibleModificationTypes.map(key => ({
                          label: `Show only ${modificationData[key]?.name || key} (<50% prob colored blue)`,
                          onClick: () => {
                            self.setColorScheme({
                              type: 'modifications',
                              modifications: {
                                isolatedModification: key,
                                twoColor: true,
                              },
                            })
                          },
                        })),
                        { type: 'divider' },
                        {
                          label: 'All reference CpGs',
                          onClick: () => {
                            self.setColorScheme({
                              type: 'methylation',
                            })
                          },
                        },
                        { type: 'divider' },
                        {
                          label: `Adjust threshold (${self.modificationThreshold}%)`,
                          onClick: () => {
                            getSession(self).queueDialog(handleClose => [
                              SetModificationThresholdDialog,
                              {
                                model: self,
                                handleClose,
                              },
                            ])
                          },
                        },
                      ]
                    : [
                        {
                          label: 'Loading modifications...',
                          onClick: () => {},
                        },
                      ],
                },
                {
                  label: 'Insert size',
                  onClick: () => {
                    self.setColorScheme({
                      type: 'insertSize',
                    })
                  },
                },
                ...superColorSchemeSubMenuItems(),
              ],
            },
            {
              label: 'Group by...',
              icon: WorkspacesIcon,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  GroupByDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
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
              label: 'Fade mismatches by quality',
              type: 'checkbox',
              checked: self.mismatchAlphaSetting,
              onClick: () => {
                self.toggleMismatchAlpha()
              },
            },
          ] as const
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./doAfterAttach')
            doAfterAttach(self)
          } catch (e) {
            getSession(self).notifyError(`${e}`, e)
            console.error(e)
          }
        })()
      },
    }))
}

export type LinearPileupDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearPileupDisplayModel = Instance<LinearPileupDisplayStateModel>
export default stateModelFactory
