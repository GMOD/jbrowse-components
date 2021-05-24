import { lazy } from 'react'
import {
  ConfigurationReference,
  readConfObject,
  getConf,
} from '@jbrowse/core/configuration'
import {
  getParentRenderProps,
  getRpcSessionId,
} from '@jbrowse/core/util/tracks'
import {
  getSession,
  isSessionModelWithWidgets,
  getContainingView,
} from '@jbrowse/core/util'

import VisibilityIcon from '@material-ui/icons/Visibility'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import {
  LinearGenomeViewModel,
  BaseLinearDisplay,
} from '@jbrowse/plugin-linear-genome-view'
import { cast, types, addDisposer, getEnv, Instance } from 'mobx-state-tree'
import copy from 'copy-to-clipboard'
import PluginManager from '@jbrowse/core/PluginManager'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import MenuOpenIcon from '@material-ui/icons/MenuOpen'
import SortIcon from '@material-ui/icons/Sort'
import PaletteIcon from '@material-ui/icons/Palette'
import FilterListIcon from '@material-ui/icons/ClearAll'

import { autorun, observable } from 'mobx'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { LinearPileupDisplayConfigModel } from './configSchema'
import LinearPileupDisplayBlurb from './components/LinearPileupDisplayBlurb'

import { getUniqueTagValues, getUniqueModificationValues } from '../shared'

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

const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: LinearPileupDisplayConfigModel,
) =>
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
            flagExclude: types.optional(types.number, 1536),
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
      ready: false,
      currBpPerPx: 0,
    }))
    .actions(self => ({
      setReady(flag: boolean) {
        self.ready = flag
      },
      setCurrBpPerPx(n: number) {
        self.currBpPerPx = n
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
        // pale color scheme https://cran.r-project.org/web/packages/khroma/vignettes/tol.html e.g. "tol_light"
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
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            async () => {
              try {
                const { rpcManager } = getSession(self)
                const { sortedBy, colorBy, renderProps } = self
                const view = getContainingView(self) as LGV

                // continually generate the vc pairing, set and rerender if any
                // new values seen
                if (colorBy?.tag) {
                  const uniqueTagSet = await getUniqueTagValues(
                    self,
                    colorBy,
                    view.staticBlocks,
                  )
                  self.updateColorTagMap(uniqueTagSet)
                }

                if (colorBy?.type === 'modifications') {
                  const uniqueModificationsSet = await getUniqueModificationValues(
                    self,
                    getConf(self.parentTrack, ['adapter']),
                    colorBy,
                    view.staticBlocks,
                  )
                  self.updateModificationColorMap(uniqueModificationsSet)
                }

                if (sortedBy) {
                  const { pos, refName, assemblyName } = sortedBy

                  const region = {
                    start: pos,
                    end: (pos || 0) + 1,
                    refName,
                    assemblyName,
                  }

                  // render just the sorted region first
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  await (self.rendererType as any).renderInClient(rpcManager, {
                    assemblyName,
                    regions: [region],
                    adapterConfig: self.adapterConfig,
                    rendererType: self.rendererType.name,
                    sessionId: getRpcSessionId(self),
                    timeout: 1000000,
                    ...renderProps,
                  })
                  self.setReady(true)
                  self.setCurrBpPerPx(view.bpPerPx)
                } else {
                  self.setReady(true)
                }
              } catch (error) {
                console.error(error)
                self.setError(error)
              }
            },
            { delay: 1000 },
          ),
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
        const copiedFeature = feature.toJSON()
        delete copiedFeature.uniqueId
        const session = getSession(self)
        copy(JSON.stringify(copiedFeature, null, 4))
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
        const centerRefName = refName

        if (centerBp < 0) {
          return
        }

        self.sortedBy = {
          type,
          pos: centerBp,
          refName: centerRefName,
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
    }))
    .views(self => {
      const { trackMenuItems } = self
      return {
        get rendererTypeName() {
          const viewName = getConf(self, 'defaultRendering')
          const rendererType = rendererTypes.get(viewName)
          if (!rendererType) {
            throw new Error(`unknown alignments view name ${viewName}`)
          }
          return rendererType
        },

        get contextMenuItems() {
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
          self.additionalContextMenuItemCallbacks.forEach(
            (callback: Function) => {
              const menuItems = callback(feat, self, pluginManager)
              contextMenuItems.push(...menuItems)
            },
          )
          return contextMenuItems
        },

        get DisplayBlurb() {
          return LinearPileupDisplayBlurb
        },

        get filters() {
          let filters: string[] = []
          if (self.filterBy) {
            const { flagInclude, flagExclude } = self.filterBy
            filters = [
              `jexl:((get(feature,'flags')&${flagInclude})==${flagInclude}) && !(get(feature,'flags')&${flagExclude})`,
            ]
            if (self.filterBy.tagFilter) {
              const { tag, value } = self.filterBy.tagFilter
              filters.push(
                `jexl:"${value}" =='*' ? getTag(feature,"${tag}") != undefined : getTag(feature,"${tag}") == "${value}"`,
              )
            }
            if (self.filterBy.readName) {
              const { readName } = self.filterBy
              filters.push(`jexl:get(feature,'name') == "${readName}"`)
            }
          }
          return new SerializableFilterChain({ filters })
        },

        get renderProps() {
          const view = getContainingView(self) as LGV
          return {
            ...self.composedRenderProps,
            ...getParentRenderProps(self),
            notReady:
              !self.ready ||
              (self.sortedBy && self.currBpPerPx !== view.bpPerPx),
            rpcDriverName: self.rpcDriverName,
            displayModel: self,
            sortedBy: self.sortedBy,
            colorBy: self.colorBy,
            colorTagMap: JSON.parse(JSON.stringify(self.colorTagMap)),
            modificationTagMap: JSON.parse(
              JSON.stringify(self.modificationTagMap),
            ),
            filters: this.filters,
            showSoftClip: self.showSoftClipping,
            config: self.rendererConfig,
          }
        },

        get composedTrackMenuItems() {
          return [
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
                  option => {
                    return {
                      label: option,
                      onClick: () => self.setSortedBy(option),
                    }
                  },
                ),
                {
                  label: 'Sort by tag...',
                  onClick: () =>
                    getSession(self).setDialogComponent(SortByTagDlg, {
                      model: self,
                    }),
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
                  label: 'Modifications or methylation',
                  onClick: () => {
                    getSession(self).setDialogComponent(ModificationsDlg, {
                      model: self,
                    })
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
                    getSession(self).setDialogComponent(ColorByTagDlg, {
                      model: self,
                    })
                  },
                },
              ],
            },
            {
              label: 'Filter by',
              icon: FilterListIcon,
              onClick: () => {
                getSession(self).setDialogComponent(FilterByTagDlg, {
                  model: self,
                })
              },
            },
            {
              label: 'Set feature height',
              onClick: () => {
                getSession(self).setDialogComponent(SetFeatureHeightDlg, {
                  model: self,
                })
              },
            },
            {
              label: 'Set max height',
              onClick: () => {
                getSession(self).setDialogComponent(SetMaxHeightDlg, {
                  model: self,
                })
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

        get trackMenuItems() {
          return [...trackMenuItems, ...this.composedTrackMenuItems]
        },
      }
    })

export type LinearPileupDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearPileupDisplayModel = Instance<LinearPileupDisplayStateModel>

export default stateModelFactory
