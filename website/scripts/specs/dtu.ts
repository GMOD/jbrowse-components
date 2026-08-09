import { displayReady, lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// ──────────────────────────────────────────────────────────────────────────
// Differential transcript usage — real ENCODE ENTEx data (hg38). satuRn tested
// transcript *usage* (the fraction of a gene's reads assigned to each
// transcript) between skeletal muscle and liver, 4 donors each, on RSEM
// quantifications against GENCODE v29; the per-transcript result was written
// back into the GFF3 attribute column, and the canvas gene glyph paints it
// through a `jexl:` color callback. Data + config:
// demos/dtu/config.json, hosted at jbrowse.org/demos/dtu/.
//
// What makes these figures worth having is that the color is not a category
// someone assigned — it is a continuous statistic (ΔIF, the change in isoform
// fraction) that came out of the analysis, so the glyph carries the result
// rather than illustrating it. The `legend` slot on the display declares what
// the ramp means, because a jexl expression is otherwise a lookup table only
// its author can read.
// ──────────────────────────────────────────────────────────────────────────

const DTU_CONFIG = encodeURIComponent(
  'https://jbrowse.org/demos/dtu/config.json',
)

// The cassette exon the whole figure is about. GENCODE v29 places it at
// chr10:7,806,974-7,807,010 (37 bp): ATP5F1C-202 keeps it, ATP5F1C-201 skips
// it. Written once and anchored from, rather than measured into viewport px —
// the box then lands on the exon at any width or zoom (see locusAnchor.ts).
const CASSETTE_EXON = 'chr10:7,806,974-7,807,010'

// Both coverage tracks are pinned to the same 0–16 scale so the two bands are
// comparable by height and not just by shape. They are one donor each (the
// statistic behind the colors uses all eight), which is why the track names
// carry their ENCODE accessions.
const coverage = (trackId: string) => ({
  trackId,
  type: 'LinearWiggleDisplay',
  height: 90,
  minScore: 0,
  maxScore: 16,
})

// `grow`, not the demo config's pinned 285. The lane packs ten transcripts and
// the packing depends on the window, so a pinned height is right for exactly one
// of the two figures below: at the 8 kb window it left ~40 css px of empty lane
// under the last row, and at the whole-gene one it is the height the config was
// tuned for. Growing to the content is right for both and takes the blank with
// it.
const glyph = {
  trackId: 'dtu_muscle_vs_liver',
  type: 'LinearBasicDisplay',
  heightMode: 'grow',
}

// Both figures gate on the gene lane having actually painted rather than on the
// liver track's NAME appearing, which is in the DOM as soon as the track opens
// and says nothing about the three canvases under it. Neither spec carried a
// settleMs either, so the capture's only protection was the run's own
// paint check.
const DTU_READY = displayReady('feature-display')

export const dtuSpecs: ScreenshotSpec[] = [
  // The hero: one cassette exon, the read evidence for it in both tissues, and
  // the two isoforms it distinguishes, colored by the statistic that called it.
  // Muscle coverage is flat across the exon while liver peaks on it, and only
  // the blue (liver-preferred) transcript draws a box there — the same fact
  // three ways in one frame.
  {
    mode: 'url',
    name: 'dtu/atp5f1c_isoform_switch',
    url: lgvSession(DTU_CONFIG, {
      assembly: 'hg38',
      // the 3' third of ATP5F1C. Wide enough to hold three exons both tissues
      // cover, so the empty muscle band over the cassette exon reads as
      // *skipping* rather than as a track that failed to load or a gene that
      // simply ended
      // right edge carried ~1 kb past the gene so the shared final exon lands
      // clear of the floating color key rather than behind it
      loc: 'chr10:7,801,200..7,809,400',
      tracks: [coverage('muscle_plus'), coverage('liver_plus'), glyph],
    }),
    readySelector: DTU_READY,
    settleMs: 4000,
    viewportHeight: 730,
    annotations: [
      {
        // no `track`, so the ring spans the view's whole tracks area: one
        // vertical band tying the absent muscle signal, the liver peak, and the
        // exon box together
        type: 'box',
        anchor: { locus: CASSETTE_EXON },
        pad: 9,
        strokeWidth: 3,
      },
      // one label per coverage track, each right-aligned so its pill ENDS just
      // left of the exon — the tracks are empty there, and the alternative (a
      // single centered label above) lands on the location box
      {
        type: 'text',
        text: 'no reads — exon skipped',
        anchor: {
          locus: CASSETTE_EXON,
          track: 'muscle_plus',
          fracY: 0.5,
          alignX: 'left',
        },
        textAlign: 'end',
        dx: -14,
      },
      {
        type: 'text',
        text: '37 bp exon retained',
        anchor: {
          locus: CASSETTE_EXON,
          track: 'liver_plus',
          fracY: 0.35,
          alignX: 'left',
        },
        textAlign: 'end',
        dx: -14,
      },
    ],
  },

  // The same locus pulled back to the whole gene, which is where the color
  // encoding earns its keep: ten annotated isoforms, two of them called, and
  // the eight the test could not separate staying neutral gray rather than
  // competing for attention.
  //
  // Right edge carried ~4 kb past the gene, the same lever the figure above
  // documents and this one did not have. The floating color key is pinned to
  // the track's top-right corner (FloatingLegend's `right: 10, top: 10`) with an
  // opaque paper background and no placement slot, so on a window that ends
  // where the gene ends it sits ON the 3' end of every row — here it covered the
  // last exon of both colored transcripts and five of the gray ones. The only
  // lever a spec has is where the data is, so the window carries past it.
  {
    mode: 'url',
    name: 'dtu/dtu_colored_gene_glyph',
    url: lgvSession(DTU_CONFIG, {
      assembly: 'hg38',
      loc: 'chr10:7,787,600..7,812,400',
      tracks: [coverage('muscle_plus'), coverage('liver_plus'), glyph],
    }),
    readySelector: DTU_READY,
    settleMs: 4000,
    viewportHeight: 730,
  },

  // The two above as ONE figure (reviewer, on the wide one: "this is very
  // similar to dtu/atp5f1c_isoform_switch, might make multi-part figure, or
  // delete dtu/atp5f1c_isoform_switch entirely"). They are the same track over
  // the same gene at two zooms, and side by side in a page they read as a
  // repeat; stacked in one frame they read as one zoom, which is what they are.
  //
  // Whole gene on TOP, and that order is the answer to the other note on this
  // pair ("there are weird 'gaps' between the gene glyphs. might want to find a
  // way to fix this. can we sort or pack transcripts in a glyph automatically
  // in cases like this?"). Checked against the whole-gene frame: the empty rows
  // are ATP5F1C-203, -204, -205 and -207, all four of which END before the 8 kb
  // window starts. The layout is computed per BLOCK rather than per visible
  // window -- which is what keeps rows from renumbering as you pan -- so a
  // feature just off the left edge keeps its row and the row draws empty.
  // Nothing declarative removes them, and packing them out would mean a layout
  // that reshuffles on every scroll. The whole-gene frame above names every one
  // of those rows instead, so the gaps read as isoforms that ended rather than
  // as something having gone wrong.
  {
    mode: 'compose',
    name: 'dtu/atp5f1c_dtu',
    parts: ['dtu/dtu_colored_gene_glyph', 'dtu/atp5f1c_isoform_switch'],
  },
]
