import clone from 'clone'
import { autorun, trace } from 'mobx'
import { types, addDisposer, Instance } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { getSession, notEmpty } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { SpreadsheetViewStateModel } from '@jbrowse/plugin-spreadsheet-view'
import { CircularViewStateModel } from '@jbrowse/plugin-circular-view'

// icons
import FolderOpenIcon from '@mui/icons-material/FolderOpen'

/**
 * #stateModel SvInspectorView
 * #category view
 * does not extend, but is a combination of a
 * - [SpreadsheetView](../spreadsheetview)
 * - [CircularView](../circularview)
 *
 * extends
 * - [BaseViewModel](../baseviewmodel)
 */
function SvInspectorViewF(pluginManager: PluginManager) {
  const SpreadsheetViewType = pluginManager.getViewType('SpreadsheetView')!
  const CircularViewType = pluginManager.getViewType('CircularView')!

  const SpreadsheetModel =
    SpreadsheetViewType.stateModel as SpreadsheetViewStateModel
  const CircularModel = CircularViewType.stateModel as CircularViewStateModel

  const minHeight = 400
  const defaultHeight = 550
  const circularViewOptionsBarHeight = 52
  return types
    .compose(
      'SvInspectorView',
      BaseViewModel,
      types.model({
        /**
         * #property
         */
        id: ElementId,
        /**
         * #property
         */
        type: types.literal('SvInspectorView'),

        /**
         * #property
         */
        height: types.optional(types.number, defaultHeight),
        /**
         * #property
         */
        onlyDisplayRelevantRegionsInCircularView: false,

        /**
         * #property
         */
        spreadsheetView: types.optional(SpreadsheetModel, {
          hideVerticalResizeHandle: true,
          type: 'SpreadsheetView',
        }),
        /**
         * #property
         */
        circularView: types.optional(CircularModel, {
          type: 'CircularView',
          hideVerticalResizeHandle: true,
          hideTrackSelectorButton: true,
          disableImportForm: true,
        }),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      width: 800,
      /**
       * #volatile
       */
      SpreadsheetViewReactComponent: SpreadsheetViewType.ReactComponent,
      /**
       * #volatile
       */
      CircularViewReactComponent: CircularViewType.ReactComponent,
      /**
       * #volatile
       */
      circularViewOptionsBarHeight,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get initialized() {
        return self.spreadsheetView.initialized
      },
      /**
       * #getter
       */
      get assemblyName() {
        return self.spreadsheetView.assemblyName
      },
      /**
       * #getter
       */
      get assembly() {
        const { assemblyManager } = getSession(self)
        return this.assemblyName
          ? assemblyManager.get(this.assemblyName)
          : undefined
      },
      /**
       * #getter
       */
      get circularViewInitialized() {
        return self.spreadsheetView.initialized
      },

      /**
       * #getter
       */
      get features() {
        return self.spreadsheetView.features
      },
      /**
       * #getter
       */
      get featuresAdapterConfigSnapshot() {
        return this.features
          ? {
              type: 'FromConfigAdapter',
              features: this.features.map(f => f.toJSON()) || [],
            }
          : undefined
      },
      /**
       * #getter
       */
      get featureRefNames() {
        if (this.features) {
          return [
            ...this.features.map(r => r.get('refName')),
            ...this.features
              .flatMap(r => r.get('INFO')?.CHR2 as string)
              .filter(notEmpty),
            ...this.features
              .flatMap(r => r.get('mate')?.refName as string)
              .filter(notEmpty),
          ]
        }
        return undefined
      },
      /**
       * #getter
       */
      get featureRefSet() {
        const a = this.assembly
        return a?.initialized
          ? new Set(
              this.featureRefNames?.map(r => a.getCanonicalRefNameOrDefault(r)),
            )
          : undefined
      },
      /**
       * #getter
       */
      get featuresCircularTrackConfiguration() {
        return this.featuresAdapterConfigSnapshot
          ? {
              type: 'VariantTrack',
              trackId: `sv-inspector-variant-track-${self.id}`,
              name: 'features from tabular data',
              adapter: this.featuresAdapterConfigSnapshot,
              assemblyNames: [this.assemblyName],
              displays: [
                {
                  type: 'ChordVariantDisplay',
                  displayId: `sv-inspector-variant-track-chord-display-${self.id}`,
                  onChordClick:
                    'jexl:defaultOnChordClick(feature, track, pluginManager)',
                  renderer: {
                    type: 'StructuralVariantChordRenderer',
                  },
                },
              ],
            }
          : undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setWidth(newWidth: number) {
        self.width = newWidth
      },
      /**
       * #action
       */
      setHeight(newHeight: number) {
        self.height = Math.max(newHeight, minHeight)
        return self.height
      },
      /**
       * #action
       */
      setOnlyDisplayRelevantRegionsInCircularView(val: boolean) {
        self.onlyDisplayRelevantRegionsInCircularView = val
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      menuItems() {
        return [
          {
            label: 'Return to import form',
            onClick: () => {
              self.spreadsheetView.clearData()
            },
            icon: FolderOpenIcon,
          },
        ]
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = self.setHeight(self.height + distance)
        return newHeight - oldHeight
      },
      afterAttach() {
        // synchronize subview widths
        addDisposer(
          self,
          autorun(() => {
            const borderWidth = 1
            if (self.circularViewInitialized) {
              const spreadsheetWidth = Math.round(self.width * 0.66)
              const circularViewWidth = self.width - spreadsheetWidth
              self.spreadsheetView.setWidth(spreadsheetWidth - borderWidth)
              self.circularView.setWidth(circularViewWidth)
            } else {
              self.spreadsheetView.setWidth(self.width)
            }
          }),
        )
        // synchronize subview heights
        addDisposer(
          self,
          autorun(() => {
            const { height } = self
            self.spreadsheetView.setHeight(height)
            self.circularView.setHeight(height - circularViewOptionsBarHeight)
          }),
        )
        // bind CircularView's displayedRegions to spreadsheet assembly,
        // mediated by the onlyRelevantRegions toggle
        addDisposer(
          self,
          autorun(async () => {
            const {
              onlyDisplayRelevantRegionsInCircularView,
              circularView,
              featureRefSet,
              assembly,
            } = self
            try {
              if (circularView.volatileWidth === undefined) {
                return
              }
              if (assembly?.regions && featureRefSet) {
                if (onlyDisplayRelevantRegionsInCircularView) {
                  circularView.setDisplayedRegions(
                    clone(
                      assembly.regions.filter(r =>
                        featureRefSet.has(r.refName),
                      ),
                    ),
                  )
                } else {
                  circularView.setDisplayedRegions(assembly.regions)
                }
              }
            } catch (e) {
              console.error(e)
              circularView.setError(e)
            }
          }),
        )
        // bind CircularView tracks to our track snapshot view
        addDisposer(
          self,
          autorun(() => {
            const { featuresCircularTrackConfiguration } = self
            const { circularView } = self
            if (featuresCircularTrackConfiguration) {
              circularView.clearTracks()
              circularView.addTrackConf(featuresCircularTrackConfiguration)
            }
          }),
        )
      },
    }))
}

export type SvInspectorViewStateModel = ReturnType<typeof SvInspectorViewF>
export type SvInspectorViewModel = Instance<SvInspectorViewStateModel>

export default SvInspectorViewF
