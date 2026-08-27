import Plugin from '@jbrowse/core/Plugin'

import LinearBasicDisplayF from './LinearBasicDisplay/index.ts'
import { highlightSearchResultFeature } from './LinearBasicDisplay/searchResultHighlight.ts'
import LinearMultiRowFeatureDisplayF from './LinearMultiRowFeatureDisplay/index.ts'
import MultiRowClusterFeaturesRPCMethodF from './MultiRowClusterFeaturesRPC/index.ts'
import MultiRowGetFeaturesRPCMethodF from './MultiRowGetFeaturesRPC/index.ts'
import FeatureDataRPCMethodsF from './RenderFeatureDataRPC/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class CanvasPlugin extends Plugin {
  name = 'CanvasPlugin'

  install(pluginManager: PluginManager) {
    LinearBasicDisplayF(pluginManager)
    LinearMultiRowFeatureDisplayF(pluginManager)
    FeatureDataRPCMethodsF(pluginManager)
    MultiRowGetFeaturesRPCMethodF(pluginManager)
    MultiRowClusterFeaturesRPCMethodF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    // When a text-search result is chosen, highlight the specific feature on
    // its canvas display (not just the navigated region).
    // #region searchResultSelected
    pluginManager.listenToExtensionPoint(
      'LinearGenomeView-searchResultSelected',
      ({ result, model, assemblyName }) => {
        highlightSearchResultFeature({ result, model, assemblyName })
      },
    )
    // #endregion
  }
}

export {
  linearBasicDisplayConfigSchemaFactory,
  linearBasicDisplayStateModelFactory,
  linearCanvasBaseDisplayConfigSchemaFactory,
  linearCanvasBaseDisplayStateModelFactory,
} from './LinearBasicDisplay/index.ts'
// The exact string `colorByMode` recognizes as "color by strand". Exported so a
// third party writing the `color` slot can produce the value the display reads
// back as strand mode rather than as an opaque jexl — @jbrowse/img pins its own
// copy against this one's literal type, so the two cannot drift.
export {
  STRAND_COLOR_JEXL,
  attributeColorJexl,
} from './RenderFeatureDataRPC/featureColors.ts'
// Feature-label text and geometry, for a display outside this plugin that draws
// labels beside features and must draw them the same way.
//
// These are the pieces, and a caller reaching for them should first ask whether
// it wants the whole band instead — see the feature-band exports at the bottom of
// this file. The multi-sample variant display's lane used to letter its marks
// with `createFeatureFloatingLabels` and cull collisions itself, having no second
// row to push a colliding neighbour onto; it now takes this plugin's layout,
// which HAS rows, so its labels are placed by the packer that reserved room for
// them and its overlap is resolved by stacking like everywhere else. The pieces
// stay exported because a caller that genuinely draws one label beside one mark
// still owes the same text, the same measured width and the same two colors.
//
// `createFeatureFloatingLabels` is the whole text half in one call — it is what
// truncates a name by length and a description by *rendered width*, drops one
// that is blank or `.`, and measures at LABEL_FONT_SIZE. Re-spelling any part of
// that outside this plugin is how the same record ends up lettered differently
// in two displays.
//
// Not the COLORS, which are `labelColors` on the main thread: a label's color is
// a function of its kind and the theme alone, and resolving it here would put
// the palette in the worker's RPC payload — where every field is a cache key, so
// a light/dark toggle would refetch (see colorClasses.ts).
//
// `LABEL_PADDING_PX` is the horizontal breathing room two labels need whatever
// resolves their overlap, sized to absorb measureText's disagreement with the
// rendered font. `LABEL_BASELINE_RATIO` is the vertical counterpart — where a
// label's baseline sits inside its line box — and any canvas drawing a label into
// a box owes that conversion, this plugin's own SVG export included.
export {
  LABEL_BASELINE_RATIO,
  LABEL_FONT_SIZE,
  LABEL_PADDING_PX,
} from './RenderFeatureDataRPC/constants.ts'
export { createFeatureFloatingLabels } from './RenderFeatureDataRPC/floatingLabels.ts'
// The label-content vocabulary, so a display outside this plugin offers the
// same five choices under the same names rather than a second spelling of the
// same setting. The variant lane admits both kinds under 'auto' and leaves the
// adapting to the fit ladder, which is what decides how much of each record a
// band that cannot grow spends its pixels on.
export {
  SHOW_LABELS_MODES,
  modeCanShowDescription,
  modeCanShowName,
} from './LinearBasicDisplay/showLabelsMode.ts'
export { computeLabelPosition } from './LinearBasicDisplay/components/labelPositioning.ts'
export type {
  FeatureBoundsPx,
  LabelMetrics,
} from './LinearBasicDisplay/components/labelPositioning.ts'
export type {
  LinearBasicDisplayModel,
  LinearCanvasBaseDisplayModel,
} from './LinearBasicDisplay/index.ts'

// Types that appear in the inferred shape of the exported display models. They
// have to be reachable from this entry or tsc names them by source path in
// consumers' .d.ts — see scripts/check-declaration-leaks.ts.
export type { GeneGlyphNotice } from './LinearBasicDisplay/baseModel.ts'
export type { RegionDensityStats } from './shared/regionDensity.ts'
export type { CanvasFeatureRenderingBackend } from './LinearBasicDisplay/components/canvasFeatureRenderingBackendTypes.ts'
export type { LinearBasicDisplayComponentProps } from './LinearBasicDisplay/components/FeatureComponent.tsx'
export type {
  FeatureItemEntry,
  FlatbushRegionIndexes,
} from './LinearBasicDisplay/components/hitTesting.ts'
export type {
  LinearBasicDisplayConfig,
  LinearBasicDisplayConfigModel,
} from './LinearBasicDisplay/configSchema.ts'
export type { LinearCanvasBaseDisplayConfigModel } from './LinearBasicDisplay/baseConfigSchema.ts'
export type { FeatureContextMenuInfo } from './LinearBasicDisplay/featureContextMenu.ts'
export type {
  FeatureHighlight,
  HighlightTarget,
  ResolvedHighlights,
} from './LinearBasicDisplay/featureHighlight.ts'
export type { FitStage } from './LinearBasicDisplay/fitLadder.ts'
export type { FitDrops } from './LinearBasicDisplay/fitNotes.ts'
export type {
  IncrementalLayout,
  IsoformCountFreeInputs,
  LabelRoomFactorFreeInputs,
  LayoutInputs,
  LayoutRegionData,
} from './LinearBasicDisplay/layout.ts'
export type { ShowLabelsMode } from './LinearBasicDisplay/showLabelsMode.ts'
export type {
  DisplayConfig,
  DisplayMode,
} from './RenderFeatureDataRPC/renderConfig.ts'
export type {
  FeatureDataResult,
  FlatbushItem,
  LabelItem,
  RegionRenderData,
  SubfeatureInfo,
} from './RenderFeatureDataRPC/rpcTypes.ts'
export type { RegionGateMeasurement } from './shared/CanvasFeatureGateMixin.ts'

// The feature glyph passes and their Canvas2D painters, for a display outside
// this plugin that draws gene glyphs under its own axis: a rect, line, chevron
// or arrow instance is positioned in whatever unit the layer's `bpRangeX`
// uniform is stated in, so a lane laid out in px hands the passes px.
export {
  ArrowPass,
  ARROW_PASS,
  CHEVRON_PASS,
  FEATURE_GLYPH_UNIFORM_BYTE_SIZE,
  LINE_PASS,
  LinePass,
  RECT_PASS,
  RectPass,
  makeChevronPass,
  packArrows,
  packLines,
  packRects,
  rectShader as featureGlyphShader,
} from './LinearBasicDisplay/passes/index.ts'
export { CANVAS_GLYPH_DRAW } from './LinearBasicDisplay/components/Canvas2DFeatureRenderer.ts'
export { MAX_VISIBLE_CHEVRONS_PER_LINE } from './LinearBasicDisplay/components/sharedRendererConstants.ts'
// The gene glyph's own shape rules, for a display outside this plugin that
// draws this plugin's glyphs through the passes above. `isCDS`/`isExon` are
// case-insensitive and `isUTR` knows the three spellings, which is the whole
// reason to take them rather than to test `type ===` again.
export {
  UTR_HEIGHT_FRACTION,
  centerShrink,
} from './RenderFeatureDataRPC/collect/emitPrimitives.ts'
export {
  featureType,
  getSubfeatures,
  isCDS,
  isExon,
  isUTR,
} from './RenderFeatureDataRPC/util.ts'
export { mergeSpans } from './shared/mergeSpans.ts'
export type { Span as GlyphSpan } from './shared/mergeSpans.ts'
export type { RenderState as FeatureGlyphRenderState } from './LinearBasicDisplay/components/canvasFeatureRenderingBackendTypes.ts'

// The feature band, as pure functions, so a display outside this plugin can draw
// this plugin's data instead of growing its own layout, hit test and labels.
//
// The multi-sample variant display's lane is that caller. Its band is one strip
// of a genotype-matrix display, so it cannot host a `LinearVariantDisplay` — a
// track renders one display, and a second one would parse the same VCF again.
// What it can do is hold the same payload: its worker has already parsed the
// records, so it runs `buildFeatureRenderData` over them, packs with
// `computeLaidOutData`, fits with `resolveFitLadder`, paints with
// `paintFeatureBand` and picks with `performMultiRegionHitDetection`. Every one of
// those is the function `LinearBasicDisplay` itself calls, which is the point:
// overlap packing, paint order, label collision, outlines and the click target
// are decided once, here, and a lane cannot drift from the display it stands in
// for.
//
// The seam is deliberately the DATA and not the model. Everything below takes
// plain arrays, plain config and plain numbers — no MST, no React, no adapter —
// so the caller supplies its own reactivity (the lane's are MobX computeds on its
// own model) and its own height budget.
//
// What is NOT here is the pieces `paintFeatureBand` composes — the block painter,
// the label walk, the label painter, the cull band. A band consumer wants the
// composition, in the order and with the shared arguments stated there; a
// consumer welding its own would be free to letter at a font size the packer
// never measured, or to cull against a scroll window a band does not have.
// `agent-docs/mechanisms/feature-band-consumers.md` is the contract.
export { buildFeatureRenderData } from './RenderFeatureDataRPC/buildFeatureRenderData.ts'
export {
  computeLaidOutData,
  createContentHeightProbe,
  maxBottom,
  minDrawnBoxHeight,
  scaleLaidOutData,
} from './LinearBasicDisplay/layout.ts'
export {
  MIN_FIT_BOX_PX,
  resolveFitLadder,
  solveLabelRoomFactor,
  squeezeFloorScale,
} from './LinearBasicDisplay/fitLadder.ts'
export { paintFeatureBand } from './LinearBasicDisplay/components/paintFeatureBand.ts'
export {
  buildFeatureFlatbushIndex,
  isHitFeature,
  performMultiRegionHitDetection,
} from './LinearBasicDisplay/components/hitTesting.ts'
export {
  HEIGHT_MULTIPLIERS,
  labelFontSize,
} from './RenderFeatureDataRPC/glyphs/glyphUtils.ts'
export type { FeatureBandPaint } from './LinearBasicDisplay/components/paintFeatureBand.ts'
export type {
  HitFeatureResult,
  VisibleRegion,
} from './LinearBasicDisplay/components/hitTesting.ts'
