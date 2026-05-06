import { readConfObject } from '@jbrowse/core/configuration'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { autorun, untracked } from 'mobx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { CircularViewStateModel } from '@jbrowse/plugin-circular-view'
import type { SpreadsheetViewStateModel } from '@jbrowse/plugin-spreadsheet-view'

interface SvInspectorViewInit {
  assembly: string
  uri: string
  fileType?: string
}

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
  const headerHeight = 52
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
        spreadsheetView: types.optional(SpreadsheetModel, () =>
          SpreadsheetModel.create({
            type: 'SpreadsheetView',
            hideVerticalResizeHandle: true,
          }),
        ),
        /**
         * #property
         */
        circularView: types.optional(CircularModel, () =>
          CircularModel.create({
            type: 'CircularView',
            hideVerticalResizeHandle: true,
            hideTrackSelectorButton: true,
            disableImportForm: true,
          }),
        ),
        /**
         * #property
         * used for initializing the view from a session snapshot
         */
        init: types.frozen<SvInspectorViewInit | undefined>(),
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
      get assemblyName() {
        const { assembly } = self.spreadsheetView
        return assembly
          ? (readConfObject(assembly, 'name') as string)
          : undefined
      },
      /**
       * #getter
       */
      get showCircularView() {
        return !!self.spreadsheetView.spreadsheet?.rowSet
      },

      /**
       * #getter
       */
      get features() {
        return (
          self.spreadsheetView.spreadsheet?.visibleRows
            ?.map(row => row.feature)
            .filter(f => !!f) ?? []
        )
      },
      /**
       * #getter
       */
      get featuresAdapterConfigSnapshot() {
        return {
          type: 'FromConfigAdapter',
          features: this.features,
        }
      },
      /**
       * #getter
       */
      get featureRefNames() {
        return [
          ...new Set(
            [
              ...this.features.map(r => r.refName),
              // @ts-expect-error
              ...this.features.flatMap(r => r.INFO?.CHR2),
              // @ts-expect-error
              ...this.features.flatMap(r => r.mate?.refName),
            ].filter(f => !!f),
          ),
        ]
      },
      /**
       * #getter
       */
      get currentAssembly() {
        const { assemblyManager } = getSession(self)
        return this.assemblyName
          ? assemblyManager.get(this.assemblyName)
          : undefined
      },

      /**
       * #getter
       */
      get canonicalFeatureRefNameSet() {
        const asm = this.currentAssembly
        return new Set(
          asm?.initialized
            ? this.featureRefNames.map(r => asm.getCanonicalRefName(r) || r)
            : [],
        )
      },
      /**
       * #getter
       */
      get featuresCircularTrackConfiguration() {
        return {
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

      /**
       * #action
       */
      setInit(init?: SvInspectorViewInit) {
        self.init = init
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
            icon: FolderOpenIcon,
            onClick: () => {
              self.spreadsheetView.displaySpreadsheet(undefined)
            },
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
        addDisposer(
          self,
          autorun(
            () => {
              const { init } = self
              if (init) {
                self.spreadsheetView.setInit(init)
                self.setInit(undefined)
              }
            },
            { name: 'SvInspectorViewInit' },
          ),
        )

        // synchronize subview widths
        addDisposer(
          self,
          autorun(
            () => {
              const borderWidth = 1
              if (self.showCircularView) {
                const spreadsheetWidth = Math.round(self.width * 0.66)
                const circularViewWidth = self.width - spreadsheetWidth
                self.spreadsheetView.setWidth(spreadsheetWidth - borderWidth)
                self.circularView.setWidth(circularViewWidth)
              } else {
                self.spreadsheetView.setWidth(self.width)
              }
            },
            { name: 'SvInspectorView width binding' },
          ),
        )
        // synchronize subview heights
        addDisposer(
          self,
          autorun(
            () => {
              self.spreadsheetView.setHeight(self.height - headerHeight)
              self.circularView.setHeight(
                self.height - headerHeight - circularViewOptionsBarHeight,
              )
            },
            {
              name: 'SvInspectorView height binding',
            },
          ),
        )

        // bind circularview displayedRegions to spreadsheet assembly, mediated
        // by the onlyRelevantRegions toggle
        addDisposer(
          self,
          autorun(
            () => {
              const {
                onlyDisplayRelevantRegionsInCircularView,
                circularView,
                canonicalFeatureRefNameSet,
                currentAssembly,
              } = self
              if (circularView.initialized && currentAssembly?.regions) {
                if (onlyDisplayRelevantRegionsInCircularView) {
                  if (circularView.tracks.length === 1) {
                    circularView.setDisplayedRegions(
                      structuredClone(
                        currentAssembly.regions.filter(r =>
                          canonicalFeatureRefNameSet.has(r.refName),
                        ),
                      ),
                    )
                  }
                } else {
                  circularView.setDisplayedRegions(
                    structuredClone(currentAssembly.regions),
                  )
                }
              }
            },
            { name: 'SvInspectorView displayed regions bind' },
          ),
        )

        // bind circularview tracks to our track snapshot view
        addDisposer(
          self,
          autorun(
            () => {
              const {
                featuresCircularTrackConfiguration: generatedTrackConf,
                assemblyName,
                circularView,
                id,
              } = self
              // hideTrack reads circularView.tracks internally; avoid tracking
              // that dependency to prevent re-triggering on our own track changes
              untracked(() => {
                circularView.hideTrack(`sv-inspector-variant-track-${id}`)
              })
              if (assemblyName) {
                // @ts-expect-error
                circularView.addTrackConf(generatedTrackConf, { assemblyName })
              }
            },
            { name: 'SvInspectorView track configuration binding' },
          ),
        )
      },
    }))
    .postProcessSnapshot(snap => {
      // xref https://github.com/mobxjs/mobx-state-tree/issues/1524
      const { init, circularView, ...rest } = snap as Omit<typeof snap, symbol>
      return rest
    })
}

export type SvInspectorViewStateModel = ReturnType<typeof SvInspectorViewF>
export type SvInspectorViewModel = Instance<SvInspectorViewStateModel>

export default SvInspectorViewF
