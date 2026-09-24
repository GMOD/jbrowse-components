import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { clamp, getSession, isFeature } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import {
  pendingLaunch,
  withLaunchInput,
} from '@jbrowse/core/util/withLaunchInput'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { autorun } from 'mobx'

import { circularViewOptionsBarHeight } from './consts.ts'
import { featureRefNames } from './featureRefNames.ts'
import { svInspectorLaunchKeys } from './launchKeys.ts'
import { sameCircularRegions } from './sameCircularRegions.ts'

import type { SvInspectorViewCommands } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { LaunchInput } from '@jbrowse/core/util/withLaunchInput'
import type { Instance } from '@jbrowse/mobx-state-tree'
// getViewType reads these packages' ViewTypeRegistry entries, which this
// package's own esm build sees only if it imports them
/* eslint-disable unicorn/require-module-specifiers */
import type {} from '@jbrowse/plugin-circular-view'
import type {} from '@jbrowse/plugin-spreadsheet-view'
/* eslint-enable unicorn/require-module-specifiers */

function trackConfId(configuration: unknown) {
  return typeof configuration === 'string'
    ? configuration
    : (configuration as { trackId?: string } | undefined)?.trackId
}

function variantTrackIdFor(viewId: string) {
  return `sv-inspector-variant-track-${viewId}`
}

function rowFeatures(rows?: { feature?: SimpleFeatureSerialized }[]) {
  return rows?.map(row => row.feature).filter(f => !!f) ?? []
}

/**
 * #stateModel SvInspectorView
 * #category view
 * does not extend, but is a combination of a
 * - [SpreadsheetView](../spreadsheetview)
 * - [CircularView](../circularview)
 *
 * #example
 * ```js
 * {
 *   type: 'SvInspectorView',
 *   assembly: 'hg38',
 *   uri: 'https://example.com/sv.vcf.gz',
 *   fileType: 'VCF',
 * }
 * ```
 */
function SvInspectorViewF(pluginManager: PluginManager) {
  const SpreadsheetViewType = pluginManager.getViewType('SpreadsheetView')
  const CircularViewType = pluginManager.getViewType('CircularView')

  const SpreadsheetModel = SpreadsheetViewType.stateModel
  const CircularModel = CircularViewType.stateModel

  const minHeight = 400
  const defaultHeight = 550
  const headerHeight = 52
  const dividerWidth = 4
  const minWidthFraction = 0.2
  const maxWidthFraction = 0.8
  const model = types
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
         * height of the whole view in pixels
         */
        height: types.stripDefault(types.number, defaultHeight),
        /**
         * #property
         * draw only the chromosomes the visible rows touch
         */
        onlyDisplayRelevantRegionsInCircularView: types.stripDefault(
          types.boolean,
          false,
        ),
        /**
         * #property
         * share of the view's width given to the spreadsheet
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
            disableImportForm: true,
          }),
        ),
        /**
         * #property
         * transient launch keys, forwarded to the sheet on attach and cleared;
         * author them directly on the view
         */
        launch: types.frozen<
          LaunchInput<SvInspectorViewCommands> | undefined
        >(),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      SpreadsheetViewReactComponent: SpreadsheetViewType.ReactComponent,
      /**
       * #volatile
       */
      CircularViewReactComponent: CircularViewType.ReactComponent,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get pendingLaunch() {
        return pendingLaunch(self.launch)
      },
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
       * false while the sheet shows its import form
       */
      get showCircularView() {
        return !!self.spreadsheetView.spreadsheet?.initialized
      },
      /**
       * #getter
       * both halves' loading state; the circle counts only while shown
       */
      get showLoading() {
        return (
          self.spreadsheetView.showLoading ||
          (this.showCircularView && self.circularView.showLoading)
        )
      },
      /**
       * #getter
       * an unshown circle never initializes, so it would read as loading
       * forever
       */
      get ownViews() {
        return [
          self.spreadsheetView,
          ...(this.showCircularView ? [self.circularView] : []),
        ]
      },
      /**
       * #getter
       * the records of the rows the sheet's filters leave
       */
      get features() {
        return rowFeatures(self.spreadsheetView.spreadsheet?.visibleRows)
      },
      /**
       * #getter
       * every record of the sheet, which the chord track holds; filters narrow
       * it through visibleChordIds rather than rebuilding the track
       */
      get allFeatures() {
        return rowFeatures(self.spreadsheetView.spreadsheet?.rows)
      },
      /**
       * #getter
       * undefined while no filter narrows the sheet
       */
      get visibleChordIds() {
        return this.features.length === this.allFeatures.length
          ? undefined
          : this.features.map(f => f.uniqueId)
      },
      /**
       * #getter
       * every canonical refName the visible features' chords land on, both
       * ends included
       */
      get canonicalFeatureRefNameSet() {
        const asm = this.currentAssembly
        return new Set(
          asm?.initialized
            ? this.features
                .flatMap(f => featureRefNames(f))
                .filter(r => r !== undefined)
                .map(r => asm.getCanonicalRefName2(r))
            : [],
        )
      },
      /**
       * #getter
       * never narrowed to nothing, which would draw an empty circle
       */
      get circularDisplayedRegions() {
        const regions = this.currentAssembly?.regions
        if (!regions || !self.onlyDisplayRelevantRegionsInCircularView) {
          return regions
        }
        const relevant = this.canonicalFeatureRefNameSet
        const narrowed = regions.filter(r => relevant.has(r.refName))
        return narrowed.length ? narrowed : regions
      },
      /**
       * #getter
       */
      get effectiveSpreadsheetWidthFraction() {
        return clamp(
          self.spreadsheetWidthFraction,
          minWidthFraction,
          maxWidthFraction,
        )
      },
      /**
       * #getter
       */
      get subviewWidths() {
        const available = self.width - dividerWidth
        const spreadsheet = Math.round(
          available * this.effectiveSpreadsheetWidthFraction,
        )
        return { spreadsheet, circular: available - spreadsheet }
      },
      /**
       * #getter
       * the records of the selected record's event, which the circle keeps at
       * full strength while it dims the rest
       */
      get highlightedChordIds() {
        const { selection } = getSession(self)
        return isFeature(selection)
          ? self.spreadsheetView.spreadsheet?.svEventFor({
              uniqueId: selection.id(),
            })?.featureIds
          : undefined
      },
      /**
       * #getter
       */
      get variantTrackId() {
        return variantTrackIdFor(self.id)
      },
      /**
       * #getter
       */
      get featuresCircularTrackConfiguration() {
        const { assemblyName, variantTrackId: trackId } = this
        return assemblyName
          ? {
              type: 'VariantTrack',
              trackId,
              name: 'features from tabular data',
              adapter: {
                type: 'FromConfigAdapter',
                features: this.allFeatures,
              },
              assemblyNames: [assemblyName],
              displays: [
                {
                  type: 'ChordVariantDisplay',
                  displayId: `${trackId}-chord-display`,
                  onChordClick:
                    'jexl:defaultOnChordClick(feature, track, pluginManager)',
                  strokeColor: 'jexl:svChordColor(feature)',
                },
              ],
            }
          : undefined
      },
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
       * accumulates onto the fraction, not the rounded spreadsheetView.width,
       * so the divider doesn't creep a pixel per drag frame
       */
      resizeSpreadsheetWidth(distance: number) {
        self.spreadsheetWidthFraction = clamp(
          self.effectiveSpreadsheetWidthFraction +
            distance / (self.width - dividerWidth),
          minWidthFraction,
          maxWidthFraction,
        )
      },
      /**
       * #action
       */
      setLaunch(launch?: LaunchInput<SvInspectorViewCommands>) {
        self.launch = launch
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        return self.setHeight(oldHeight + distance) - oldHeight
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(
            () => {
              const { pendingLaunch } = self
              if (pendingLaunch) {
                const { drilldownTracks, ...sheetLaunch } = pendingLaunch
                if (drilldownTracks) {
                  self.spreadsheetView.setDrilldownTracks(drilldownTracks)
                }
                self.spreadsheetView.setLaunch(sheetLaunch)
                self.setLaunch(undefined)
              }
            },
            { name: 'SvInspectorViewInit' },
          ),
        )
        addDisposer(
          self,
          autorun(
            () => {
              if (self.showCircularView) {
                const { spreadsheet, circular } = self.subviewWidths
                self.spreadsheetView.setWidth(spreadsheet)
                self.circularView.setWidth(circular)
              } else {
                self.spreadsheetView.setWidth(self.width)
              }
            },
            { name: 'SvInspectorView width binding' },
          ),
        )
        addDisposer(
          self,
          autorun(
            () => {
              self.spreadsheetView.setHeight(self.height - headerHeight)
              self.circularView.setHeight(
                self.height - headerHeight - circularViewOptionsBarHeight,
              )
            },
            { name: 'SvInspectorView height binding' },
          ),
        )
        addDisposer(
          self,
          autorun(
            () => {
              const { circularView, circularDisplayedRegions } = self
              // setDisplayedRegions re-fits the circle, losing pan and zoom.
              // Don't also gate on circularView.initialized: a circle holding
              // regions from a removed assembly never initializes
              if (
                circularDisplayedRegions &&
                !sameCircularRegions(
                  circularView.displayedRegions,
                  circularDisplayedRegions,
                )
              ) {
                // MST would deep-freeze the assembly's own array
                circularView.setDisplayedRegions(
                  structuredClone(circularDisplayedRegions),
                )
              }
            },
            { name: 'SvInspectorView displayed regions bind' },
          ),
        )
        addDisposer(
          self,
          autorun(
            () => {
              const { circularView, variantTrackId } = self
              const conf = self.featuresCircularTrackConfiguration
              circularView.hideTrack(variantTrackId)
              if (conf) {
                void circularView.launchTrackConf(conf)
              }
            },
            { name: 'SvInspectorView track configuration binding' },
          ),
        )

        addDisposer(
          self,
          autorun(
            () => {
              const { highlightedChordIds, visibleChordIds, variantTrackId } =
                self
              const track = self.circularView.tracks.find(
                t => t.configuration.trackId === variantTrackId,
              )
              for (const display of track?.displays ?? []) {
                display.setHighlightedFeatureIds(highlightedChordIds)
                display.setVisibleFeatureIds(visibleChordIds)
              }
            },
            { name: 'SvInspectorView chord display state binding' },
          ),
        )
      },
    }))
    .postProcessSnapshot(snap => {
      // the chord track holds every row inline and the autorun rebuilds it
      const { circularView, ...rest } = snap
      const { tracks, ...circular } = circularView
      const generatedId = variantTrackIdFor(snap.id)
      const kept = tracks.filter(
        t => trackConfId(t.configuration) !== generatedId,
      )
      return {
        ...rest,
        circularView: kept.length ? { ...circular, tracks: kept } : circular,
      }
    })

  return withLaunchInput(model, svInspectorLaunchKeys, {
    registry: pluginManager,
    materialized: () => true,
  })
}

export type SvInspectorViewStateModel = ReturnType<typeof SvInspectorViewF>

declare module '@jbrowse/core/PluginManager' {
  interface ViewTypeRegistry {
    SvInspectorView: SvInspectorViewStateModel
  }
}
export type SvInspectorViewModel = Instance<SvInspectorViewStateModel>

export default SvInspectorViewF
