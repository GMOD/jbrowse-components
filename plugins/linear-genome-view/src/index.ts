import Plugin from '@jbrowse/core/Plugin'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import LineStyleIcon from '@mui/icons-material/LineStyle'

import { baseLinearDisplayConfigSchema } from './BaseLinearDisplay/index.ts'
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
import type { AbstractSessionModel } from '@jbrowse/core/util'

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
     * space, `hidden` omits it. The view's "Track labels" menu sets the same
     * thing per session
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
        onClick: (session: AbstractSessionModel) => {
          session.addView('LinearGenomeView', {})
        },
      })
    }
  }
}

export type {
  ExportSvgDisplayOptions,
  LayoutRecord,
  LegendItem,
  LegendSection,
  RenderTransform,
  RenderTransformInputs,
  TrackControlComponent,
  TrackControlIcon,
  TrackControlOption,
  TrackControlProps,
} from './BaseLinearDisplay/index.ts'

export {
  BlockMsg,
  BottomRightIndicators,
  DisplayChrome,
  DisplayChromeBase,
  DisplayChromeOverlayProvider,
  DisplayUIProvider,
  DisplayErrorBar,
  DisplayLoadingOverlay,
  DisplayStatusChrome,
  DisplayStatusChromeBase,
  FetchMixin,
  FloatingLegend,
  GROW_MAX_HEIGHT,
  GlobalDataDisplayMixin,
  GlobalFetchMixin,
  HEIGHT_MODE_VALUES,
  HeightModeMixin,
  MIN_DISPLAY_HEIGHT,
  MultiRegionDisplayMixin,
  StaleViewportRescaleMixin,
  TooLargeMessage,
  TrackControl,
  TrackControlProvider,
  TrackHeightIndicator,
  TrackHeightMixin,
  autorunOnReadyView,
  baseLinearDisplayConfigSchema,
  callEachRegion,
  computeRenderTransform,
  computeTriangleYScalar,
  fetchAllRegions,
  fetchEachRegion,
  foundationDisplayStatusPhase,
  squashToHeightCheckboxItem,
  getHeightModeOptions,
  heightModeLabel,
  heightModeMenuItems,
  installClearHoverOnViewportChange,
  installGlobalFetchAutorun,
  installGrowExitBake,
  onDisplayedRegionsChange,
  plainTrackControl,
  viewportMatchesLastDrawn,
} from './BaseLinearDisplay/index.ts'
export type {
  DisplayBackgroundProgressModel,
  DisplayChromeOverlays,
  DisplayErrorBarModel,
  DisplayLoadingOverlayModel,
  DisplayStatusPhaseFoundation,
  FetchContext,
  HeightMode,
  HeightModeMenuModel,
  StatusChromeModel,
  TooLargeMessageModel,
} from './BaseLinearDisplay/index.ts'
// plain, toolkit-free overlays: pair with DisplayChromeOverlayProvider to make
// JBrowse's own displays render without MUI, or with DisplayChromeBase to also
// keep MUI out of the bundle. See components/chromeOverlays.ts.
export { plainChromeOverlays } from './BaseLinearDisplay/index.ts'
// re-exported so LGV plugins that host their own (non-GPU) chrome can share the
// single terminal-state precedence instead of re-encoding it (arc's SVG chrome,
// which uses the `Status` variants — same ranking, minus the phase a display
// with no rendering backend cannot reach)
export {
  computeDisplayPhase,
  computeDisplayStatusPhase,
  computeLoadingTerm,
} from '@jbrowse/render-core/displayPhase'
export type {
  DisplayLoadingInputs,
  DisplayPhase,
  DisplayPhaseInputs,
  DisplayStatusPhase,
  DisplayStatusPhaseInputs,
} from '@jbrowse/render-core/displayPhase'
export type {
  ByteEstimate,
  GateViewport,
  RegionTooLargeStatus,
} from './shared/regionTooLargeUtils.ts'
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
export { normalizeTrackInit } from '@jbrowse/core/util/tracks'
export {
  linearGenomeViewPropKeys,
  partitionLaunchKeys,
} from './LinearGenomeView/initKeys.ts'
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
  TrackInit,
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
// The scalebar's grid, published because it is a contract other views draw
// against rather than an internal of this one: the synteny view's location
// markers continue this ruler down through the ribbons, and pin their pitch AND
// PHASE against this function rather than re-deriving them (which is how they
// came to sit one base off it). `Tick` comes with it so the declaration doesn't
// leak the source path — see the note above.
export { makeTicks } from './LinearGenomeView/util.ts'
export type { Tick } from './LinearGenomeView/util.ts'
export { renderToSvg } from './LinearGenomeView/svgcomponents/SVGLinearGenomeView.tsx'
export { default as SVGTracks } from './LinearGenomeView/svgcomponents/SVGTracks.tsx'
export { default as SVGView } from './LinearGenomeView/svgcomponents/SVGView.tsx'
export { default as SVGRowHeader } from './LinearGenomeView/svgcomponents/SVGRowHeader.tsx'
export { default as SVGHighlights } from './LinearGenomeView/svgcomponents/SVGHighlights.tsx'
export { default as SVGHighlightsOverlay } from './LinearGenomeView/svgcomponents/SVGHighlightsOverlay.tsx'
export { default as ExportSvgDialog } from './LinearGenomeView/components/ExportSvgDialog.tsx'
export { GetSequenceDialog } from './LinearGenomeView/lazyDialogs.ts'
export { default as ConnectedHoverHighlight } from './LinearGenomeView/components/ConnectedHoverHighlight.tsx'
export { default as HoverPositionHighlight } from './LinearGenomeView/components/HoverPositionHighlight.tsx'
export { TrackOverlayContext } from './LinearGenomeView/TrackOverlayContext.ts'
export { TrackOverlayPortal } from './LinearGenomeView/TrackOverlayPortal.tsx'
// The host-side half of the portal: the display's box, the overlay node beside
// it and the paint order between them. `TrackContainer` mounts it, and so does
// an embedder mounting `RenderingComponent` directly — who otherwise supplies no
// node at all and gets display chrome buried under their own region masks.
export { TrackOverlaySlot } from './LinearGenomeView/TrackOverlaySlot.tsx'
export { FloatingSvgOverlay } from './LinearGenomeView/FloatingSvgOverlay.tsx'
export type { HoverHighlightPosition } from './LinearGenomeView/components/HoverPositionHighlight.tsx'
export { SvgChrome, SvgClipRect } from '@jbrowse/core/svg/SvgExport'
// for a display that hand-rolls a <clipPath> instead of using SvgClipRect (an
// inset or non-rect clip); ids built from a trackId/refName need it
export { svgSafeId } from '@jbrowse/core/svg/svgId'
export { awaitSvgReady, awaitSvgRenders } from '@jbrowse/core/svg/svgReady'
export type { SvgExportable } from '@jbrowse/core/svg/svgReady'
export { renderDisplaySvg } from './shared/renderDisplaySvg.tsx'
export type {
  LgvSvgBodyProps,
  LgvSvgExportable,
} from './shared/renderDisplaySvg.tsx'
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
export { renderViewTracks } from './LinearGenomeView/svgcomponents/renderViewTracks.ts'
export type {
  SvgExportTrack,
  ViewTracksSvg,
} from './LinearGenomeView/svgcomponents/renderViewTracks.ts'
export type { SvgDisplayResult } from './LinearGenomeView/svgcomponents/util.ts'
