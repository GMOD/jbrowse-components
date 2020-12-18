import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import {
  getParentRenderProps,
  getRpcSessionId,
} from '@jbrowse/core/util/tracks'
import {
  getSession,
  isSessionModelWithWidgets,
  getContainingView,
} from '@jbrowse/core/util'

import { BlockSet } from '@jbrowse/core/util/blockTypes'
import VisibilityIcon from '@material-ui/icons/Visibility'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import {
  LinearGenomeViewModel,
  BaseLinearDisplay,
} from '@jbrowse/plugin-linear-genome-view'
import { cast, types, addDisposer, getParent, Instance } from 'mobx-state-tree'
import copy from 'copy-to-clipboard'
import PluginManager from '@jbrowse/core/PluginManager'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import MenuOpenIcon from '@material-ui/icons/MenuOpen'
import SortIcon from '@material-ui/icons/Sort'
import PaletteIcon from '@material-ui/icons/Palette'
import FilterListIcon from '@material-ui/icons/ClearAll'

import { autorun, observable } from 'mobx'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { LinearPileupDisplayConfigModel } from './configSchema'
import LinearPileupDisplayBlurb from './components/LinearPileupDisplayBlurb'
import ColorByTagDlg from './components/ColorByTag'
import FilterByTagDlg from './components/FilterByTag'
import SortByTagDlg from './components/SortByTag'

// using a map because it preserves order
const rendererTypes = new Map([
  ['pileup', 'PileupRenderer'],
  ['svg', 'SvgFeatureRenderer'],
])

type LGV = LinearGenomeViewModel

interface VCPairing {
  value: string | number
  color: string
}

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
          }),
        ),
        filterBy: types.optional(
          types.model({
            flagInclude: types.optional(types.number, 0),
            flagExclude: types.optional(types.number, 1536),
            tagFilter: types.maybe(
              types.model({ tag: types.string, value: types.string }),
            ),
          }),
          {},
        ),
      }),
    )
    .volatile(() => ({
      // valueColorPairing: undefined as undefined | VCPairing[],
      valueColorPairing: observable.array([] as VCPairing[]),
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
      setValueColorPairing(vcArray: VCPairing[]) {
        if (JSON.stringify(vcArray) !== JSON.stringify(self.valueColorPairing))
          self.valueColorPairing = observable.array(vcArray)
      },
      setColorScheme(colorScheme: { type: string; tag?: string }) {
        self.colorBy = cast(colorScheme)
        self.ready = false
      },
      async getUniqueTagValues(
        colorScheme: { type: string; tag?: string },
        blocks: BlockSet,
        opts?: {
          headers?: Record<string, string>
          signal?: AbortSignal
          filters?: string[]
        },
      ) {
        const { rpcManager } = getSession(self)
        const { adapterConfig } = self
        const sessionId = getRpcSessionId(self)
        const values = await rpcManager.call(
          getRpcSessionId(self),
          'PileupGetGlobalValueForTag',
          {
            adapterConfig,
            tag: colorScheme.tag,
            sessionId,
            regions: blocks.contentBlocks,
            ...opts,
          },
        )
        return Array.from(values as Set<number | string>)
      },
      generateValueColorPairing(uniqueTag: (number | string)[]) {
        const colorPalette = [
          '#332288',
          '#117733',
          '#44AA99',
          '#88CCEE',
          '#DDCC77',
          '#CC6677',
          '#AA4499',
          '#882255',
          '#FEFE62',
          '#DC3220',
        ] // default colorblind friendly palette
        const valueColorPairing: VCPairing[] = []
        uniqueTag
          // .sort((a, b) => {
          //   // sort alphabetically
          //   if (typeof a === 'string' && typeof b === 'string') {
          //     if (a < b) return -1
          //     if (a > b) return 1
          //     return 0
          //   }
          //   // sort numerically
          //   if (typeof a === 'number' && typeof b === 'number') return a - b
          //   throw new Error('tried to compare number and string value')
          // })
          .forEach((value, idx) => {
            valueColorPairing.push({ value, color: colorPalette[idx % 10] }) // have to repeat if more than 10 values
          })
        return valueColorPairing
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

                // continually generate the vc pairing, set and rerender if any new values seen
                if (colorBy?.tag) {
                  const uniqueTagSet = await self.getUniqueTagValues(
                    colorBy as { type: string; tag: string },
                    view.staticBlocks,
                  )
                  const vcPairing = self.generateValueColorPairing(uniqueTagSet)
                  self.setValueColorPairing(vcPairing)
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
                    renderProps,
                    sessionId: getRpcSessionId(self),
                    timeout: 1000000,
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
            { featureData: feature.toJSON() },
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
              `function(f) {
                const flags = f.get('flags');
                return ((flags&${flagInclude})===${flagInclude}) && !(flags&${flagExclude});
              }`,
            ]
            if (self.filterBy.tagFilter) {
              const { tag, value } = self.filterBy.tagFilter
              // use eqeq instead of eqeqeq for number vs string comparison
              filters.push(`function(f) {
              const tags = f.get('tags');
              const tag = tags?tags["${tag}"]:f.get("${tag}");
              return tag == "${value}";
              }`)
            }
          }
          return filters
        },

        get renderProps() {
          const view = getContainingView(self) as LGV
          const config = self.rendererType.configSchema.create(
            getConf(self, ['renderers', self.rendererTypeName]) || {},
          )

          return {
            ...self.composedRenderProps,
            ...getParentRenderProps(self),
            notReady:
              !self.ready ||
              (self.sortedBy && self.currBpPerPx !== view.bpPerPx),
            displayModel: self,
            sortedBy: self.sortedBy,
            colorBy: self.colorBy,
            valueColorPairing: self.valueColorPairing,
            filters: this.filters,
            showSoftClip: self.showSoftClipping,
            config,
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
                    getParent(self, 3).setDialogComponent(SortByTagDlg),
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
                  label: 'Insert size',
                  onClick: () => {
                    self.setColorScheme({ type: 'insertSize' })
                  },
                },
                {
                  label: 'Color by tag...',
                  onClick: () => {
                    getParent(self, 3).setDialogComponent(ColorByTagDlg)
                  },
                },
                {
                  label: 'Color paired end RNA-seq',
                  onClick: () => {
                    self.setColorScheme({ type: 'reverseTemplate' })
                  },
                },
              ],
            },
            {
              label: 'Filter by',
              icon: FilterListIcon,
              onClick: () => {
                getParent(self, 3).setDialogComponent(FilterByTagDlg)
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
