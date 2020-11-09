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

import VisibilityIcon from '@material-ui/icons/Visibility'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import {
  LinearGenomeViewModel,
  BaseLinearDisplay,
} from '@jbrowse/plugin-linear-genome-view'
import { cast, types, addDisposer, Instance } from 'mobx-state-tree'
import copy from 'copy-to-clipboard'
import PluginManager from '@jbrowse/core/PluginManager'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import MenuOpenIcon from '@material-ui/icons/MenuOpen'
import SortIcon from '@material-ui/icons/Sort'
import PaletteIcon from '@material-ui/icons/Palette'

import { autorun } from 'mobx'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { LinearPileupDisplayConfigModel } from './configSchema'
import LinearPileupDisplayBlurb from './components/LinearPileupDisplayBlurb'
import ColorByTagDlg from './components/ColorByTag'
import SortByTagDlg from './components/SortByTag'

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
        viewAsPairs: false,
        linkSuppReads: false,
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
      }),
    )
    .volatile(() => ({
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
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            async () => {
              try {
                const { rpcManager } = getSession(self)
                const { sortedBy, renderProps } = self
                const view = getContainingView(self) as LGV
                if (sortedBy) {
                  const { pos, refName, assemblyName } = sortedBy
                  const region = {
                    start: pos,
                    end: pos + 1,
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
                self.setError(error.message)
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

      toggleViewAsPairs() {
        self.viewAsPairs = !self.viewAsPairs
      },

      toggleLinkSuppReads() {
        self.linkSuppReads = !self.linkSuppReads
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
      setColorScheme(colorScheme: { type: string; tag?: string }) {
        self.colorBy = cast(colorScheme)
      },
    }))
    .actions(self => {
      // reset the sort object and refresh whole display on reload
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
            showSoftClip: self.showSoftClipping,
            viewAsPairs: self.viewAsPairs,
            linkSuppReads: self.linkSuppReads,
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
              label: 'View as pairs',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: self.viewAsPairs,
              onClick: () => {
                self.toggleViewAsPairs()
              },
            },
            {
              label: 'Link supplementary reads',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: self.linkSuppReads,
              onClick: () => {
                self.toggleLinkSuppReads()
              },
            },
            {
              label: 'Sort by',
              icon: SortIcon,
              disabled: self.showSoftClipping,
              subMenu: ['Start location', 'Read strand', 'Base pair']
                .map(option => {
                  return {
                    label: option,
                    onClick: () => self.setSortedBy(option),
                  }
                })
                .concat([
                  {
                    label: 'Sort by tag',
                    onClick: () => self.setDialogComponent(SortByTagDlg),
                  },
                  {
                    label: 'Clear sort',
                    onClick: () => self.clearSelected(),
                  },
                ]),
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
                  label: 'Color by tag',
                  onClick: () => {
                    self.setDialogComponent(ColorByTagDlg)
                  },
                },
                {
                  label: 'Stranded-seq',
                  onClick: () => {
                    self.setColorScheme({ type: 'reverseTemplate' })
                  },
                },
              ],
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
