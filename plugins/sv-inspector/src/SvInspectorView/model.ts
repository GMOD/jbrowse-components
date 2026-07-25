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
 * #example
 * Hand-authored under `defaultSession.views`. The `init` shorthand loads a
 * structural-variant file into the spreadsheet and mirrors the rows as arcs in
 * the paired circular view; `assembly` resolves coordinates for both:
 * ```js
 * {
 *   type: 'SvInspectorView',
 *   init: {
 *     assembly: 'hg38',
 *     uri: 'https://example.com/sv.vcf.gz',
 *     fileType: 'VCF',
 *   },
 * }
 * ```
 */
function SvInspectorViewF(pluginManager: PluginManager) {
  const SpreadsheetViewType = pluginManager.getViewType('SpreadsheetView')
  const CircularViewType = pluginManager.getViewType('CircularView')

  const SpreadsheetModel =
    SpreadsheetViewType.stateModel as SpreadsheetViewStateModel
  const CircularModel = CircularViewType.stateModel as CircularViewStateModel

  const minHeight = 400
  const defaultHeight = 550
  const headerHeight = 52
  const borderWidth = 1
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
        height: types.stripDefault(types.number, defaultHeight),
        /**
         * #property
         */
        onlyDisplayRelevantRegionsInCircularView: types.stripDefault(
          types.boolean,
          false,
        ),
        /**
         * #property
         * share of the view's width given to the spreadsheet, the rest goes to
         * the circular view. Persisted so dragging the divider survives both a
         * window resize and a session reload
         */
        spreadsheetWidthFraction: types.stripDefault(types.number, 0.66),
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
      circularViewOptionsBarHeight: 52,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get currentAssembly() {
        const name = self.spreadsheetView.spreadsheet?.assemblyName
        return name ? getSession(self).assemblyManager.get(name) : undefined
      },
      /**
       * #getter
       */
      get assemblyName() {
        return this.currentAssembly?.name
      },
      /**
       * #getter
       * gated on the same condition the spreadsheet renders its grid on, so the
       * circle never appears alongside the import form
       */
      get showCircularView() {
        return !!self.spreadsheetView.spreadsheet?.initialized
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
            this.features
              .flatMap(f => [
                f.refName,
                (f.INFO as { CHR2?: string } | undefined)?.CHR2,
                (f.mate as { refName?: string } | undefined)?.refName,
              ])
              .filter((f): f is string => !!f),
          ),
        ]
      },
      /**
       * #getter
       */
      get canonicalFeatureRefNameSet() {
        const asm = this.currentAssembly
        return new Set(
          asm?.initialized
            ? this.featureRefNames.map(r => asm.getCanonicalRefName2(r))
            : [],
        )
      },
      /**
       * #getter
       * the regions the paired circular view should show. An empty relevant-set
       * means the features aren't parsed yet, so show everything rather than an
       * empty circle
       */
      get circularDisplayedRegions() {
        const regions = this.currentAssembly?.regions
        const relevant = self.onlyDisplayRelevantRegionsInCircularView
          ? this.canonicalFeatureRefNameSet
          : undefined
        return regions && relevant?.size
          ? regions.filter(r => relevant.has(r.refName))
          : regions
      },
      /**
       * #getter
       */
      get variantTrackId() {
        return `sv-inspector-variant-track-${self.id}`
      },
      /**
       * #getter
       */
      get featuresCircularTrackConfiguration() {
        const trackId = this.variantTrackId
        return {
          type: 'VariantTrack',
          trackId,
          name: 'features from tabular data',
          adapter: this.featuresAdapterConfigSnapshot,
          assemblyNames: [this.assemblyName!],
          displays: [
            {
              type: 'ChordVariantDisplay',
              displayId: `${trackId}-chord-display`,
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
       * move the divider between the two subviews. Stored as a fraction so the
       * width binding can reapply it, rather than resizing the subviews directly
       * and having the next parent resize overwrite it
       */
      resizeSpreadsheetWidth(distance: number) {
        const fraction = (self.spreadsheetView.width + distance) / self.width
        self.spreadsheetWidthFraction = Math.min(Math.max(fraction, 0.2), 0.8)
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
              self.spreadsheetView.returnToImportForm()
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
              if (self.showCircularView) {
                const spreadsheetWidth = Math.round(
                  self.width * self.spreadsheetWidthFraction,
                )
                self.spreadsheetView.setWidth(spreadsheetWidth - borderWidth)
                self.circularView.setWidth(self.width - spreadsheetWidth)
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
                self.height - headerHeight - self.circularViewOptionsBarHeight,
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
              const { circularView, circularDisplayedRegions } = self
              // setDisplayedRegions re-fits the circle, so only write when the
              // region list really changed. With the toggle on, the relevant-set
              // recomputes on every grid filter change and would otherwise
              // throw away the user's pan and zoom on each keystroke
              if (circularView.initialized && circularDisplayedRegions) {
                const cur = circularView.displayedRegions
                const changed =
                  cur.length !== circularDisplayedRegions.length ||
                  cur.some(
                    (r, i) =>
                      r.refName !== circularDisplayedRegions[i]!.refName,
                  )
                if (changed) {
                  circularView.setDisplayedRegions(
                    structuredClone(circularDisplayedRegions),
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
              const { assemblyName, circularView, variantTrackId } = self
              // hideTrack reads circularView.tracks internally; avoid tracking
              // that dependency to prevent re-triggering on our own track changes
              untracked(() => {
                circularView.hideTrack(variantTrackId)
              })
              if (assemblyName) {
                circularView.addTrackConf(
                  self.featuresCircularTrackConfiguration,
                )
              }
            },
            { name: 'SvInspectorView track configuration binding' },
          ),
        )
      },
    }))
    .postProcessSnapshot(snap => {
      // xref https://github.com/mobxjs/mobx-state-tree/issues/1524
      const { init, circularView, ...rest } = snap
      return rest
    })
}

export type SvInspectorViewStateModel = ReturnType<typeof SvInspectorViewF>
export type SvInspectorViewModel = Instance<SvInspectorViewStateModel>

export default SvInspectorViewF
