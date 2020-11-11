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
import { types, addDisposer, Instance } from 'mobx-state-tree'
import copy from 'copy-to-clipboard'
import PluginManager from '@jbrowse/core/PluginManager'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import MenuOpenIcon from '@material-ui/icons/MenuOpen'
import SortIcon from '@material-ui/icons/Sort'
import { autorun } from 'mobx'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { LinearPileupDisplayConfigModel } from './configSchema'
import LinearPileupDisplayBlurb from './components/LinearPileupDisplayBlurb'

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
        sortedBy: types.maybe(
          types.model({
            type: types.string,
            pos: types.number,
            refName: types.string,
            assemblyName: types.string,
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

      setConfig(configuration: AnyConfigurationModel) {
        self.configuration = configuration
      },

      sortSelected(type: string) {
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

        this.setSortedBy({
          type,
          pos: centerBp,
          refName: centerRefName,
          assemblyName,
        })
      },
      setSortedBy(sort: {
        type: string
        pos: number
        refName: string
        assemblyName: string
      }) {
        self.sortedBy = sort
        self.ready = false
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

        get sortOptions() {
          return ['Start location', 'Read strand', 'Base pair', 'Clear sort']
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
              subMenu: this.sortOptions.map((option: string) => {
                return {
                  label: option,
                  onClick() {
                    option === 'Clear sort'
                      ? self.clearSelected()
                      : self.sortSelected(option)
                  },
                }
              }),
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
