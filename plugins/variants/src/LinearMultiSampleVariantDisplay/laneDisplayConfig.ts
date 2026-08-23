import { modeCanShowDescription, modeCanShowName } from '@jbrowse/plugin-canvas'

import type { DisplayConfig, ShowLabelsMode } from '@jbrowse/plugin-canvas'

/**
 * The `plugin-canvas` display config the variant lane lays its band out with.
 *
 * A literal rather than a config node, because the lane is a *band* and not a
 * display: it has no config schema of its own to read these off, and the ones
 * that matter to it are already slots on this display (`variantLaneLabels`, and
 * the cell coloring the marks inherit). Everything else is what a variant record
 * needs, which is almost nothing — a variant has no transcripts, no CDS, no
 * strand and no subfeatures, so `findGlyph` lands on `layoutBox` and the whole
 * gene half of this interface is inert.
 *
 * Typed as `DisplayConfig` on purpose, and that is the drift guard: the interface
 * is exhaustive over what the layout reads (`WORKER_READS` in plugin-canvas
 * proves it), so a field added there fails to compile here rather than silently
 * taking a default the lane never considered.
 */
export function laneDisplayConfig({
  labels,
  featureHeight,
}: {
  labels: ShowLabelsMode
  featureHeight: number
}): DisplayConfig {
  return {
    // Each record's own color, read off the attribute `buildLaneRenderData`
    // stamps it with — the display resolved that color once, for the alt cells,
    // and a lane mark being the same color as the column under it is the whole
    // point of drawing them in one display. A concrete color here would repaint
    // every mark alike; the BED-color path (`itemRgb`, which `getBoxColor` falls
    // through to when this is unset) takes only an `r,g,b` triple and would drop
    // the alpha a jexl-authored cell color can carry.
    color: `jexl:get(feature,'laneColor')`,
    connectorColor: undefined,
    utrColor: undefined,
    // The unset spelling, which `resolveOutlineColor` reads as "no outline".
    // Boxes in a band this short are mostly outline if they carry one.
    outlineColor: '',
    featureHeight,
    // The label content the `variantLaneLabels` slot asked for, expressed the
    // way plugin-canvas expresses it: withholding the jexl IS how a kind is
    // turned off, and these two expressions are that plugin's own defaults, so a
    // lettered mark reads identically to the same record in a
    // LinearVariantDisplay. The `auto` mode admits both and leaves the adapting
    // to the fit ladder, which is what decides how many lines a 40px band can
    // actually spend.
    labels: {
      name: modeCanShowName(labels)
        ? `jexl:get(feature,'name') || get(feature,'id')`
        : '',
      description: modeCanShowDescription(labels)
        ? `jexl:get(feature,'description')`
        : '',
    },
    // plugin-canvas's own default, so hovering a mark in the lane says what
    // hovering the same record in a LinearVariantDisplay says.
    mouseover: `jexl:get(feature,'_mouseOver')||get(feature,'name')||get(feature,'function')||get(feature,'id')`,
    // Filtering already happened: the records reaching the lane are the ones
    // this display's own worker-side `activeFilters()` admitted, so a second
    // pass here would be a second, differently-spelled filter.
    jexlFilters: [],
    // Every gene-shaped decision, at the value that makes it a no-op for a
    // record with no subfeatures. Spelled out rather than defaulted because the
    // interface has no defaults — and because "a variant is a box" is the
    // assumption the lane rests on, so it is worth being able to read.
    geneGlyphMode: 'all',
    maxIsoforms: undefined,
    subfeatureLabels: 'none',
    transcriptTypes: [],
    canonicalTranscriptField: '',
    canonicalTranscriptTags: [],
    containerTypes: [],
    subParts: '',
    impliedUTRs: false,
    // A VCF record never carries a strand, so a chevron would be drawn from an
    // absent one.
    displayDirectionalChevrons: false,
    hideSourceFeatures: false,
  }
}
