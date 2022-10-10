import { lazy } from 'react'
import { autorun, observable } from 'mobx'
import { cast, types, addDisposer, getEnv, Instance } from 'mobx-state-tree'
import copy from 'copy-to-clipboard'
import {
  AnyConfigurationModel,
  ConfigurationReference,
  readConfObject,
  getConf,
} from '@jbrowse/core/configuration'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  getSession,
  isSessionModelWithWidgets,
  getContainingView,
  SimpleFeature,
  Feature,
} from '@jbrowse/core/util'

import {
  LinearGenomeViewModel,
  BaseLinearDisplay,
} from '@jbrowse/plugin-linear-genome-view'

// icons
import VisibilityIcon from '@mui/icons-material/Visibility'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import SortIcon from '@mui/icons-material/Sort'
import PaletteIcon from '@mui/icons-material/Palette'
import FilterListIcon from '@mui/icons-material/ClearAll'

// locals
import { LinearPileupDisplayConfigModel } from './configSchema'
import LinearPileupDisplayBlurb from './components/LinearPileupDisplayBlurb'
import { getUniqueTagValues, getUniqueModificationValues } from '../shared'
import { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

// async
const ColorByTagDlg = lazy(() => import('./components/ColorByTag'))
const FilterByTagDlg = lazy(() => import('./components/FilterByTag'))
const SortByTagDlg = lazy(() => import('./components/SortByTag'))
const SetFeatureHeightDlg = lazy(() => import('./components/SetFeatureHeight'))
const SetMaxHeightDlg = lazy(() => import('./components/SetMaxHeight'))
const ModificationsDlg = lazy(() => import('./components/ColorByModifications'))

// using a map because it preserves order
const rendererTypes = new Map([
  ['pileup', 'PileupRenderer'],
  ['svg', 'SvgFeatureRenderer'],
])

type LGV = LinearGenomeViewModel

const stateModelFactory = (configSchema: LinearPileupDisplayConfigModel) =>
  types
    .compose(
      'LinearPileupDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearPileupDisplay'),
        configuration: ConfigurationReference(configSchema),
        showSoftClipping: false,
        featureHeight: types.maybe(types.number),
        noSpacing: types.maybe(types.boolean),
        fadeLikelihood: types.maybe(types.boolean),
        trackMaxHeight: types.maybe(types.number),
        mismatchAlpha: types.maybe(types.boolean),
        sortedBy: types.maybe(
          types.model({
            type: types.string,
            pos: types.number,
            tag: types.maybe(types.string),
            refName: types.string,
            assemblyName: types.string,
          }),
        ),
        colorBy: types.maybe(
          types.model({
            type: types.string,
            tag: types.maybe(types.string),
            extra: types.frozen(),
          }),
        ),
        filterBy: types.optional(
          types.model({
            flagInclude: types.optional(types.number, 0),
            flagExclude: types.optional(types.number, 1540),
            readName: types.maybe(types.string),
            tagFilter: types.maybe(
              types.model({ tag: types.string, value: types.string }),
            ),
          }),
          {},
        ),
      }),
    )
    .volatile(() => ({
      colorTagMap: observable.map<string, string>({}),
      modificationTagMap: observable.map<string, string>({}),
      featureUnderMouseVolatile: undefined as undefined | Feature,
      ready: false,
    }))
    .actions(self => ({
      setReady(flag: boolean) {
        self.ready = flag
      },
      setMaxHeight(n: number) {
        self.trackMaxHeight = n
      },
      setFeatureHeight(n: number) {
        self.featureHeight = n
      },
      setNoSpacing(flag: boolean) {
        self.noSpacing = flag
      },

      setColorScheme(colorScheme: { type: string; tag?: string }) {
        self.colorTagMap = observable.map({}) // clear existing mapping
        self.colorBy = cast(colorScheme)
        self.ready = false
      },

      updateModificationColorMap(uniqueModifications: string[]) {
        const colorPalette = ['red', 'blue', 'green', 'orange', 'purple']
        uniqueModifications.forEach(value => {
          if (!self.modificationTagMap.has(value)) {
            const totalKeys = [...self.modificationTagMap.keys()].length
            const newColor = colorPalette[totalKeys]
            self.modificationTagMap.set(value, newColor)
          }
        })
      },

      updateColorTagMap(uniqueTag: string[]) {
        // pale color scheme
        // https://cran.r-project.org/web/packages/khroma/vignettes/tol.html
        // e.g. "tol_light"
        const colorPalette = [
          '#BBCCEE',
          'pink',
          '#CCDDAA',
          '#EEEEBB',
          '#FFCCCC',
          'lightblue',
          'lightgreen',
          'tan',
          '#CCEEFF',
          'lightsalmon',
        ]

        uniqueTag.forEach(value => {
          if (!self.colorTagMap.has(value)) {
            const totalKeys = [...self.colorTagMap.keys()].length
            const newColor = colorPalette[totalKeys]
            self.colorTagMap.set(value, newColor)
          }
        })
      },
      setFeatureUnderMouse(feat?: Feature) {
        self.featureUnderMouseVolatile = feat
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            async () => {
              try {
                const { rpcManager } = getSession(self)
                const view = getContainingView(self) as LGV
                const {
                  sortedBy,
                  colorBy,
                  parentTrack,
                  adapterConfig,
                  rendererType,
                } = self

                if (
                  !view.initialized ||
                  !self.estimatedStatsReady ||
                  self.regionTooLarge
                ) {
                  return
                }

                const { staticBlocks, bpPerPx } = view
                // continually generate the vc pairing, set and rerender if any
                // new values seen
                if (colorBy?.tag) {
                  self.updateColorTagMap(
                    await getUniqueTagValues(self, colorBy, staticBlocks),
                  )
                }

                if (colorBy?.type === 'modifications') {
                  const adapter = getConf(parentTrack, ['adapter'])
                  self.updateModificationColorMap(
                    await getUniqueModificationValues(
                      self,
                      adapter,
                      colorBy,
                      staticBlocks,
                    ),
                  )
                }

                if (sortedBy) {
                  const { pos, refName, assemblyName } = sortedBy
                  // render just the sorted region first
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
                    adapterConfig: adapterConfig,
                    rendererType: rendererType.name,
                    sessionId: getRpcSessionId(self),
                    layoutId: view.id,
                    timeout: 1000000,
                    ...self.renderProps(),
                  })
                  self.setReady(true)
                  self.setCurrBpPerPx(bpPerPx)
                } else {
                  self.setReady(true)
                }
              } catch (e) {
                console.error(e)
                self.setError(e)
              }
            },
            { delay: 1000 },
          ),
        )

        // autorun synchronizes featureUnderMouse with featureIdUnderMouse
        addDisposer(
          self,
          autorun(async () => {
            const session = getSession(self)
            try {
              const featureId = self.featureIdUnderMouse
              if (self.featureUnderMouse?.id() !== featureId) {
                if (!featureId) {
                  self.setFeatureUnderMouse(undefined)
                } else {
                  const sessionId = getRpcSessionId(self)
                  const view = getContainingView(self)
                  const { feature } = (await session.rpcManager.call(
                    sessionId,
                    'CoreGetFeatureDetails',
                    {
                      featureId,
                      sessionId,
                      layoutId: view.id,
                      rendererType: 'PileupRenderer',
                    },
                  )) as { feature: unknown }

                  // check featureIdUnderMouse is still the same as the
                  // feature.id that was returned e.g. that the user hasn't
                  // moused over to a new position during the async operation
                  // above
                  // @ts-ignore
                  if (self.featureIdUnderMouse === feature.uniqueId) {
                    // @ts-ignore
                    self.setFeatureUnderMouse(new SimpleFeature(feature))
                  }
                }
              }
            } catch (e) {
              console.error(e)
              session.notify(`${e}`, 'error')
            }
          }),
        )
      },
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const featureWidget = session.addWidget(
            'AlignmentsFeatureWidget',
            'alignmentFeature',
            { featureData: feature.toJSON(), view: getContainingView(self) },
          )
          session.showWidget(featureWidget)
        }
        session.setSelection(feature)
      },

      clearSelected() {
        self.sortedBy = undefined
      },

      // uses copy-to-clipboard and generates notification
      copyFeatureToClipboard(feature: Feature) {
        const { uniqueId, ...rest } = feature.toJSON()
        const session = getSession(self)
        copy(JSON.stringify(rest, null, 4))
        session.notify('Copied to clipboard', 'success')
      },

      toggleSoftClipping() {
        self.showSoftClipping = !self.showSoftClipping
      },
      toggleMismatchAlpha() {
        self.mismatchAlpha = !self.mismatchAlpha
      },

      setConfig(configuration: AnyConfigurationModel) {
        self.configuration = configuration
      },

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

        self.sortedBy = {
          type,
          pos: centerBp,
          refName,
          assemblyName,
          tag,
        }
        self.ready = false
      },
      setFilterBy(filter: {
        flagInclude: number
        flagExclude: number
        readName?: string
        tagFilter?: { tag: string; value: string }
      }) {
        self.filterBy = cast(filter)
      },
    }))
    .actions(self => {
      // resets the sort object and refresh whole display on reload
      const superReload = self.reload

      return {
        reload() {
          self.clearSelected()
          superReload()
        },
      }
    })

    .views(self => ({
      get maxHeight() {
        const conf = getConf(self, ['renderers', self.rendererTypeName]) || {}
        return self.trackMaxHeight !== undefined
          ? self.trackMaxHeight
          : conf.maxHeight
      },
      get rendererConfig() {
        const configBlob =
          getConf(self, ['renderers', self.rendererTypeName]) || {}
        return self.rendererType.configSchema.create(
          {
            ...configBlob,
            height: self.featureHeight,
            noSpacing: self.noSpacing,
            maxHeight: this.maxHeight,
            mismatchAlpha: self.mismatchAlpha,
          },
          getEnv(self),
        )
      },
      get featureHeightSetting() {
        return (
          self.featureHeight || readConfObject(this.rendererConfig, 'height')
        )
      },
      get mismatchAlphaSetting() {
        return self.mismatchAlpha !== undefined
          ? self.mismatchAlpha
          : readConfObject(this.rendererConfig, 'mismatchAlpha')
      },
      get featureUnderMouse() {
        return self.featureUnderMouseVolatile
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
      } = self

      return {
        get rendererTypeName() {
          const viewName = getConf(self, 'defaultRendering')
          const rendererType = rendererTypes.get(viewName)
          if (!rendererType) {
            throw new Error(`unknown alignments view name ${viewName}`)
          }
          return rendererType
        },

        contextMenuItems() {
          const feat = self.contextMenuFeature
          const contextMenuItems = feat
            ? [
                {
                  label: 'Open feature details',
                  icon: MenuOpenIcon,
                  onClick: () => {
                    self.clearFeatureSelection()
                    if (feat) {
                      self.selectFeature(feat)
                    }
                  },
                },
                {
                  label: 'Copy info to clipboard',
                  icon: ContentCopyIcon,
                  onClick: () => {
                    if (feat) {
                      self.copyFeatureToClipboard(feat)
                    }
                  },
                },
              ]
            : []
          return contextMenuItems
        },

        get DisplayBlurb() {
          return LinearPileupDisplayBlurb
        },

        renderProps() {
          const view = getContainingView(self) as LGV
          const {
            colorTagMap,
            modificationTagMap,
            sortedBy,
            colorBy,
            filterBy,
            rpcDriverName,
            currBpPerPx,
            ready,
          } = self

          const superProps = superRenderProps()

          return {
            ...superProps,
            notReady:
              superProps.notReady ||
              !ready ||
              (sortedBy && currBpPerPx !== view.bpPerPx),
            rpcDriverName,
            displayModel: self,
            sortedBy,
            colorBy,
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
                  )) as { feature: unknown }

                  if (feature) {
                    // @ts-ignore
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
              icon: PaletteIcon,
              subMenu: [
                {
                  label: 'Normal',
                  onClick: () => {
                    self.setColorScheme({ type: 'normal' })
                  },
                },
                {
                  label: 'Mapping quality',
                  onClick: () => {
                    self.setColorScheme({ type: 'mappingQuality' })
                  },
                },
                {
                  label: 'Strand',
                  onClick: () => {
                    self.setColorScheme({ type: 'strand' })
                  },
                },
                {
                  label: 'Pair orientation',
                  onClick: () => {
                    self.setColorScheme({ type: 'pairOrientation' })
                  },
                },
                {
                  label: 'Per-base quality',
                  onClick: () => {
                    self.setColorScheme({ type: 'perBaseQuality' })
                  },
                },
                {
                  label: 'Per-base lettering',
                  onClick: () => {
                    self.setColorScheme({ type: 'perBaseLettering' })
                  },
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
                  onClick: () => {
                    self.setColorScheme({ type: 'insertSize' })
                  },
                },
                {
                  label: 'Stranded paired-end',
                  onClick: () => {
                    self.setColorScheme({ type: 'reverseTemplate' })
                  },
                },
                {
                  label: 'Color by tag...',
                  onClick: () => {
                    getSession(self).queueDialog(doneCallback => [
                      ColorByTagDlg,
                      { model: self, handleClose: doneCallback },
                    ])
                  },
                },
              ],
            },
            {
              label: 'Filter by',
              icon: FilterListIcon,
              onClick: () => {
                getSession(self).queueDialog(doneCallback => [
                  FilterByTagDlg,
                  { model: self, handleClose: doneCallback },
                ])
              },
            },
            {
              label: 'Set feature height',
              onClick: () => {
                getSession(self).queueDialog(doneCallback => [
                  SetFeatureHeightDlg,
                  { model: self, handleClose: doneCallback },
                ])
              },
            },
            {
              label: 'Set max height',
              onClick: () => {
                getSession(self).queueDialog(doneCallback => [
                  SetMaxHeightDlg,
                  { model: self, handleClose: doneCallback },
                ])
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
          ]
        },
      }
    })

export type LinearPileupDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearPileupDisplayModel = Instance<LinearPileupDisplayStateModel>

export default stateModelFactory
