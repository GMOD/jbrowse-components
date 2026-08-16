import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { clamp, getSession } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { autorun } from 'mobx'

import { featureRefNames } from './featureRefNames.ts'
import { sameCircularRegions } from './sameCircularRegions.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { CircularViewStateModel } from '@jbrowse/plugin-circular-view'
import type {
  SpreadsheetViewInit,
  SpreadsheetViewStateModel,
} from '@jbrowse/plugin-spreadsheet-view'

// forwarded verbatim to the child spreadsheet view, so it extends that view's
// init rather than restating it: a field added there arrives here too, where a
// lookalike interface would still typecheck while silently dropping it
interface SvInspectorViewInit extends SpreadsheetViewInit {}

/** height of the "show only regions with data" bar above the circular view */
export const circularViewOptionsBarHeight = 52

/**
 * The trackId a persisted circular-view track names. A track opened from the
 * session's config carries its trackId as a string; one given an inline config —
 * which is how the chord track is built — carries the whole object.
 */
function trackConfId(configuration: unknown) {
  return typeof configuration === 'string'
    ? configuration
    : ((configuration as { trackId?: string } | undefined)?.trackId ??
        undefined)
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
  // the ResizeHandle `bar` that sits between the two subviews
  const dividerWidth = 4
  // the divider stops short of either edge, so neither subview can be dragged
  // down to nothing
  const minWidthFraction = 0.2
  const maxWidthFraction = 0.8
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
         * the height of the whole view in pixels, sheet and circle together
         */
        height: types.stripDefault(types.number, defaultHeight),
        /**
         * #property
         * restrict the circular half to the chromosomes the loaded rows
         * actually touch, instead of drawing an arc for every one in the
         * assembly
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
        // The track selector stays available: the circle's own chord track is
        // built from the sheet, but a reader comparing a tumour callset against
        // its normal, or one caller against another, needs a second one beside
        // it, and hiding the selector made that unreachable. The import form is
        // still off — the regions come from the sheet's assembly, so there is
        // nothing for a reader to import here.
        circularView: types.optional(CircularModel, () =>
          CircularModel.create({
            type: 'CircularView',
            hideVerticalResizeHandle: true,
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
       * Named to match the other views, which is what `ViewContainer` reads to
       * publish `data-view-phase`. Folds in both halves because neither
       * publishes its own: the child views are rendered directly by this
       * component rather than through a ViewContainer, so a spreadsheet still
       * parsing or a circle still waiting on its assembly was invisible to
       * every readiness wait, and `website/scripts/specs/sv.ts` captures five
       * figures of this view.
       *
       * The circular term is gated on `showCircularView` so a circle that isn't
       * rendered can never hold the phase open — `waitForViewPhases` is
       * deliberately not best-effort, so a phase that never clears is a hang
       * rather than a degraded capture.
       */
      get showLoading() {
        return (
          self.spreadsheetView.showLoading ||
          (this.showCircularView && self.circularView.showLoading)
        )
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
       * every refName the features' chords land on, both ends included
       */
      get featureRefNames() {
        return [
          ...new Set(
            this.features
              .flatMap(f => featureRefNames(f))
              .filter(f => f !== undefined),
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
       * the regions the paired circular view should show, never narrowed to
       * nothing: the relevant-set is empty until the features are parsed, and
       * can also miss every region outright, since getCanonicalRefName2 hands
       * back a refName the assembly doesn't know rather than dropping it. Both
       * show everything rather than an empty circle
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
       * the two subview widths, with the divider taken out of the total first:
       * the two plus the divider have to add up to our own width, or the flex
       * row overflows and squeezes the circle.
       *
       * The fraction is clamped on read as well as on write, so a session
       * carrying an out-of-range one (hand-authored, or from a future default)
       * can't drive the circle under the width floor it clamps itself to
       */
      get subviewWidths() {
        const available = self.width - dividerWidth
        const spreadsheet = Math.round(
          available *
            clamp(
              self.spreadsheetWidthFraction,
              minWidthFraction,
              maxWidthFraction,
            ),
        )
        return { spreadsheet, circular: available - spreadsheet }
      },
      /**
       * #getter
       */
      get variantTrackId() {
        return `sv-inspector-variant-track-${self.id}`
      },
      /**
       * #getter
       * undefined until the sheet has an assembly to resolve coordinates
       * against, which is also when the paired circular view has nothing to
       * draw the chords on
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
                features: this.features,
              },
              assemblyNames: [assemblyName],
              displays: [
                {
                  type: 'ChordVariantDisplay',
                  displayId: `${trackId}-chord-display`,
                  onChordClick:
                    'jexl:defaultOnChordClick(feature, track, pluginManager)',
                  // one orange for every class said nothing about a callset
                  // whose whole question is which kind of event is where. The
                  // legend beside the circle is built from the same colors
                  strokeColor: 'jexl:svChordColor(feature)',
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
       * and having the next parent resize overwrite it.
       *
       * The delta accumulates onto the fraction rather than being read back off
       * spreadsheetView.width: the binding writes a rounded, divider-adjusted
       * width there, so a round trip through it lost a pixel on every drag
       * frame and the divider crept left even while the pointer was still
       */
      resizeSpreadsheetWidth(distance: number) {
        const fraction =
          self.spreadsheetWidthFraction + distance / (self.width - dividerWidth)
        self.spreadsheetWidthFraction = clamp(
          fraction,
          minWidthFraction,
          maxWidthFraction,
        )
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
              const { circularView, circularDisplayedRegions } = self
              // setDisplayedRegions re-fits the circle, so only write when the
              // region list really changed. With the toggle on, the relevant-set
              // recomputes on every grid filter change and would otherwise
              // throw away the user's pan and zoom on each keystroke.
              //
              // The comparison is the whole guard. Gating on
              // circularView.initialized as well reads as caution but inverts
              // on the one case that needs the write most: that getter asks
              // whether the assembly named by the regions the circle *already*
              // holds has loaded, so a circle sitting on regions from an
              // assembly the config no longer has can never be corrected, and
              // its `showLoading` stays true forever with no error to show.
              // Writing early costs nothing either way, since fitToWindow
              // defers until the view has a measured width
              if (
                circularDisplayedRegions &&
                !sameCircularRegions(
                  circularView.displayedRegions,
                  circularDisplayedRegions,
                )
              ) {
                // displayedRegions is a frozen prop, and MST deep-freezes what
                // it is handed: writing the assembly's own array would freeze
                // the assembly's regions along with it
                circularView.setDisplayedRegions(
                  structuredClone(circularDisplayedRegions),
                )
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
              const { circularView, variantTrackId } = self
              const conf = self.featuresCircularTrackConfiguration
              // the conf carries the feature list inline, so a changed feature
              // set means a whole new track: drop the old one first. Both calls
              // are MST actions, which run untracked, so neither one's read of
              // circularView.tracks makes this autorun depend on its own writes
              circularView.hideTrack(variantTrackId)
              if (conf) {
                circularView.addTrackConf(conf)
              }
            },
            { name: 'SvInspectorView track configuration binding' },
          ),
        )
      },
    }))
    .postProcessSnapshot(snap => {
      // `init` is forwarded to the child spreadsheet synchronously in
      // afterAttach, and that view caches the file location just as
      // synchronously, so this node's copy has nothing left to reconstruct.
      //
      // The chord track is built here from the sheet's rows, and
      // showTrackGeneric puts that config on the track *inline*, so persisting
      // it would write every visible feature into the session a second time —
      // and the autorun rebuilds it on attach anyway. Only that one is dropped:
      // the circle keeps its track selector so a reader can lay a second
      // callset beside this one, and dropping the whole array took theirs with
      // it. Nothing else about the subview is derived: displayedRegions,
      // bpPerPx, offsetRadians and autoFit are the user's own pan and zoom,
      // which the circular view means to keep across a reload, and dropping the
      // whole node used to reset the circle on every session load.
      // xref for Omit https://github.com/mobxjs/mobx-state-tree/issues/1524
      const { init, circularView, ...rest } = snap
      const { tracks, ...circular } = circularView
      const generatedId = `sv-inspector-variant-track-${snap.id}`
      const kept = tracks.filter(
        (t: { configuration?: unknown }) =>
          trackConfId(t.configuration) !== generatedId,
      )
      return {
        ...rest,
        circularView: kept.length ? { ...circular, tracks: kept } : circular,
      }
    })
}

export type SvInspectorViewStateModel = ReturnType<typeof SvInspectorViewF>
export type SvInspectorViewModel = Instance<SvInspectorViewStateModel>

export default SvInspectorViewF
