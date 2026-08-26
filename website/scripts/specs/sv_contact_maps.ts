import { displayPainted, encodeSessionSpec } from '@jbrowse/browser-test-utils'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The read-pair contact maps behind website/docs/tutorials/sv_contact_maps.md:
// one NA12878 BAM slice turned into four .hic channels by
// scripts/sv_contact_maps.py, all four served from the same demo as the reads
// they came out of.
//
// The demo config is the checked-in demos/sv_contact_maps/config.json, deployed
// with scripts/deploy-demo.sh. Loaded against the LOCAL build for the same
// reason specs/screenshot-spec-helpers.ts's kgUrl is: `readConnections` is a
// setting the hosted release predates, and a figure of the read cloud captured
// against that release is a figure of no cloud at all.
//
// SV_CONTACT_MAPS_CONFIG overrides it, which is how these were first captured:
// the demo was built but not yet deployed, so the run pointed at a local copy
// under the build's own test_data. A re-render once the config is live needs no
// override and no edit here.
const CONFIG =
  process.env.SV_CONTACT_MAPS_CONFIG ??
  'https://jbrowse.org/demos/sv_contact_maps/config.json'

function svUrl(view: Record<string, unknown>) {
  return `?config=${encodeURIComponent(CONFIG)}&session=${encodeSessionSpec({
    views: [{ type: 'LinearGenomeView', assembly: 'hg19', ...view }],
  })}&sessionName=Screenshot`
}

// WHERE A CELL LANDS, which is the whole framing problem on this page. A
// LinearHicDisplay draws the contact between bins a and b at x = (a + b) / 2 and
// at DEPTH (b - a) / 2 / bpPerPx below the diagonal, which runs along the top of
// the track. `squashToHeight` is off, so that depth is in real pixels: a cell is
// as far down its track as half the distance between the two places it joins,
// and a track shorter than that draws a triangle with the answer clipped off the
// bottom of it. The first cut of these figures did exactly that.
//
// Two consequences the numbers below are chosen against. A cell is `resolution`
// wide, so cell width and cell depth both scale with 1/bpPerPx and their ratio
// is fixed by the call: an 18 kb junction at 750 bp bins is always 12 cell
// widths deep. Narrowing the window is what makes the cell big, and it makes the
// channel that has to hold it tall in the same step.
//
// TRACK_PX is the tracks area of a default 1500 px capture. Everything derived
// from it is checked against the capture it describes.
const TRACK_PX = 1487

const cellFracY = (spanBp: number, windowBp: number, trackHeight: number) =>
  ((spanBp / 2) * (TRACK_PX / windowBp)) / trackHeight

// The two 1000 Genomes phase 3 calls this page reads, as the callset spells
// them, and a band 600 bp wide on each of their breakpoints. The band is what
// gives a cell somewhere to point: a cell's two upper edges leave it at 45
// degrees and reach the diagonal exactly at the two coordinates it joins, so
// with the breakpoints marked a reader can follow the edges up onto them.
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
    // Named though the track resolves to it anyway, for the same reason
    // specs/hic.ts names it: the figure-recipe builder maps a slot to its menu
    // item through the display type.
    type: 'LinearHicDisplay',
    height,
    // The ramp is otherwise max/20, and the diagonal owns the max. Percentile
    // scaling is what puts a 300-count inversion cell at the top of its own
    // channel instead of the bottom of the diagonal's.
    useColorPercentile: true,
    useLogScale: false,
    selectedNormalization: 'NONE',
    // The resolution picker sits over the top right of the triangle, which is
    // where a cell's own edges run. The legend stays on one channel per figure.
    showResolutionControls: false,
    showLegend: false,
    ...rest,
  }
}

const reads = (height: number, rest = {}) => ({
  trackId: 'na12878_300x_reads',
  type: 'LinearAlignmentsDisplay',
  height,
  readConnections: 'cloud',
  readConnectionsHeight: 150,
  readConnectionsDown: true,
  forceLoad: true,
  ...rest,
})

const calls = { trackId: 'na12878_1000g_sv', height: 60 }

// 300x over 26-50 kb is a lot of reads to lay out under a software rasterizer,
// and the contact channels are separate matrix fetches on top of it.
const SLOW = { readyTimeout: 240_000, settleMs: 15_000 }

// THE FIGURE. 26 kb around an 18 kb inversion: wide enough that both
// breakpoints have four kilobases of flank and the cells' edges reach the
// diagonal inside the frame, narrow enough that a 750 bp cell is 43 px across.
const INV_WINDOW = 26_001
const INV_CHANNEL_H = 560

// The cell the callout names, by the bins the pairs actually fall in rather than
// by the call's own coordinates -- which here agree, at 70,420,875 x 70,438,875.
//
// It is not the only cell: a second one 12.75 kb deep sits above it, and the two
// left ends straddle 7:70,421,000-70,426,000, five kilobases the 300x alignment
// holds no record in at all. Each orientation class anchors on the side of that
// hole it can align to, which is what `CINV` in the record's name says. Both
// cells are in frame on purpose; agent-docs/reference/DEMO_DATASETS.md has the
// counts.
const INV_CELL_CALL = { locus: '7:70,429,875', span: 18_000 }

// The duplication, framed with 16 kb of flank on each side: the depth channel's
// two arms run down and outward from the breakpoints, and the frame has to hold
// enough of each arm to read as an arm.
const DUP_WINDOW = 50_001
const DUP_CHANNEL_H = 300

export const svContactMapsSpecs: ScreenshotSpec[] = [
  // One inversion in the two pair channels that hold it. The same-strand channel
  // carries the pairs whose two ends align to the same strand, and nothing else
  // in the window puts a pair there; the discordant channel carries the same
  // cells over a scatter of ordinary long fragments, which is what says a cell is
  // a class rather than a count. The read cloud below draws the same pairs one at
  // a time, so the map is visibly a rearrangement of the reads.
  //
  // NO DEPTH CHANNEL HERE, though the depth-vs-pairs contrast was the reason to
  // put one in. It is not flat over this window: at 750 bp on a 300x library the
  // channel has texture everywhere, and the left breakpoint sits on a coverage
  // dip that gives it a triangle of its own. Framing that as "flat" was a caption
  // the picture contradicted, and explaining it away would be a paragraph about
  // mappability in a figure about orientation.
  //
  // NO GENES TRACK either: RefSeq has nothing across these 26 kb, so it drew an
  // empty lane between the call and the channels.
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
        channel('sv_contacts_discordant', INV_CHANNEL_H, {
          // The one channel here that is NOT percentile-scaled. Percentile puts
          // the top of the ramp at the 95th percentile of the counts in view,
          // which on this channel is a cell in the tail of the two bright ones
          // -- and the scatter it exists to show is single pairs, which then
          // draw as white. max/20 is low enough to leave them a color.
          useColorPercentile: false,
        }),
        reads(200, { showPileup: false }),
      ],
    }),
    viewportHeight: 1740,
    readySelector: displayPainted('hic-display'),
    ...SLOW,
    annotations: [
      {
        type: 'text',
        leader: true,
        text: 'Same-strand pairs meet here',
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
        text: 'The same pairs, one bar each',
        anchor: {
          track: 'na12878_300x_reads',
          locus: '7:70,429,875',
          fracY: 0.92,
        },
        dx: 180,
        dy: -35,
      },
    ],
  },

  // THE CONTROL, and it is a control the data supplies rather than one the page
  // arranges: this duplication is a DUP_gs call, made by genome-STRiP on read
  // depth alone. No pair in the 300x BAM joins its two breakpoints, so both pair
  // channels draw an empty triangle over the same window where the depth channel
  // is at the top of its ramp.
  //
  // The pair channels are as tall as the depth channel on purpose. All three are
  // at natural scale, so equal heights make one triangle drawn three times, and
  // the place a cell would have to be is the same place in each.
  //
  // A same-strand channel here at all is new: a LinearHicDisplay whose window
  // came back with no records used to sit on `Loading...` forever, so the first
  // cut of this figure had to leave out the one channel the inversion figure
  // leads with. 43b939e301 paints the empty frame.
  //
  // COVERAGE ONLY on the alignments track. The pileup was a wall of grey under
  // the arms, and what this figure needs from the reads is the depth step the
  // call was made from, directly under the channel that draws it.
  {
    mode: 'url',
    name: 'sv_contact_maps/depth_only_duplication',
    url: svUrl({
      loc: '5:175,338,000-175,388,000',
      trackLabels: 'offset',
      highlight: [breakpoint('5', DUP_START), breakpoint('5', DUP_END)],
      tracks: [
        calls,
        channel('sv_contacts_same_strand', DUP_CHANNEL_H),
        channel('sv_contacts_outward', DUP_CHANNEL_H),
        channel('sv_contacts_depth_difference', DUP_CHANNEL_H, {
          showLegend: true,
          // 1500 bp rather than the 750 the window would pick. The channel
          // writes one record per pair of bins, so at 750 bp a 300x library's
          // own coverage noise is drawn at full contrast and the arms sit inside
          // a plaid; a step coarser averages the noise out and leaves them.
          resolutionBias: 1,
        }),
        {
          trackId: 'na12878_300x_reads',
          type: 'LinearAlignmentsDisplay',
          height: 110,
          showPileup: false,
          readConnections: 'off',
          coverageHeight: 100,
          // At 300x every sequencing error paints a sliver on the band, and
          // the figure is about its height rather than its alleles.
          coverageSnpMinFrequency: 0.2,
          forceLoad: true,
        },
      ],
    }),
    viewportHeight: 1470,
    readySelector: displayPainted('hic-display'),
    ...SLOW,
    annotations: [
      {
        type: 'text',
        leader: true,
        text: 'No pair joins the two breakpoints',
        anchor: {
          track: 'sv_contacts_same_strand',
          locus: '5:175,362,665',
          fracY: cellFracY(DUP_END - DUP_START, DUP_WINDOW, DUP_CHANNEL_H),
        },
        dx: 170,
      },
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
          track: 'na12878_300x_reads',
          locus: '5:175,362,665',
          fracY: 0.45,
        },
        dx: 200,
      },
    ],
  },

  // The depth channel on its own, over the same duplication and at four times
  // the frame. Coverage only under it, no pair channels: what this one is for is
  // how far the call's own block reaches, which the 50 kb frame above cannot
  // show because it is nearly all call.
  //
  // CHROMOSOME 5, not the larger chromosome 17 duplication in the same slice,
  // which was captured and is the wrong picture: that call sits in a field of
  // KRT16 and USP32 pseudogenes whose depth swings as hard as the duplication
  // does, so the channel comes back a full red plaid with nothing in the frame
  // reading as negative.
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
          ...reads(700),
          colorBy: { type: 'pairOrientation' },
          readConnections: 'off',
        },
      ],
    }),
    viewportHeight: 900,
    readyTimeout: 240_000,
    settleMs: 8_000,
  },
]
