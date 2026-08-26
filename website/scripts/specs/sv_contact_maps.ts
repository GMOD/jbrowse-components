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
// SV_CONTACT_MAPS_CONFIG overrides it, which is how these four were first
// captured: the demo was built but not yet deployed, so the run pointed at a
// local copy under the build's own test_data. A re-render once the config is
// live needs no override and no edit here.
const CONFIG =
  process.env.SV_CONTACT_MAPS_CONFIG ??
  'https://jbrowse.org/demos/sv_contact_maps/config.json'

function svUrl(view: Record<string, unknown>) {
  return `?config=${encodeURIComponent(CONFIG)}&session=${encodeSessionSpec({
    views: [{ type: 'LinearGenomeView', assembly: 'hg19', ...view }],
  })}&sessionName=Screenshot`
}

// The three 1000 Genomes phase 3 calls the demo's BAM slice carries, as the
// callset spells them. Used for the highlight bands, so a band marks the call
// rather than a hand-placed pixel.
const INVERSION = { refName: '7', start: 70_420_799, end: 70_438_952 }
const DUP_CHR5 = { refName: '5', start: 175_353_978, end: 175_371_353 }

const BAND = 'rgba(30,110,190,0.16)'

function channel(trackId: string, height = 190) {
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
  }
}

const reads = (height: number) => ({
  trackId: 'na12878_300x_reads',
  type: 'LinearAlignmentsDisplay',
  height,
  readConnections: 'cloud',
  readConnectionsHeight: 150,
  readConnectionsDown: true,
  forceLoad: true,
})

const genes = {
  trackId: 'ncbi_refseq_hg19',
  type: 'LinearBasicDisplay',
  height: 60,
  showLabels: 'name',
}

const calls = { trackId: 'na12878_1000g_sv', height: 60 }

// 300x over 50-110 kb is a lot of reads to lay out under a software rasterizer,
// and four Hi-C channels are four separate matrix fetches on top of it.
const SLOW = { readyTimeout: 240_000, settleMs: 15_000 }

export const svContactMapsSpecs: ScreenshotSpec[] = [
  // THE FIGURE: one 18 kb inversion in the two pair channels that hold it. The
  // same-strand channel carries a single bright cell where the two breakpoints
  // meet, and the discordant channel carries the same cell over a scatter of
  // ordinary long fragments, which is what says the cell is a class rather than
  // a count. The read cloud below draws the same pairs the channels were built
  // from, so the map is visibly a rearrangement of the reads rather than a
  // separate measurement.
  //
  // NO DEPTH CHANNEL HERE, though the depth-vs-pairs contrast was the reason to
  // put one in. It is not flat over this window: at 750 bp on a 300x library the
  // channel has texture everywhere, and the left breakpoint sits on a coverage
  // dip that gives it a triangle of its own. Framing that as "flat" was a caption
  // the picture contradicted, and explaining it away would be a paragraph about
  // mappability in a figure about orientation.
  //
  // 50 kb, not the 260 kb the slice covers: the inversion is 18 kb, and a cell
  // is drawn at depth |x2-x1|/2, so at 260 kb the pair of breakpoints is 35 css
  // px apart and the cell has nowhere to be.
  {
    mode: 'url',
    name: 'sv_contact_maps/inversion',
    url: svUrl({
      loc: '7:70,405,000-70,455,000',
      trackLabels: 'offset',
      highlight: [{ ...INVERSION, label: 'INV', color: BAND }],
      tracks: [
        genes,
        calls,
        channel('sv_contacts_same_strand'),
        channel('sv_contacts_discordant'),
        reads(430),
      ],
    }),
    viewportHeight: 1300,
    readySelector: displayPainted('hic-display'),
    ...SLOW,
    annotations: [
      {
        type: 'text',
        text: 'Same-strand pairs meet where the two breakpoints do',
        anchor: {
          track: 'sv_contacts_same_strand',
          fracY: 0,
          alignX: 'left',
          dx: 12,
          dy: 30,
        },
      },
      {
        type: 'text',
        text: "The same cell over the library's ordinary long fragments",
        anchor: {
          track: 'sv_contacts_discordant',
          fracY: 0,
          alignX: 'left',
          dx: 12,
          dy: 30,
        },
      },
    ],
  },

  // THE CONTROL, and it is a control the data supplies rather than one the page
  // arranges: this duplication is a DUP_gs call, made by genome-STRiP on read
  // depth alone. No pair in the 300x BAM joins its two breakpoints, so the pair
  // channels carry only near-diagonal scatter over it while the depth channel is
  // at the top of its ramp. Same tracks as the inversion figure, same settings.
  //
  // The discordant and outward channels, NOT same-strand, and that is a capture
  // constraint rather than an editorial one: same_strand.hic holds no contact at
  // all inside this window, and a LinearHicDisplay whose region comes back with
  // no records never leaves `Loading...` -- 240s twice, on a display whose two
  // siblings over the same window painted in seconds. Outward is the channel a
  // tandem duplication belongs in anyway, so the negative the figure needs is
  // the one it draws.
  {
    mode: 'url',
    name: 'sv_contact_maps/depth_only_duplication',
    url: svUrl({
      loc: '5:175,330,000-175,395,000',
      trackLabels: 'offset',
      highlight: [{ ...DUP_CHR5, label: 'DUP', color: BAND }],
      tracks: [
        genes,
        calls,
        channel('sv_contacts_discordant'),
        channel('sv_contacts_outward'),
        channel('sv_contacts_depth_difference'),
        reads(430),
      ],
    }),
    viewportHeight: 1530,
    readySelector: displayPainted('hic-display'),
    ...SLOW,
    annotations: [
      {
        type: 'text',
        text: 'No pair channel puts a cell on the two breakpoints',
        anchor: {
          track: 'sv_contacts_discordant',
          fracY: 0,
          alignX: 'left',
          dx: 12,
          dy: 30,
        },
      },
      {
        type: 'text',
        text: 'The depth channel draws it anyway',
        anchor: {
          track: 'sv_contacts_depth_difference',
          fracY: 0,
          alignX: 'left',
          dx: 12,
          dy: 30,
        },
      },
    ],
  },

  // The depth channel on its own, over the same duplication as the figure above
  // and framed wide enough for its shape. A bin inside an interval of changed
  // copy number differs from every bin outside it and from none inside it, so
  // the interval draws as a cross centred on itself.
  //
  // CHROMOSOME 5, not the larger chromosome 17 duplication in the same slice,
  // which was captured and is the wrong picture: that call sits in a field of
  // KRT16 and USP32 pseudogenes whose depth swings as hard as the duplication
  // does, so the channel comes back a full red plaid with no cross in it and
  // nothing in the frame reading as negative. Same encoding, and a locus that
  // says nothing about it.
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
      highlight: [{ ...DUP_CHR5, label: 'DUP', color: BAND }],
      tracks: [
        genes,
        calls,
        channel('sv_contacts_depth_difference', 300),
        reads(360),
      ],
    }),
    viewportHeight: 1110,
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
