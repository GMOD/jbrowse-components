import { lazy } from 'react'
import { types, getSnapshot, Instance } from 'mobx-state-tree'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
  readConfObject,
  getConf,
} from '@jbrowse/core/configuration'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  getEnv,
  getSession,
  getContainingView,
  SimpleFeature,
} from '@jbrowse/core/util'

import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// icons
import VisibilityIcon from '@mui/icons-material/Visibility'
import SortIcon from '@mui/icons-material/Sort'

// locals
import { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'
import { createAutorun } from '../util'
import { SharedLinearPileupDisplayMixin } from './SharedLinearPileupDisplayMixin'

// async
const SortByTagDlg = lazy(() => import('./components/SortByTag'))
const ModificationsDlg = lazy(() => import('./components/ColorByModifications'))

type LGV = LinearGenomeViewModel

export interface Filter {
  flagInclude: number
  flagExclude: number
  readName?: string
  tagFilter?: { tag: string; value: string }
}

/**
 * #stateModel LinearPileupDisplay
 * #category display
 * extends `BaseLinearDisplay`
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
    }))
    .actions(self => ({
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
    .views(self => ({
      /**
       * #getter
       */
      get mismatchAlphaSetting() {
        return readConfObject(self.rendererConfig, 'mismatchAlpha')
      },
      /**
       * #getter
       */
      get renderReady() {
        const view = getContainingView(self) as LGV
        return (
          self.modificationsReady &&
          self.tagsReady &&
          self.currSortBpPerPx === view.bpPerPx
        )
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
        colorSchemeSubMenuItems: superColorSchemeSubMenuItems,
      } = self

      console.log(superColorSchemeSubMenuItems())

      return {
        /**
         * #method
         */
        renderPropsPre() {
          const {
            colorTagMap,
            modificationTagMap,
            sortedBy,
            colorBy,
            filterBy,
            rpcDriverName,
          } = self

          const superProps = superRenderProps()
          return {
            ...superProps,
            notReady: superProps.notReady || !self.renderReady,
            rpcDriverName,
            displayModel: self,
            sortedBy: sortedBy ? getSnapshot(sortedBy) : undefined,
            colorBy: colorBy ? getSnapshot(colorBy) : undefined,
            filterBy: JSON.parse(JSON.stringify(filterBy)),
            colorTagMap: Object.fromEntries(colorTagMap.toJSON()),
            modificationTagMap: Object.fromEntries(modificationTagMap.toJSON()),
            showSoftClip: self.showSoftClipping,
            config: self.rendererConfig,
            async onFeatureClick(_: unknown, featureId?: string) {
              const session = getSession(self)
              const { rpcManager } = session
              try {
                const f = featureId || self.featureIdUnderMouse
                if (!f) {
                  self.clearFeatureSelection()
                } else {
                  const sessionId = getRpcSessionId(self)
                  const { feature } = (await rpcManager.call(
                    sessionId,
                    'CoreGetFeatureDetails',
                    {
                      featureId: f,
                      sessionId,
                      layoutId: getContainingView(self).id,
                      rendererType: 'PileupRenderer',
                    },
                  )) as { feature: SimpleFeatureSerialized | undefined }

                  if (feature) {
                    self.selectFeature(new SimpleFeature(feature))
                  }
                }
              } catch (e) {
                console.error(e)
                session.notify(`${e}`)
              }
            },

            onClick() {
              self.clearFeatureSelection()
            },
            // similar to click but opens a menu with further options
            async onFeatureContextMenu(_: unknown, featureId?: string) {
              const session = getSession(self)
              const { rpcManager } = session
              try {
                const f = featureId || self.featureIdUnderMouse
                if (!f) {
                  self.clearFeatureSelection()
                } else {
                  const sessionId = getRpcSessionId(self)
                  const { feature } = (await rpcManager.call(
                    sessionId,
                    'CoreGetFeatureDetails',
                    {
                      featureId: f,
                      sessionId,
                      layoutId: getContainingView(self).id,
                      rendererType: 'PileupRenderer',
                    },
                  )) as { feature: SimpleFeatureSerialized }

                  if (feature) {
                    self.setContextMenuFeature(new SimpleFeature(feature))
                  }
                }
              } catch (e) {
                console.error(e)
                session.notify(`${e}`)
              }
            },
          }
        },

        // renderProps and renderPropsPre are separated due to sortReady
        // causing a infinite loop in the sort autorun, since the sort autorun
        // uses renderProps
        /**
         * #method
         */
        renderProps() {
          const pre = this.renderPropsPre()
          return {
            ...pre,
            notReady: pre.notReady || !self.sortReady,
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
            const { rpcManager } = getSession(self)
            const view = getContainingView(self) as LGV
            if (!self.autorunReady) {
              return
            }

            const { sortedBy, adapterConfig, rendererType } = self
            const { bpPerPx } = view

            if (sortedBy) {
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
      },
    }))
}

export type LinearPileupDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearPileupDisplayModel = Instance<LinearPileupDisplayStateModel>
export default stateModelFactory
