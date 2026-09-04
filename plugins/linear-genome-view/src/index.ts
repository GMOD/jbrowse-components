import Plugin from '@jbrowse/core/Plugin'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { types } from '@jbrowse/mobx-state-tree'
import LineStyleIcon from '@mui/icons-material/LineStyle'

import FeatureTrackF from './FeatureTrack/index.ts'
import LaunchLinearGenomeViewF from './LaunchLinearGenomeView/index.ts'
import SequenceFeatureHoverHighlightExtensionF from './LinearGenomeView/components/SequenceFeatureHoverHighlightExtension.tsx'
import LinearGenomeViewF from './LinearGenomeView/index.ts'
import {
  LinearGenomeView,
  SearchBox,
  ZoomControls,
} from './lazyPluginExports.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'

export default class LinearGenomeViewPlugin extends Plugin {
  name = 'LinearGenomeViewPlugin'

  // the three components here are lazy, see lazyPluginExports.tsx — naming a
  // component in this object is enough to pin it into every host's first paint
  exports = {
    baseLinearDisplayConfigSchema,
    SearchBox,
    ZoomControls,
    LinearGenomeView,
  }

  /**
   * #config LinearGenomeViewConfigSchema
   * #category root
   */
  configurationSchema = ConfigurationSchema('LinearGenomeViewConfigSchema', {
    /**
     * #slot configuration.LinearGenomeViewPlugin.trackLabels
     * where a track's name is drawn: `offset` gives it its own line above the
     * data, `overlapping` floats it over the top of the data to save vertical
     * space, `hidden` omits it. The view menu's "Show..." submenu sets the same
     * thing per session, under its "Track labels" heading
     */
    trackLabels: {
      type: 'string',
      defaultValue: 'offset',
      model: types.enumeration('trackLabelOptions', [
        'offset',
        'overlapping',
        'hidden',
      ]),
    },
  })

  install(pluginManager: PluginManager) {
    FeatureTrackF(pluginManager)
    LinearGenomeViewF(pluginManager)
    LaunchLinearGenomeViewF(pluginManager)
    SequenceFeatureHoverHighlightExtensionF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Add', {
        label: 'Linear genome view',
        icon: LineStyleIcon,
        onClick: (session: AbstractViewContainer) => {
          session.addView('LinearGenomeView', {})
        },
      })
    }
  }
}

// The toolkit-free chrome contract, re-exported for code already reaching
// this plugin; its home is `@jbrowse/display-ui`. The display layer itself
// (the fetch foundations, the chrome, SVG export, the byte gate) is
// `@jbrowse/display-kit`, and is imported from there by subpath, never from
// here.
export {
  DisplayChromeOverlayProvider,
  DisplayUIProvider,
  FloatingLegend,
  TrackControlProvider,
  plainChromeOverlays,
  plainTrackControl,
  useTrackControlMenu,
} from '@jbrowse/display-ui'
export type {
  DisplayBackgroundProgressModel,
  DisplayChromeOverlays,
  DisplayErrorBarModel,
  DisplayLoadingOverlayModel,
  LegendItem,
  LegendSection,
  TooLargeMessageModel,
  TrackControlComponent,
  TrackControlIcon,
  TrackControlMenu,
  TrackControlOption,
  TrackControlProps,
} from '@jbrowse/display-ui'
export {
  HighlightBand,
  HighlightChip,
  type LinearGenomeViewModel,
  type LinearGenomeViewStateModel,
  OverviewHighlightBand,
  SVGHighlightBand,
  installLinkedViewSync,
  stateModelFactory as linearGenomeViewStateModelFactory,
} from './LinearGenomeView/index.ts'
// Deliberately the component itself, and deliberately not the same `SearchBox`
// the `exports` object above hands runtime plugins — that one is lazy. An
// in-tree consumer (comparative view, breakpoint split view) imports this
// barrel and gets shaken out of every build that doesn't, which is all the
// laziness it needs; a runtime plugin resolves `exports` at module scope, where
// only `lazy()` keeps the component out of the host's first paint. Imported
// straight from the component rather than through `LinearGenomeView/index.ts`
// so the view registration module holds no React component at all.
export { default as SearchBox } from './LinearGenomeView/components/SearchBox.tsx'
// The same two consumers, one composition further on: a header stacking several
// views draws one search box per row beside the span it is showing, and
// `HeaderSearchBoxRow` is the whole strip of them. `useSearchBoxPrefs` holds the
// visibility/orientation choice and `searchBoxMenuItems` the rows that set it —
// shared rather than copied, since the copies had already drifted on what to
// call `sideBySide: false`. Only the storage prefix stays with each container.
export { default as HeaderSearchBoxes } from './LinearGenomeView/components/HeaderSearchBoxes.tsx'
export { default as HeaderSearchBoxRow } from './LinearGenomeView/components/HeaderSearchBoxRow.tsx'
export {
  searchBoxMenuItems,
  useSearchBoxPrefs,
} from './LinearGenomeView/components/useSearchBoxPrefs.ts'
export type { SearchBoxPrefs } from './LinearGenomeView/components/useSearchBoxPrefs.ts'
export { normalizeTrackInit } from '@jbrowse/core/util/tracks'
export {
  linearGenomeViewPropKeys,
  partitionLaunchKeys,
} from './LinearGenomeView/initKeys.ts'
export { applyInitHighlights } from './LinearGenomeView/afterAttach.ts'
export { MultiLevelRubberband } from './MultiLevelRubberband/index.ts'
export { fetchResults, SearchResultsNotFoundError } from './searchUtils.ts'
export type { LaunchLinearGenomeViewArgs } from './LaunchLinearGenomeView/index.ts'
export type {
  BpOffset,
  ExportSvgOptions,
  HighlightType,
  InitState,
  LinearGenomeViewLaunchProps,
  NavLocation,
  TrackLabelMode,
  VolatileGuide,
} from './LinearGenomeView/types.ts'
// Not for consumers to import — it is the element type of the view model's
// `scalebarRefNameLabels` getter, so tsc has to name it when it serializes the
// model's inferred type into every downstream `.d.ts`. With no path to it from
// this entry, tsc falls back to the source path
// (`@jbrowse/plugin-linear-genome-view/src/LinearGenomeView/util.ts`), which
// tarballs don't ship and consumers can't resolve. check-declaration-leaks
// guards this; see issue #4678.
export type { ScalebarRefNameLabel } from './LinearGenomeView/util.ts'
// Same reason, for the `displayedRegionsOrientation` getter: the breakpoint
// split view, the two synteny displays and the react-linear-genome-view model
// all serialize it.
export type { RegionsOrientation } from './LinearGenomeView/util.ts'
// The scalebar's grid, published because it is a contract other views draw
// against rather than an internal of this one: the synteny view's location
// markers continue this ruler down through the ribbons, and pin their pitch AND
// PHASE against this function rather than re-deriving them (which is how they
// came to sit one base off it). `Tick` comes with it so the declaration doesn't
// leak the source path — see the note above.
export { makeTicks } from './LinearGenomeView/util.ts'
export type { Tick } from './LinearGenomeView/util.ts'
// The two halves of "show these regions instead": navigate the view you are
// looking at, or seed a snapshot for a new one. A caller deriving either itself
// lands on a viewport property the model no longer reads — see each for how.
export { containingLgv } from './LinearGenomeView/containingLgv.ts'
export { showRegionsWithUndo } from './LinearGenomeView/showRegionsWithUndo.ts'
export type { SharedFit } from './LinearGenomeView/sharedScaleContainer.ts'
export { fitAllRegionsWindow } from './LinearGenomeView/util.ts'
export { renderToSvg } from './LinearGenomeView/svgcomponents/SVGLinearGenomeView.tsx'
// The third form of the same export: not a file, not a markup string, but the
// components mounted in a host's own page. See the file for the three pieces
// between `renderToSvg` and inline JSX that each fail quietly.
export { useViewSvgFigure } from './LinearGenomeView/svgcomponents/useViewSvgFigure.tsx'
export type {
  ViewSvgFigureOptions,
  ViewSvgFigureResult,
} from './LinearGenomeView/svgcomponents/useViewSvgFigure.tsx'
export { default as SVGTracks } from './LinearGenomeView/svgcomponents/SVGTracks.tsx'
export { default as SVGView } from './LinearGenomeView/svgcomponents/SVGView.tsx'
export { default as SVGRowHeader } from './LinearGenomeView/svgcomponents/SVGRowHeader.tsx'
export { default as SVGHighlights } from './LinearGenomeView/svgcomponents/SVGHighlights.tsx'
export { default as SVGHighlightsOverlay } from './LinearGenomeView/svgcomponents/SVGHighlightsOverlay.tsx'
export { default as ExportSvgDialog } from './LinearGenomeView/components/ExportSvgDialog.tsx'
export { GetSequenceDialog } from './LinearGenomeView/lazyDialogs.ts'
export { default as ConnectedHoverHighlight } from './LinearGenomeView/components/ConnectedHoverHighlight.tsx'
export { default as HoverPositionHighlight } from './LinearGenomeView/components/HoverPositionHighlight.tsx'
// The overlay layer lives in `@jbrowse/display-ui` — a package rather than this
// plugin, because `packages/tree-sidebar` needed it and had to depend on a
// *plugin* to get it. Re-exported here, since every display already names it
// from this one.
//
// The host-side half of the portal is `TrackOverlaySlot`: the display's box, the
// overlay node beside it and the paint order between them. `TrackContainer`
// mounts it, and so does an embedder mounting `RenderingComponent` directly —
// who otherwise supplies no node at all and gets display chrome buried under
// their own region masks.
export {
  FloatingSvgOverlay,
  TrackOverlayContext,
  TrackOverlayPortal,
  TrackOverlaySlot,
} from '@jbrowse/display-ui'
export type { HoverHighlightPosition } from './LinearGenomeView/components/HoverPositionHighlight.tsx'
export { SvgChrome, SvgClipRect } from '@jbrowse/core/svg/SvgExport'
// for a display that hand-rolls a <clipPath> instead of using SvgClipRect (an
// inset or non-rect clip); ids built from a trackId/refName need it
export { svgSafeId } from '@jbrowse/core/svg/svgId'
export { awaitSvgReady, awaitSvgRenders } from '@jbrowse/core/svg/svgReady'
export type { SvgExportable } from '@jbrowse/core/svg/svgReady'
export {
  defaultTextHeight,
  getRowHeaderLayout,
  labelBaselineFromTop,
  labelOffset,
  totalHeight,
  trackBoxHeight,
  trackBoxOffsets,
  trackLabelLeftOffset,
} from './LinearGenomeView/svgcomponents/util.ts'
// Re-exported from core, where it moved so the circular view — which depends
// on neither this plugin nor the LGV geometry around it — can send the same
// notification. Kept on this plugin's surface because published plugins
// resolve it here.
export { notifySkippedSvgTracks } from '@jbrowse/core/svg/trackNames'
export { renderViewTracks } from './LinearGenomeView/svgcomponents/renderViewTracks.ts'
export type {
  SvgExportTrack,
  ViewTracksSvg,
} from './LinearGenomeView/svgcomponents/renderViewTracks.ts'
export type { SvgDisplayResult } from './LinearGenomeView/svgcomponents/util.ts'
