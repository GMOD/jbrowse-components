import type { ArrowData, LineData, RectData } from '../packRenderArrays.ts'
import type { DisplayConfig } from '../renderConfig.ts'
import type {
  AminoAcidOverlayItem,
  FlatbushItem,
  FloatingLabelsDataMap,
  SubfeatureInfo,
} from '../rpcTypes.ts'
import type { PeptideData } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// Read-only inputs threaded through every emitter: the resolved config, the
// colorByCDS flag, the per-feature translated peptides, and the worker jexl.
//
// No palette. The worker resolves no theme color at all — one that depends on
// the theme ships as a class the main-thread encode fills in (colorClasses.ts),
// which is what keeps a light/dark toggle out of the RPC cache key.
export interface RenderContext {
  config: DisplayConfig
  colorByCDS: boolean
  peptideDataMap?: Map<string, PeptideData>
  // worker pluginManager's jexl instance, so a custom `mouseover` slot can call
  // plugin-registered jexl functions. Undefined in tests → default instance.
  jexl: JexlInstance
}

// Where one glyph draws and what it belongs to — the four values every glyph
// handler needs and none of them derives: the row offset it emits at, the
// hit-test entry its primitives are attributed to, whether it is the top-level
// feature (only that one fades on collapse and skips subfeature registration),
// and the feature that owns it.
//
// One object rather than four positional arguments, because `baseTopPx` and
// `flatbushIdx` are both plain numbers and the handlers had them in three
// different orders — adjacent in two of them, where swapping the pair
// typechecked and would have drawn every primitive at the wrong row while
// attributing it to a feature that isn't there.
export interface GlyphPlacement {
  baseTopPx: number
  // How many `below` subfeature-label rows sit above this glyph inside its gene.
  // Rides beside `baseTopPx` because it IS the other half of the offset: the
  // main thread adds `labelRowsAbove × labelFontPx` to every Y emitted here, so
  // the label row is spent in the mode's own label units rather than scaled with
  // the geometry (see FeatureLayout.labelRowsAbove).
  labelRowsAbove: number
  flatbushIdx: number
  isRoot: boolean
  // The record's ROOT feature, at every depth — never the immediate container a
  // nested glyph happens to sit in. It is the `parentFeatureId` every subfeature
  // and every subfeature LABEL registers itself under, and the main thread reads
  // that field as the top-level id everywhere:
  //
  //   - `resolveSubfeature` pairs a subfeature hit with its feature by it, so a
  //     mis-named one is drawn, labelled, and never hoverable;
  //   - the layout's post-pack pass adds the parent's row offset by it, falling
  //     back to `?? 0` — the un-offset worker Y;
  //   - that same pass DELETES a floating label whose key misses the layout map,
  //     so a mis-named subfeature label vanishes with no other symptom;
  //   - `GetCanvasFeatureDetails` resolves only top-level features by id;
  //   - the highlight sweep pins by it, and the packer keys on top-level ids.
  //
  // `emitSubfeaturesGlyph` forwards this rather than its own `layout.feature`,
  // which is what holds the invariant more than one level down.
  parentFeature: Feature
}

// Mutable accumulator the emitters push into; packed into typed arrays once all
// features are processed.
export interface Collector {
  rects: RectData[]
  lines: LineData[]
  arrows: ArrowData[]
  floatingLabelsData: FloatingLabelsDataMap
  flatbushItems: FlatbushItem[]
  subfeatureInfos: SubfeatureInfo[]
  aminoAcidOverlay: AminoAcidOverlayItem[]
}

export function createCollector(): Collector {
  return {
    rects: [],
    lines: [],
    arrows: [],
    floatingLabelsData: new Map(),
    flatbushItems: [],
    subfeatureInfos: [],
    aminoAcidOverlay: [],
  }
}
