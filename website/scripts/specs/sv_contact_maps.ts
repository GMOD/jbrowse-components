import { displayPainted, encodeSessionSpec } from '@jbrowse/browser-test-utils'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Cue's SV channels behind website/docs/tutorials/sv_contact_maps.md, drawn two
// ways over one NA12878 BAM slice: as one alignments track grouped by pair
// orientation, and as the four .hic contact maps scripts/sv_contact_maps.py
// bins them into.
//
// The demo config is the checked-in demos/sv_contact_maps/config.json, deployed
// with scripts/deploy-demo.sh. Loaded against the LOCAL build for the same
// reason specs/screenshot-spec-helpers.ts's kgUrl is: `groupBy` and
// `readConnections` are settings the hosted release predates.
//
// SV_CONTACT_MAPS_CONFIG overrides the config URL, which is how these were
// captured before the demo was deployed: a copy under the build's own
// test_data, with the data files symlinked beside it.
const CONFIG =
  process.env.SV_CONTACT_MAPS_CONFIG ??
  'https://jbrowse.org/demos/sv_contact_maps/config.json'

function svUrl(view: Record<string, unknown>) {
  return `?config=${encodeURIComponent(CONFIG)}&session=${encodeSessionSpec({
    views: [{ type: 'LinearGenomeView', assembly: 'hg19', ...view }],
  })}&sessionName=Screenshot`
}

// WHERE A CELL LANDS, which is the whole framing problem for a contact channel.
// A LinearHicDisplay draws the contact between bins a and b at x = (a + b) / 2
// and at DEPTH (b - a) / 2 / bpPerPx below the diagonal, which runs along the
// top of the track. `squashToHeight` is off, so that depth is in real pixels: a
// cell is as far down its track as half the distance between the two places it
// joins, and a track shorter than that clips the answer off the bottom of the
// triangle.
//
// TRACK_PX is the tracks area of a default 1500 px capture.
const TRACK_PX = 1487

const cellFracY = (spanBp: number, windowBp: number, trackHeight: number) =>
  ((spanBp / 2) * (TRACK_PX / windowBp)) / trackHeight

// The two 1000 Genomes phase 3 calls this page reads, as the callset spells
// them, and a band 600 bp wide on each of their breakpoints so an arc's feet
// and a cell's edges have something to land on.
const INV_START = 70_420_799
const INV_END = 70_438_952
const DUP_START = 175_353_978
const DUP_END = 175_371_353

const BAND = 'rgba(30,110,190,0.32)'

const breakpoint = (refName: string, at: number) => ({
  refName,
  start: at - 300,
  end: at + 300,
  color: BAND,
})

function channel(trackId: string, height: number, rest = {}) {
  return {
    trackId,
    // Named though the track resolves to it anyway: the figure-recipe builder
    // maps a slot to its menu item through the display type.
    type: 'LinearHicDisplay',
    height,
    // The ramp is otherwise max/20, and the diagonal owns the max. Percentile
    // scaling is what puts a 300-count inversion cell at the top of its own
    // channel instead of the bottom of the diagonal's.
    useColorPercentile: true,
    useLogScale: false,
    selectedNormalization: 'NONE',
    // The resolution picker sits over the top right of the triangle, which is
    // where a cell's own edges run.
    showResolutionControls: false,
    showLegend: false,
    ...rest,
  }
}

// The four channels as one track: the coverage band is the read-depth signal,
// and the arcs under it are the pairs, one band per orientation class. The
// config's display carries these already; they are restated so the recipe names
// each one and so a figure cannot drift with the demo.
const COVERAGE_H = 40
const ARCS_H = 110
const svChannels = (coverageHeight = COVERAGE_H, rest = {}) => ({
  trackId: 'na12878_sv_channels',
  type: 'LinearAlignmentsDisplay',
  height: 4 * (coverageHeight + ARCS_H),
  showPileup: false,
  coverageHeight,
  readConnections: 'arc',
  readConnectionsDown: true,
  readConnectionsHeight: ARCS_H,
  // At 300x roughly 99 pairs in 100 are the ordinary case, and their arcs are a
  // solid mass. What is left with them off is exactly Cue's signal set.
  drawProperPairArcs: false,
  // A pair whose mate is outside the window draws a vertical tick, and over a
  // repeat-rich duplication the same-strand bands fill with them. The figure is
  // about the pairs whose both feet are in frame.
  drawLongRange: false,
  colorBy: { type: 'orientation' },
  groupBy: { type: 'pairOrientation' },
  linkedReads: 'normal',
  showLegend: true,
  forceLoad: true,
  ...rest,
})

// Each orientation band is the coverage band over the arc band, with its label
// drawn over the top of the coverage. An arc's lowest point sits near the
// bottom of its band, a coverage step near the top.
const bandFracY = (band: number, frac: number) => (band + frac) / 4

const calls = { trackId: 'na12878_1000g_sv', height: 60 }

// 300x over 26-50 kb is a lot of reads to lay out under a software rasterizer,
// and a contact channel is a separate matrix fetch on top of it.
const SLOW = { readyTimeout: 240_000, settleMs: 15_000 }

// THE FIGURE. 26 kb around an 18 kb inversion: wide enough that both
// breakpoints have four kilobases of flank and the arcs' feet land inside the
// frame, narrow enough that a 750 bp cell is 43 px across.
const INV_WINDOW = 26_001
// Tall enough to hold the 18 kb cell at natural scale: half of 18 kb at this
// zoom is 515 px, and a shorter channel clips the deeper of the two cells off.
const INV_CHANNEL_H = 560

// The cell the callout names, by the bins the pairs actually fall in rather than
// by the call's own coordinates -- which here agree, at 70,420,875 x 70,438,875.
//
// It is not the only cell: a second one 12.75 kb deep sits above it, and the two
// left ends straddle 7:70,421,000-70,426,000, five kilobases the 300x alignment
// holds no record in at all. Each orientation class anchors on the side of that
// hole it can align to, which is what `CINV` in the record's name says.
// agent-docs/reference/DEMO_DATASETS.md has the counts.
const INV_CELL_CALL = { locus: '7:70,429,875', span: 18_000 }

// The duplication, framed with 16 kb of flank on each side: the depth channel's
// two arms run down and outward from the breakpoints, and the frame has to hold
// enough of each arm to read as an arm.
const DUP_WINDOW = 50_001
const DUP_CHANNEL_H = 300

export const svContactMapsSpecs: ScreenshotSpec[] = [
  // One inversion, drawn both ways. The channels track carries every pair the
  // encoding sorts, one band per orientation: the same-strand classes put one
  // bundle of arcs each between the two breakpoints and nothing else, the LR
  // band holds the library's scatter of long fragments, and RL is empty. Above
  // it the same-strand contact channel is the RR and LL bands binned: each
  // bundle of arcs is one cell, at the x its feet straddle and as deep as they
  // are apart.
  //
  // NO DEPTH CHANNEL HERE. At 750 bp on a 300x library the channel has texture
  // everywhere, and the left breakpoint sits on a coverage dip that gives it a
  // triangle of its own; the coverage bands in the channels track say what depth
  // does across the call without a paragraph about mappability.
  //
  // NO GENES TRACK either: RefSeq has nothing across these 26 kb.
  {
    mode: 'url',
    name: 'sv_contact_maps/inversion',
    url: svUrl({
      loc: '7:70,417,000-70,443,000',
      trackLabels: 'offset',
      highlight: [breakpoint('7', INV_START), breakpoint('7', INV_END)],
      tracks: [
        calls,
        channel('sv_contacts_same_strand', INV_CHANNEL_H, { showLegend: true }),
        svChannels(),
      ],
    }),
    viewportHeight: 1560,
    readySelector: displayPainted('hic-display'),
    ...SLOW,
    annotations: [
      {
        type: 'text',
        leader: true,
        text: 'Same-strand pairs, binned: one cell',
        anchor: {
          track: 'sv_contacts_same_strand',
          locus: INV_CELL_CALL.locus,
          fracY: cellFracY(INV_CELL_CALL.span, INV_WINDOW, INV_CHANNEL_H),
        },
        dx: 150,
      },
      {
        type: 'text',
        leader: true,
        text: 'The same pairs, one arc each',
        anchor: {
          track: 'na12878_sv_channels',
          locus: '7:70,432,500',
          fracY: bandFracY(3, 0.75),
        },
        dx: 150,
        dy: -30,
      },
    ],
  },

  // THE CONTROL, and it is a control the data supplies rather than one the page
  // arranges: this duplication is a DUP_gs call, made by genome-STRiP on read
  // depth alone. No pair in the 300x BAM joins its two breakpoints, so the RL
  // band a tandem duplication would fill is empty across the call while the
  // coverage band above it doubles and the depth channel is at the top of its
  // ramp.
  //
  // `resolutionBias: 1` on the depth channel: it writes one record per pair of
  // bins, so at 750 bp a 300x library's own coverage noise is drawn at full
  // contrast and the arms sit inside a plaid; a step coarser averages the noise
  // out and leaves them.
  {
    mode: 'url',
    name: 'sv_contact_maps/depth_only_duplication',
    url: svUrl({
      loc: '5:175,338,000-175,388,000',
      trackLabels: 'offset',
      highlight: [breakpoint('5', DUP_START), breakpoint('5', DUP_END)],
      tracks: [
        calls,
        channel('sv_contacts_depth_difference', DUP_CHANNEL_H, {
          showLegend: true,
          resolutionBias: 1,
        }),
        // A taller coverage band than the inversion's, because the depth step
        // is this figure's subject and 40 px flattens a doubling into texture.
        // At 300x every sequencing error paints a sliver on the band, and the
        // figure is about its height rather than its alleles. The legend stays
        // on the inversion figure, where the depth callout would otherwise run
        // through it.
        svChannels(80, { coverageSnpMinFrequency: 0.2, showLegend: false }),
      ],
    }),
    viewportHeight: 1460,
    readySelector: displayPainted('hic-display'),
    ...SLOW,
    annotations: [
      {
        type: 'text',
        leader: true,
        text: 'A bin inside the call against one outside',
        anchor: {
          track: 'sv_contacts_depth_difference',
          locus: '5:175,352,000',
          fracY: cellFracY(16_000, DUP_WINDOW, DUP_CHANNEL_H),
        },
        dx: 180,
      },
      {
        type: 'text',
        leader: true,
        text: 'The depth this call was made from',
        anchor: {
          track: 'na12878_sv_channels',
          locus: '5:175,356,500',
          fracY: bandFracY(0, 0.2),
        },
        dx: 220,
        dy: 30,
      },
      {
        type: 'text',
        leader: true,
        text: 'No outward pair joins the two breakpoints',
        anchor: {
          track: 'na12878_sv_channels',
          locus: '5:175,362,665',
          fracY: bandFracY(1, 0.6),
        },
        dx: 170,
      },
    ],
  },

  // The depth channel on its own, over the same duplication and at four times
  // the frame. Coverage only under it: what this one is for is how far the
  // call's own block reaches, which the 50 kb frame above cannot show because
  // it is nearly all call.
  //
  // CHROMOSOME 5, not the larger chromosome 17 duplication in the same slice:
  // that call sits in a field of KRT16 and USP32 pseudogenes whose depth swings
  // as hard as the duplication does, so the channel comes back a full red plaid
  // with nothing in the frame reading as negative.
  //
  // 120 kb is the widest frame the slice supports: it is cut at 175.24-175.48 Mb
  // and depth outside a cut region is zero, so a window reaching the edge would
  // draw the cut as the largest copy-number step on screen.
  {
    mode: 'url',
    name: 'sv_contact_maps/depth_channel',
    url: svUrl({
      loc: '5:175,300,000-175,420,000',
      trackLabels: 'offset',
      highlight: [breakpoint('5', DUP_START), breakpoint('5', DUP_END)],
      tracks: [
        calls,
        channel('sv_contacts_depth_difference', 340, { showLegend: true }),
        {
          trackId: 'na12878_300x_reads',
          type: 'LinearAlignmentsDisplay',
          height: 110,
          showPileup: false,
          readConnections: 'off',
          coverageHeight: 100,
          coverageSnpMinFrequency: 0.2,
          forceLoad: true,
        },
      ],
    }),
    viewportHeight: 830,
    readySelector: displayPainted('hic-display'),
    ...SLOW,
  },

  // The end of the line of work: the same inversion at base resolution, where
  // the pairs the same-strand channel counted are individually visible. Colored
  // by pair orientation, so a read whose mate faces the same way it does is
  // painted rather than inferred. No contact track here: the point of the frame
  // is that the map and the pileup are the same reads.
  {
    mode: 'url',
    name: 'sv_contact_maps/breakpoint_reads',
    url: svUrl({
      loc: '7:70,438,400-70,439,400',
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'na12878_300x_reads',
          type: 'LinearAlignmentsDisplay',
          height: 700,
          colorBy: { type: 'pairOrientation' },
          readConnections: 'off',
          forceLoad: true,
        },
      ],
    }),
    viewportHeight: 900,
    readyTimeout: 240_000,
    settleMs: 8_000,
  },
]
