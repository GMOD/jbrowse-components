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
  // The whole gene, which is where the color encoding earns its keep: ten
  // annotated isoforms, two of them called, and the eight the test could not
  // separate staying neutral gray rather than competing for attention.
  //
  // ONE FIGURE, not the two-zoom compose this used to be the top half of
  // (review: "i dont think this strongly benefits from the two part figure. i
  // think we just can add the box to the part 1 figure and delete part 2
  // figure"). The zoomed half was a second frame of the same track over the same
  // gene, and its whole subject — the cassette exon — survives the pull-back:
  // at 24.8 kb the 37 bp exon is about 2 css px, but the thing being marked is
  // not the exon's WIDTH, it is that liver carries a coverage peak at
  // 7,806,974 and muscle carries nothing there, and both are plainly visible at
  // this zoom. So the box moved up here and the zoomed spec is gone.
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
    annotations: [
      {
        // no `track`, so the band spans the view's whole tracks area: one
        // vertical line tying the absent muscle signal, the liver peak and the
        // exon box on ATP5F1C-202 together. At this zoom the exon itself is ~2
        // px, so the pad is what makes the band findable — and what it marks is
        // a column through three lanes, not the feature's width.
        type: 'box',
        anchor: { locus: CASSETTE_EXON },
        pad: 9,
        strokeWidth: 3,
      },
      // One label per coverage track, right-aligned so each pill ENDS just left
      // of the band. Both lanes are quiet immediately left of the exon, which is
      // the room these use; a single centered label above lands on the location
      // box instead.
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
]
