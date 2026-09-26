import {
  GENE_GLYPH_DEFAULTS,
  modeCanShowDescription,
  modeCanShowName,
} from '@jbrowse/plugin-canvas'

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
 * Typed as `DisplayConfig`, an interface exhaustive over what the layout reads
 * (`WORKER_READS` in plugin-canvas checks it), so a field added there fails to
 * compile here unless it joins the gene half, which takes
 * `GENE_GLYPH_DEFAULTS` as a LinearVariantDisplay does.
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
    // every mark alike; the BED-color path (`itemRgb`, which `boxColor` falls
    // through to when this is unset) takes only an `r,g,b` triple and would drop
    // the alpha a jexl-authored cell color can carry.
    color: { value: `jexl:get(feature,'laneColor')`, field: '' },
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
    // the lane's tooltip is `buildVariantLaneHit`, so none is evaluated here
    mouseover: '',
    // Filtering already happened: the records reaching the lane are the ones
    // this display's own worker-side `activeFilters()` admitted, so a second
    // pass here would be a second, differently-spelled filter.
    jexlFilters: [],
    // The gene half at what a LinearVariantDisplay sends, all of it inert for
    // a record with no subfeatures.
    ...GENE_GLYPH_DEFAULTS,
    geneGlyphMode: 'all',
  }
}
