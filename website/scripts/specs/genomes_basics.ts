import {
  PARK_CURSOR,
  UCSC_HG38_CONFIG,
  cascadeBoxes,
  menuCascade,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the genomes_basics tutorial: the click path from the
// genomes.jbrowse.org front page to a track drawn over TP53, and then a walk
// through what else that one config's catalog holds at the same locus.
//
// Loads genomes.jbrowse.org's OWN hg38 config, the same way the genomes_synteny
// and genomes_msa figures do, so the track names in the selector, the category
// they sit under and the track the checkbox opens are the ones a reader gets on
// the real site. An earlier version of this figure built the same picture out of
// `sessionTracks` against a bare hg38 config, which rendered the same phyloP
// BigWig under a name nothing in the UI would ever show.
//
// The BigWig itself is served by hgdownload with byte-range + CORS, so only the
// viewed region downloads despite the file's size. hgdownload is also the
// slowest host any of these figures touch, hence the raised ready timeouts.

// The transcript body alone, for the figure that reads the signal against the
// exons. Collapsed to one transcript, TP53's drawn 5' end is whichever of the
// five transcripts tying at a 1182 bp CDS the collapse picks (this one stops at
// 7,677,451), so the full locus above leaves the right half of the frame with
// signal and no gene under it, nothing to line the peaks up against.
const TP53_TRANSCRIPT_WINDOW = 'chr17:7,668,400-7,677,600'

// A whole coding exon of TP53 (the DNA-binding domain), from
// api.genome.ucsc.edu's ncbiRefSeqCurated exon bounds rather than eyeballed off
// the figure above. 110 bp is inside the zoom where the sequence track draws
// letters and its translation rows, which is what the last figure checks the
// per-base scores against.
const TP53_EXON_WINDOW = 'chr17:7,674,180-7,674,290'

// The whole gene plus its promoter, which is the window the regulation figure
// takes. TP53 is on the minus strand, so its TSS is the HIGH coordinate
// (chr17:7,687,490) and that figure's subject sits at the right-hand edge of the
// frame rather than the left.
//
// 28 kb, where this was 6 kb of promoter: at 6 kb every lane was high across the
// whole frame, so the picture was a wall of signal with nothing to compare it
// to. The gene body is the comparison -- the marks rise at one end of a gene
// they are otherwise flat over, and the cCRE and EPDnew calls land where they
// rise rather than everywhere.
//
// It reaches into WRAP53, which shares this promoter with TP53 head to head --
// the two genes' first exons are ~1 kb apart and point away from each other, so
// the peak the frame is about belongs to both.
const TP53_LOCUS_WINDOW = 'chr17:7,666,000-7,694,000'

// The axolotl RefSeq assembly's GenArk hub config, resolved from the accession
// the way the site does it (see jb2hubs' genarkConfigPath: the digits shard the
// path). GCF_040938575.1 rather than the GCA_ of the same assembly, because the
// RefSeq half is the one carrying gene tracks and a name index -- which is the
// difference the page's last section is about, and why this figure can navigate
// by gene symbol at all.
const AXOLOTL_CONFIG = encodeURIComponent(
  'https://jbrowse.org/hubs/genark/GCF/040/938/575/GCF_040938575.1/config.json',
)
const AXOLOTL_ASSEMBLY = 'GCF_040938575.1'

// This figure opens NO track of its own, and the two it used to open are worth
// naming because both are traps on a page whose whole claim is that a track is a
// checkbox away. A display setting in a spec here asserts that a reader clicking
// along arrives at this picture, and neither of the two settings these tracks
// want is reachable by clicking on the live site:
//
// - GC Percent wants UCSC's own trackDb parameters for gc5Base,
//   `windowingFunction Mean` and `viewLimits 30:70`. That is a legible curve
//   where the wiggle default (whiskers, autoscaled) is a solid block: the file
//   is 5-base bins, so every summary bin in a several-hundred-kb window spans a
//   min near 0 and a max near 100. Both values ride in the hub config's
//   `metadata.ucsc` and nothing translates them into `summaryScoreMode` /
//   `minScore` / `maxScore`, so a reader gets there through two track-menu trips
//   or not at all.
// - RepeatMasker wants one lane per repeat class.
//   `LinearMultiRowFeatureDisplay` has no menu item for `partitionField` and
//   defaults it to `name`, which on a GenArk bigRmskBed is one row per repeat --
//   thousands of hairlines, rendered rather than reasoned about. jb2hubs ALREADY
//   writes the right display (hubtools' repeatClassDisplay, jexl partition,
//   cookbook colours, fixed row order); it is gated behind RMSK_MULTIROW_DISPLAY
//   because the display type landed after v4.3.0, which is what
//   jbrowse.org/code/jb2/latest serves and so what the live site runs. That
//   repo's CLAUDE.md has the part that is easy to get wrong: a release opens the
//   gate for /ucsc/* and NOT for GenArk, whose config.json is a permanent-url
//   production file pinned v4 hosts and Desktop still read.
//
// So the closing frame is the gene track the SEARCH opened and nothing else,
// which is also all its section is about. When the gate opens, the by-class
// display arrives in the track's own `displays[]` and a checkbox is once again
// the whole story -- that is when a repeat lane comes back here, not before.

// The gene track the site itself opens with (its defaultSession shows
// `hg38-ncbiRefSeq`, RefSeq All), and nothing else: no height, no glyph mode, no
// display settings at all. The landing frame of the search figure is this, since
// a page called "basic usage" has to open on the view a reader lands in; every
// frame at a locus collapses it, which is one click on the chip in the track.
const GENE_TRACK = { trackId: 'hg38-ncbiRefSeq' }
const PHYLOP_TRACK = { trackId: 'hg38-phyloP100way' }

// By trackId rather than by name: the page's prose names this track, and a
// trackId that stops resolving fails the capture where a stale name would
// quietly render an empty one.
//
// EXOMES rather than genomes: coding sequence is what the comparison is about,
// and the exome callset is both denser there and a fraction of the bytes.
const GNOMAD_TRACK_ID = 'hg38-gnomadExomesVariantsV4_1'

// Common enough to be standing in the population, at 0.1%. `AF` is a string
// column in the file's autoSql, and no cast is needed: jexl's `>=` is JS's, so
// "0.00025" >= 0.001 coerces and is false. A unary `+` does not parse in jexl,
// which is the tempting way to write the cast that isn't needed.
const GNOMAD_COMMON_FILTER = 'jexl:feature.AF >= 0.001'

// No colour callback belongs in this figure: neither half of one is reachable
// by clicking. "Color by... → Attribute..." writes
// `jexl:randomColor(get(feature,'attr'))` (featureColors.ts), which is
// hash-derived colours and no key, and `legend` is a config slot with no menu
// item. The frames draw in the track's own itemRgb, which is gnomAD's
// consequence colouring.

// Histone marks over the ENCODE3 seven-cell-line panel (GM12878, H1-hESC,
// HSMM, HUVEC, K562, NHEK, NHLF), one row per cell line.
//
// NOT the ENCODE4 organ averages the hub also carries, which are the tracks
// UCSC calls "Layered": at 55 and 64 sources their `multixyplot` default is one
// muddy silhouette where no source is separable, and `multirowdensity` is no
// better, because each source carries its own colour and 60 hues at two pixels
// a row is a pastel blur. Seven rows is the count at which a per-row plot is
// legible and the legend can name every row.
//
// The pair is chosen rather than doubled: H3K4me3 marks promoters, H3K27ac
// marks the active ones, so a promoter with both is doing something in that
// cell type and one with only H3K4me3 is poised.
//
// `defaultRendering` is a config slot, so an inline key on the spec's tracks
// entry reaches it; it is also the track menu's "Plot type" radio.
const H3K4ME3_ROWS = {
  trackId: 'hg38-wgEncodeRegMarkH3k4me3',
  defaultRendering: 'multirowxy',
}
const H3K27AC_ROWS = {
  trackId: 'hg38-wgEncodeRegMarkH3k27ac',
  defaultRendering: 'multirowxy',
}

// The menu path `multirowxy` is behind, spelled once so the hovers, the callout
// boxes and the prose cannot name it three ways. Written out rather than
// imported from renderingTypes.ts: check-menu-labels resolves each segment
// against the app's own literals, which is the check that would catch a rename,
// and an import would make it vacuous.
const PLOT_TYPE_PATH = ['Plot type', 'Multi-row', 'XY plot']

// gnomAD's own consequence class for the variant: pLoF, missense, synonymous
// or other. pLoF is the high-impact end, 93 of the 4,695 records over TP53.
const GNOMAD_PLOF_FILTER = "jexl:feature.annot == 'pLoF'"

// One frame of the gnomAD figure: the same three tracks every time, with only
// the gnomAD entry's extra keys changing. Written as a builder so the three
// frames cannot drift in the two tracks the comparison is read against.
function gnomadFrame(gnomad: object = {}) {
  return sessionSpec(UCSC_HG38_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: TP53_TRANSCRIPT_WINDOW,
        tracks: [
          { ...GENE_TRACK_COLLAPSED, height: 60 },
          { ...PHYLOP_TRACK, height: 90 },
          { trackId: GNOMAD_TRACK_ID, height: 130, ...gnomad },
        ],
      },
    ],
  })
}

// The expression a frame of that figure was drawn under, as a pill under the
// gnomAD track. Anchored to the track's own band at `fracY: 1`, so it sits in
// the strip below the last row however tall the track is set and whatever the
// filter leaves painted.
function filterCallout(text: string): Annotation {
  return {
    type: 'text',
    text,
    fontSize: 18,
    anchor: {
      track: GNOMAD_TRACK_ID,
      fracY: 1,
      alignX: 'left',
    },
    textAlign: 'start',
    dx: 34,
    dy: 30,
  }
}

// Collapsed to the longest coding transcript, which the page reaches through the
// isoform control at the bottom right of the gene track: one click, on a chip
// that is in the frame. Every figure at a locus takes it. At base zoom the
// default is one codon row printed 28 times, and at gene zoom it is 28 rows in
// a 100px band with most of them behind the track's own scrollbar.
const GENE_TRACK_COLLAPSED = {
  ...GENE_TRACK,
  geneGlyphMode: 'longestCoding',
}

// The whole config with no session at all, which is how a reader arrives: the
// site's link goes to a bare `?config=`, so the app builds the hub's own
// defaultSession -- chr7:155,799,529-155,812,871 (SHH), RefSeq All, and the track
// selector already open. The two figures that walk the click path start there
// rather than at a locus of their own, so the first frame is the frame a reader
// is looking at when they read the paragraph.
//
// `sessionName` is what every other figure gets for free from `sessionSpec`, and
// a bare `?config=` needs it spelled out: BaseRootModel names a session built
// from a defaultSession `<name> <new Date().toLocaleString()>`, so without it the
// app bar carries the wall-clock time of the capture. That is a figure whose
// pixels change on every regen and which tells a reader the docs were shot on a
// particular evening.
const LANDING = `?config=${UCSC_HG38_CONFIG}&sessionName=Screenshot`

// genomes.jbrowse.org itself, which is the first thing the page walks through
// and the only figure here that is not a JBrowse app capture. Its pages are
// plain Astro, so every readiness wait the generator runs (view phases, display
// phases, the loading overlay) is trivially satisfied and the capture is gated
// on `readyText` plus its own settle.
//
// Captured LIVE rather than against a local build of that site: the point of
// these frames is what a reader sees when they follow the link in the paragraph
// beside them, and the site is built from a different repo (~/src/jb2hubs) on
// its own cadence. A stale-looking front page in a figure is a real regression
// worth the sweep catching.
const SITE = 'https://genomes.jbrowse.org'

export const genomesBasicsSpecs: ScreenshotSpec[] = [
  // The front page: the handful of genomes most people want, and the head of the
  // GenArk half underneath. 1100 wide, not the 1500 default, because the site
  // lays its content out in a fixed column and a wider capture is white space
  // down the right-hand third; 720 tall because the next thing down the page is
  // the species-category table, and any height that includes part of it cuts a
  // row in half.
  {
    mode: 'url',
    name: 'genomes_basics/site_home',
    url: SITE,
    readyText: 'GenArk',
    viewportWidth: 1100,
    viewportHeight: 720,
    settleMs: 3000,
    liveLabel: 'Open genomes.jbrowse.org',
    diffThreshold: 0.02,
  },

  // The header typeahead, which is the third way in and the one that spans both
  // catalogs at once. Its index is several MB and is not fetched until the box
  // takes focus, so the wait is on an option appearing rather than on a delay.
  {
    mode: 'url',
    name: 'genomes_basics/site_search',
    url: SITE,
    readyText: 'GenArk',
    viewportWidth: 1100,
    viewportHeight: 620,
    settleMs: 2000,
    liveLabel: 'Open genomes.jbrowse.org',
    diffThreshold: 0.02,
    actions: [
      {
        type: 'type',
        selector: '#header-search-input',
        value: 'human',
      },
      {
        type: 'waitForSelector',
        selector: '#header-search-listbox a',
        timeout: 60000,
      },
      { type: 'delay', ms: 1000 },
    ],
  },

  // /ucsc, the full UCSC database list, which is what the front page's short
  // table is a selection from.
  {
    mode: 'url',
    name: 'genomes_basics/site_ucsc_list',
    url: `${SITE}/ucsc`,
    readyText: 'hg38',
    viewportHeight: 1000,
    settleMs: 3000,
    liveLabel: 'Open the UCSC genome list',
    diffThreshold: 0.02,
  },

  // Landing, then the locus: the view a reader arrives in -- SHH, RefSeq All, the
  // track selector already open, all of it the hub's own defaultSession -- with
  // the gene symbol typed into the location box and the name index answering it.
  //
  // The second frame DECLARES the destination rather than pressing Enter on the
  // first. Pressing it is honest and was tried: the hit that answers `TP53` comes
  // out of the RefSeq All (GFF) index, so the app opens that track to show it,
  // and the frame is then two gene tracks with a highlighted "biological region"
  // bar across the second -- a second annotation set the page never mentions
  // again, since every figure below works from RefSeq All alone. The declared
  // session is that same locus with that same track.
  //
  // It also COLLAPSES the stack to the longest coding transcript, which is one
  // click on the chip the frame already shows. Two other states have been in
  // this frame and each was denied: the default `fixed` sizing laid 28
  // transcripts inside a 100px band, so three rows were in shot, each cut off
  // from the name drawn under it and the rest behind the track's own scrollbar
  // -- a picture of a track that does not fit rather than of a search that
  // worked. `heightMode: 'grow'` fixed that by showing all 28, which is a
  // three-level menu path to reach and 28 isoforms to read (reviewer: "requires
  // multiple steps ... looks chaotic having so many isoforms"). The collapse is
  // the control on the track itself, and it leaves one transcript with the gene
  // name under it.
  {
    mode: 'url',
    name: 'genomes_basics/search_tp53',
    url: LANDING,
    readyText: 'NCBI RefSeq',
    readyTimeout: 120000,
    settleMs: 8000,
    viewportHeight: 440,
    diffThreshold: 0.02,
    stages: [
      {
        viewportHeight: 340,
        actions: [
          {
            type: 'type',
            selector: 'input[placeholder="Search for location"]',
            value: 'TP53',
            clear: true,
          },
          { type: 'waitForText', text: 'TP53' },
          { type: 'delay', ms: 1200 },
        ],
      },
      {
        url: sessionSpec(UCSC_HG38_CONFIG, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'hg38',
              loc: TP53_TRANSCRIPT_WINDOW,
              tracks: [GENE_TRACK_COLLAPSED],
            },
          ],
        }),
        // one transcript row, its label and the isoform chip under it; sized off
        // the run's own report rather than off the PNG
        viewportHeight: 340,
        actions: [PARK_CURSOR],
      },
    ],
  },

  // The result of the two clicks the section describes, declared as a session
  // rather than clicked together: the figure the tutorial reads, and the one the
  // gallery card is cut from.
  //
  // There is no figure of the drawer itself. One existed twice -- the filter box
  // narrowed to `phyloP` beside the same drawer with the checkbox ticked -- and
  // was cut both times: a filter box with a word typed in it and a ticked
  // checkbox are what the sentence beside it already says, so the frames carried
  // the app's chrome and no result.
  {
    mode: 'url',
    name: 'genomes_basics/phylop_tp53',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_TRANSCRIPT_WINDOW,
          // gene track first, phyloP second: a track opened from the selector
          // is appended below what is already there, so this is the order the
          // click-path above ends in rather than a tidier one
          //
          // Collapsed, following the search figure above. Left at RefSeq All's
          // default this lane was 28 transcripts inside a 100px band, most of
          // them behind its own scrollbar, and the exon structure the peaks are
          // read against was the thing that got scrolled away.
          tracks: [GENE_TRACK_COLLAPSED, PHYLOP_TRACK],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 120000,
    settleMs: 8000,
    viewportHeight: 460,
    diffThreshold: 0.02,
  },

  // The isoform control, which the next figure's session sets declaratively and
  // a reader reaches by clicking. Its two looks are one setting apart: while
  // transcripts are collapsed it is the loud "Longest isoform" chip, and it
  // shrinks to a quiet icon once dismissed. So the session sets the collapsed
  // mode and the capture clicks the chip, which opens the same three options the
  // track menu's "Gene glyph" radio offers, with the current one checked.
  //
  // `auto` would NOT do: it resolves to `all` below 100 bp/px, so at this zoom
  // there is no chip to click and nothing on screen says transcripts could be
  // collapsed at all.
  //
  // A small frame on purpose -- everything a wider one would add is the figure
  // above it, already on the page.
  {
    mode: 'url',
    name: 'genomes_basics/isoform_control',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_EXON_WINDOW,
          tracks: [GENE_TRACK_COLLAPSED],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 120000,
    settleMs: 8000,
    viewportWidth: 900,
    // 380 rather than the 340 the content needs: the ring below is drawn round
    // a wide short pill, so its radius comes off that pill's diagonal and it
    // reaches further below the chip than the chip does.
    viewportHeight: 380,
    diffThreshold: 0.02,
    actions: [
      { type: 'click', text: 'Longest isoform' },
      { type: 'waitForText', text: 'Longest coding transcript' },
      { type: 'delay', ms: 800 },
    ],
    // A ring on the chip that opened the popover. The popover is a MUI menu, so
    // it is placed wherever it fits rather than under what it came from, and
    // this frame is the one case on the page where the control and its menu are
    // at opposite corners: without the ring nothing says which of the two
    // bottom-right controls was clicked. Anchored to the chip's own text, so it
    // follows the chip when the layout moves.
    annotations: [{ type: 'circle', anchor: { text: 'Longest isoform' } }],
  },

  // The alignment the score was computed from, at the same exon. Both tracks are
  // the 470-way rather than the 100-way the page opens with, because UCSC
  // publishes no bigMaf for multiz100way -- pairing a 100-way score with a
  // 470-way alignment would be a picture of two different analyses.
  //
  // Only reachable at this zoom, and that is a property of the file rather than
  // a choice: LinearMafDisplay byte-gates on the bigMaf's own R-tree estimate,
  // which over TP53 is 0.06MB at 110bp, 0.54MB at 1kb and 4.76MB at 9.2kb
  // against the 1MB fetchSizeLimit the display inherits. So this window loads
  // and a gene-wide one is a force-load prompt (measured 2026-08-08). The third
  // hg38 bigMaf, cactus241way, is flat at 15MB for every window and therefore
  // opens at no zoom at all; it is dropped in jb2hubs rather than shown here.
  {
    mode: 'url',
    name: 'genomes_basics/multiz_alignment',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_EXON_WINDOW,
          tracks: [
            GENE_TRACK_COLLAPSED,
            { trackId: 'hg38-phyloP470wayBW' },
            { trackId: 'hg38-multiz470way' },
          ],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 120000,
    settleMs: 8000,
    viewportHeight: 1080,
    diffThreshold: 0.02,
  },

  // ── The rest of the catalog, at the same gene ────────────────────────────
  //
  // Everything below is the same two clicks as phyloP, on tracks that are not
  // conservation. They stay at TP53 on purpose: the page is one locus stepped
  // through, so a track earns its figure by showing something about this gene
  // rather than by being a nice picture of somewhere else.

  // The regulation category over the whole gene, as one figure of two frames.
  //
  // It was two figures: a plot-type pair carrying the two histone tracks alone,
  // and a promoter frame carrying those same two tracks plus three more. Read
  // one after the other they were the same picture twice, the second one taller
  // -- so this is the tracks the section names, in both frames, with only the
  // setting between them.
  //
  // Side by side (`stageColumns`), because the frames are a before and an after
  // of one radio button and a reader compares them across rather than down.
  //
  // Frame 1 is how the hub ships both marks: MultiQuantitativeTracks defaulting
  // to `multixyplot`, all seven cell lines drawn over one another, under the
  // menu that separates them. Frame 2 is the same six tracks with
  // `multirowxy` on both marks.
  //
  // "XY plot" is the label under BOTH layout groups (renderingTypes.ts), which
  // is only safe to click by text because one submenu is open at a time -- the
  // Overlapping group is not in the DOM until it is hovered. `menuCascade`
  // hovers each level in turn, so the path cannot skip one.
  //
  // Frame 2 loads a session rather than clicking "XY plot": the click would
  // change ONE track, and a frame with one mark separated and one still
  // overlapping reads as a bug rather than a result.
  //
  // EPDnew's promoter calls close the stack, not the JASPAR TFBS track that was
  // there first: JASPAR draws every motif match above its score cutoff, which at
  // any width is a solid orange field with no shape to read. A promoter
  // annotation is one box, in the place the tracks above have just been arguing
  // for.
  {
    mode: 'url',
    name: 'genomes_basics/promoter_regulation',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_LOCUS_WINDOW,
          tracks: [
            { ...GENE_TRACK_COLLAPSED, height: 60 },
            { trackId: 'hg38-cpgIslandExt', height: 50 },
            { trackId: 'hg38-cCREregistry', height: 60 },
            { trackId: H3K4ME3_ROWS.trackId, height: 150 },
            { trackId: H3K27AC_ROWS.trackId, height: 150 },
            { trackId: 'hg38-epdNewPromoter', height: 60 },
          ],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 180000,
    settleMs: 10000,
    viewportWidth: 1000,
    viewportHeight: 940,
    stageColumns: 2,
    diffThreshold: 0.02,
    hideTooltip: true,
    stages: [
      {
        actions: [
          trackMenuIcon(H3K4ME3_ROWS.trackId),
          ...menuCascade(PLOT_TYPE_PATH),
        ],
        annotations: cascadeBoxes(PLOT_TYPE_PATH),
      },
      {
        url: sessionSpec(UCSC_HG38_CONFIG, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'hg38',
              loc: TP53_LOCUS_WINDOW,
              tracks: [
                { ...GENE_TRACK_COLLAPSED, height: 60 },
                { trackId: 'hg38-cpgIslandExt', height: 50 },
                { trackId: 'hg38-cCREregistry', height: 60 },
                { ...H3K4ME3_ROWS, height: 150 },
                { ...H3K27AC_ROWS, height: 150 },
                { trackId: 'hg38-epdNewPromoter', height: 60 },
              ],
            },
          ],
        }),
        actions: [PARK_CURSOR],
      },
    ],
  },

  // Where the three frames below come from. Those frames arrive already
  // filtered, out of `jexlFiltersSetting`, so the app never draws the dialog
  // the prose tells a reader to type into.
  //
  // Same two-frame shape as `about_track`: the menu item is the question and
  // the dialog is the answer. Stacked rather than side by side, because the
  // dialog's content is a fixed 80em (JexlFilterDialog).
  //
  // The track is alone in the view so the menu has the frame to open into, and
  // it is UNFILTERED -- with a filter in effect `filterMenuItems` relabels the
  // row "Filter by... (1)" and turns it into a submenu, which is a different
  // click path from the one the reader is being shown.
  //
  // The pLoF expression rather than the AF one, so the typed text lines up with
  // the bottom frame of the figure below it, which is the one whose filter has
  // no visible-in-the-picture analogue (a frequency cut looks like fewer
  // variants; a consequence class does not look like anything).
  {
    mode: 'url',
    name: 'genomes_basics/gnomad_filter_menu',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_TRANSCRIPT_WINDOW,
          tracks: [{ trackId: GNOMAD_TRACK_ID, height: 200 }],
        },
      ],
    }),
    readyText: 'gnomAD',
    readyTimeout: 180000,
    settleMs: 10000,
    viewportHeight: 640,
    diffThreshold: 0.02,
    // the menu is driven by clicking, which leaves the track's own hover
    // tooltip standing over the frame the menu is the subject of
    hideTooltip: true,
    stages: [
      {
        actions: [
          trackMenuIcon(GNOMAD_TRACK_ID),
          { type: 'waitForText', text: 'Filter by...' },
        ],
        // boxed: the menu is long and every row in it is a plausible next click
        annotations: cascadeBoxes(['Filter by...']),
        // the menu, not the empty page under it -- the track it opens from
        // scrolls its own rows, so nothing below the view's fold is content
        viewportHeight: 560,
      },
      {
        actions: [
          { type: 'click', text: 'Filter by...' },
          { type: 'waitForText', text: 'Add track filters' },
          // The visible textarea, not the autosize shadow MUI renders beside
          // it. Typed from column one, because the dialog opens EMPTY on a
          // track that declares no filters of its own -- which is what this
          // one does.
          //
          // It used to be typed onto a new line, and that was not a style
          // choice: `BaseLinearDisplay`'s `jexlFilters` slot shipped the NCBI
          // gbkey=Src cut as its default, `activeFilters()` seeded every
          // feature track's dialog with it, and a bare type ran on to the end
          // of that line into a parse error. The rule moved to
          // `hideSourceFeatures` (a gate in buildFeatureAdmission, never in
          // this dialog), so the leading newline now buys a blank first line
          // and a picture of a list with a hole in it.
          {
            type: 'type',
            selector: '.MuiDialog-container textarea:not([aria-hidden="true"])',
            value: GNOMAD_PLOF_FILTER,
          },
          { type: 'delay', ms: 500 },
        ],
        // back to the spec's own height, which the shorter first frame would
        // otherwise carry into this one -- the dialog is the taller of the two
        // and clears its bottom edge by a line
        viewportHeight: 640,
      },
    ],
  },

  // The population reading, at the transcript rather than the exon. Three
  // frames of one window, each a filter the reader types into "Filter by...",
  // and the track gets sparser and more specific down the stack.
  //
  // Measured 2026-08-13 over this window against exomes.bb, with NM_000546.6's
  // coding exons from api.genome.ucsc.edu:
  //
  //   coding bases                1,182 of 9,200 in the window   (12.8%)
  //   gnomAD, any AF              3,045 records, 685 coding      (22.5%)
  //   gnomAD, AF >= 0.001            71 records,   3 coding       (4.2%)
  //   gnomAD, annot == pLoF          93 records
  //
  // So the raw callset is enriched on coding sequence because that is what an
  // exome captures, and the common half of it is depleted there about
  // three-fold against the base composition of the window. None of those
  // numbers is in the prose; the frames carry it.
  //
  // Frame 3 is the other axis a reader would filter on: `annot` is gnomAD's own
  // consequence class, and pLoF is the high-impact end of it. 93 records, all
  // in coding sequence by construction, and nearly all of them singletons --
  // the opposite population to frame 2, from the same file.
  //
  // Every frame draws in the track's own itemRgb, which is gnomAD's consequence
  // colouring (pLoF red, missense yellow, synonymous green, other grey), so the
  // pLoF frame comes out red without anything being set to make it. The note
  // over GNOMAD_COMMON_FILTER has why no colour callback belongs here.
  //
  // ClinVar is deliberately NOT in this figure. It was, and three dense variant
  // tracks over one gene read as noise; the exon figure above is where ClinVar
  // is legible.
  //
  // Each frame carries the expression that made it, as a callout on the track
  // it was typed into. Three frames of one window differing only in which
  // records survive is exactly the figure a caption cannot index: "top, middle,
  // bottom" is a mapping the reader has to hold, and the filter is the one thing
  // in the frame that is not drawn anywhere. Under the track rather than over
  // it, since the whole point of each frame is what is left painted.
  //
  // `jexlFiltersSetting` is the model prop the "Filter by..." dialog writes.
  {
    mode: 'url',
    name: 'genomes_basics/gnomad_filters',
    url: gnomadFrame(),
    readyText: 'TP53',
    readyTimeout: 180000,
    settleMs: 10000,
    viewportHeight: 600,
    diffThreshold: 0.02,
    stages: [
      { actions: [PARK_CURSOR], annotations: [filterCallout('no filter')] },
      {
        url: gnomadFrame({ jexlFiltersSetting: [GNOMAD_COMMON_FILTER] }),
        actions: [PARK_CURSOR],
        annotations: [filterCallout(GNOMAD_COMMON_FILTER)],
      },
      {
        url: gnomadFrame({ jexlFiltersSetting: [GNOMAD_PLOF_FILTER] }),
        actions: [PARK_CURSOR],
        annotations: [filterCallout(GNOMAD_PLOF_FILTER)],
      },
    ],
  },
  // "About track" on the phyloP track, for the section about what a checkbox
  // actually downloads: the dialog prints the adapter, so the hgdownload URL the
  // config points at is on screen rather than asserted in a paragraph.
  //
  // Two frames side by side rather than the dialog alone, because the dialog is
  // the answer and the menu item is the question: a reader who has never opened
  // that menu cannot get to the second frame from the first. Side by side rather
  // than stacked because the difference between the frames is one click, which a
  // reader compares across rather than down.
  {
    mode: 'url',
    name: 'genomes_basics/about_track',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_TRANSCRIPT_WINDOW,
          // taller than the track needs to be read, because the two frames are
          // one grid: the dialog fills its own panel and a default-height track
          // leaves the menu panel two thirds empty page beside it
          tracks: [{ ...PHYLOP_TRACK, height: 400 }],
        },
      ],
    }),
    readyText: 'phyloP',
    readyTimeout: 120000,
    settleMs: 8000,
    viewportWidth: 1000,
    viewportHeight: 700,
    stageColumns: 2,
    diffThreshold: 0.02,
    stages: [
      {
        actions: [
          trackMenuIcon('hg38-phyloP100way'),
          { type: 'waitForText', text: 'About track' },
          { type: 'delay', ms: 800 },
        ],
        // Both ends of the click: the kebab that opened the menu and the row
        // inside it. The menu is placed where it fits rather than under what
        // opened it, so neither one implies the other, and the kebab is the
        // smallest control on the track header.
        annotations: [
          {
            type: 'circle',
            anchor: {
              selector:
                '[data-testid="track_menu_icon"][data-trackid="hg38-phyloP100way"]',
            },
          },
          ...cascadeBoxes(['About track']),
        ],
      },
      {
        actions: [
          { type: 'click', text: 'About track' },
          { type: 'waitForText', text: 'bigWigLocation' },
          { type: 'delay', ms: 1200 },
        ],
      },
    ],
  },

  // A GenArk assembly, to close the page where it started: same app, same
  // checkbox, a smaller catalog. Same gene, too -- `loc` is the bare symbol
  // rather than a coordinate, so the frame is also the proof that the
  // accession's own name index answered it.
  //
  // No `tracks` at all, which is the point rather than an omission: the search
  // opens the track whose index answered -- RefSeq All (GFF) -- and highlights
  // the hit in it, so this frame is what typing a gene symbol gets you and
  // nothing else. See the note over AXOLOTL_CONFIG for the two tracks that used
  // to be here and why neither is a click.
  {
    mode: 'url',
    name: 'genomes_basics/genark_axolotl',
    url: sessionSpec(AXOLOTL_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: AXOLOTL_ASSEMBLY,
          loc: 'tp53',
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 180000,
    settleMs: 10000,
    viewportHeight: 335,
    diffThreshold: 0.02,
  },
]
