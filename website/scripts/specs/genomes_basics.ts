import { heightModeLabel } from '../../../plugins/linear-genome-view/src/BaseLinearDisplay/models/heightMode.ts'
import {
  PARK_CURSOR,
  UCSC_HG38_CONFIG,
  displayReady,
  openTrackSelector,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

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

// The promoter end of the gene. TP53 is on the minus strand, so its TSS is the
// HIGH coordinate (chr17:7,687,490) and the regulatory figure's subject sits at
// the right-hand edge of the frame rather than the left. 6 kb keeps the
// neighbouring distal cCREs in shot for contrast with the promoter one.
const TP53_PROMOTER_WINDOW = 'chr17:7,685,000-7,691,000'

// The TSS itself, bracketed: the window the motif-density pair is read at. A
// third of the promoter window above, which is what puts the filtered motifs far
// enough apart to be separate boxes.
const TP53_TSS_WINDOW = 'chr17:7,686,500-7,688,500'

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

// The gene track the site itself opens with (its defaultSession shows
// `hg38-ncbiRefSeq`, RefSeq All), and nothing else: no height, no glyph mode, no
// display settings at all. A figure on a page called "basic usage" has to be the
// view a reader lands in, so RefSeq All draws its 28 TP53 transcripts here the
// way it draws them for everyone. The page collapses them where it needs to, as
// a step the reader takes, and shows the control that does it.
const GENE_TRACK = { trackId: 'hg38-ncbiRefSeq' }
const PHYLOP_TRACK = { trackId: 'hg38-phyloP100way' }

// UCSC's own label for the phyloP track, which is what the filter box matches
// and what the checkbox row reads. Written once so the click path and the
// caption cannot name it differently.
const PHYLOP_NAME =
  'Basewise Conservation (phyloP) - 100-way vertebrate alignment'

// The two tracks the density section is about, by id rather than by name: both
// are named in the page's prose, and a trackId that stops resolving fails the
// capture where a stale name would quietly render an empty track.
const GNOMAD_TRACK_ID = 'hg38-gnomadExomesVariantsV4_1'
const JASPAR_TRACK_ID = 'hg38-jaspar2026'

// UCSC's own default for the JASPAR track, transcribed from the `filter.score`
// setting jb2hubs copies into `metadata.ucsc` on the converted track. `score` is
// the BED column the file's autoSql names, so it reaches jexl under that name.
const JASPAR_SCORE_FILTER = "jexl:get(feature,'score') >= 400"

// The canvas display's feature-size menu, and the last row of the "Track sizing"
// group inside it. Read from `heightModeLabel` rather than transcribed, the way
// the alignments specs do it, so the wait text cannot drift from the menu.
const FEATURE_HEIGHT_MENU = 'Set feature height'
const FIT_FEATURE_LABEL = heightModeLabel('fit', 'feature')

// Collapsed to the longest coding transcript, which the page reaches through the
// isoform control at the bottom right of the gene track. Used by the base-zoom
// figure alone, because at that zoom the default is one codon row printed 28
// times and the residue labels are what the check is read against.
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
              tracks: [GENE_TRACK],
            },
          ],
        }),
        viewportHeight: 350,
        actions: [PARK_CURSOR],
      },
    ],
  },

  // The two clicks the page is named for, as the two frames they are: the track
  // selector filtered to `phyloP`, then the same drawer with the checkbox ticked
  // and the track drawn under the genes.
  //
  // Side by side (`stageColumns`), because stacked this is two copies of the same
  // drawer and a reader compares them across rather than down.
  //
  // An earlier version of this figure was deleted as "too boring and detailed"
  // and is back by request, with the red boxes gone: the filter text and the
  // ticked checkbox are the difference between the frames, and boxing them said
  // what the frames already showed.
  {
    mode: 'url',
    name: 'genomes_basics/turn_on_phylop',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_TRANSCRIPT_WINDOW,
          tracks: [GENE_TRACK],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 120000,
    settleMs: 8000,
    viewportWidth: 1000,
    viewportHeight: 450,
    stageColumns: 2,
    diffThreshold: 0.02,
    stages: [
      {
        actions: [
          ...openTrackSelector('button'),
          { type: 'type', text: 'Filter tracks', value: 'phyloP' },
          { type: 'waitForText', text: PHYLOP_NAME },
          { type: 'delay', ms: 800 },
        ],
      },
      {
        actions: [
          { type: 'click', text: PHYLOP_NAME },
          {
            type: 'waitForSelector',
            selector: displayReady('wiggle-display'),
            timeout: 120000,
          },
          { type: 'delay', ms: 2000 },
          PARK_CURSOR,
        ],
      },
    ],
  },

  // The result on its own, declared as a session rather than clicked together:
  // the figure the tutorial reads, and the one the gallery card is cut from.
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
          tracks: [GENE_TRACK, PHYLOP_TRACK],
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
    viewportHeight: 340,
    diffThreshold: 0.02,
    actions: [
      { type: 'click', text: 'Longest isoform' },
      { type: 'waitForText', text: 'Longest coding transcript' },
      { type: 'delay', ms: 800 },
    ],
  },

  // The check against the raw data: one coding exon at base zoom, where the
  // scores are visibly one bar per base and the sequence track underneath says
  // which base each one is on. A whole-gene view cannot tell a per-base score
  // from a smoothed band.
  {
    mode: 'url',
    name: 'genomes_basics/phylop_bases',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_EXON_WINDOW,
          // same appended order: genes, then phyloP, then the reference
          // sequence, which is off by default and is a third turn of the same
          // checkbox
          tracks: [
            GENE_TRACK_COLLAPSED,
            PHYLOP_TRACK,
            { trackId: 'hg38-refseq' },
          ],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 120000,
    settleMs: 8000,
    viewportHeight: 620,
    diffThreshold: 0.02,
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

  // The promoter, which is at the RIGHT-hand end of the frame because TP53 is on
  // the minus strand: the TSS is at chr17:7,687,490 and transcription runs
  // leftwards, so the CpG island, the promoter-class cCRE and the histone peak
  // all sit above the gene's last drawn base rather than its first.
  //
  // 6 kb: wide enough that the flanking distal cCREs are in frame to be told
  // apart from the promoter one, narrow enough that the JASPAR sites are still
  // separate boxes.
  //
  // Two layered ENCODE tracks rather than one, and both are
  // MultiQuantitativeTracks whose subtracks are organs: DNase says the chromatin
  // is open here, H3K27ac says it is an active promoter rather than merely an
  // accessible one, and the pair is the ordinary reason to open two signal
  // tracks instead of one.
  {
    mode: 'url',
    name: 'genomes_basics/promoter_regulation',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_PROMOTER_WINDOW,
          tracks: [
            { ...GENE_TRACK_COLLAPSED, height: 60 },
            { trackId: 'hg38-cpgIslandExt', height: 50 },
            { trackId: 'hg38-cCREregistry', height: 60 },
            // showLegend off on both layered tracks. Their subtracks are 64 and
            // 55 tissues, so the floating colour key can never fit the display
            // it floats over -- on screen it is a scrolled list, and in a still
            // it is a clipped one. The caption says the colours are tissues,
            // which is what the key would have said in the space available.
            {
              trackId: 'hg38-wgEncodeReg4Dnase',
              height: 110,
              showLegend: false,
            },
            {
              trackId: 'hg38-wgEncodeReg4MarkH3k27ac',
              height: 110,
              showLegend: false,
            },
            // EPDnew's promoter calls, not the JASPAR TFBS track that was here
            // first: JASPAR draws every motif match above its score cutoff, and
            // over 6 kb that is a solid orange field with no shape to read. A
            // promoter annotation is one box, in the place the tracks above have
            // just been arguing for.
            { trackId: 'hg38-epdNewPromoter', height: 60 },
          ],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 180000,
    settleMs: 10000,
    viewportHeight: 880,
    diffThreshold: 0.02,
  },

  // AlphaMissense over the same exon phyloP was read on, so the two figures are
  // the same 110 bases and can be compared row by row.
  //
  // The track is one MultiQuantitativeTrack whose four subtracks are the four
  // possible substituted bases, so a column is a position and a row is "what if
  // this base became an A/C/G/T". That is what makes it the pair to a
  // conservation track rather than a second copy of one: phyloP says a base does
  // not change, AlphaMissense says what would happen if it did, and the
  // third-codon-position dip appears in both for the same reason.
  {
    mode: 'url',
    name: 'genomes_basics/alphamissense_exon',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_EXON_WINDOW,
          tracks: [
            { ...GENE_TRACK_COLLAPSED, height: 70 },
            { trackId: 'hg38-alphaMissense', height: 220 },
            { ...PHYLOP_TRACK, height: 100 },
            { trackId: 'hg38-refseq', height: 120 },
          ],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 180000,
    settleMs: 10000,
    viewportHeight: 840,
    diffThreshold: 0.02,
  },

  // Clinical and population variation over the transcript: ClinVar's calls pile
  // up on the exons phyloP peaked over, and gnomAD's observed variants sit
  // beside them from a different kind of source.
  //
  // gnomAD v4.1 EXOMES rather than genomes: the coding exons are what the
  // comparison is about, and the exome callset is both denser there and a
  // fraction of the bytes.
  //
  // gnomAD Mut Constraint was here as a third track and is dropped: its scores
  // are 1 kb windows, so over a 9 kb view it is four blue blocks, and a reader
  // cannot tell a saturated score from a track that failed to load.
  {
    mode: 'url',
    name: 'genomes_basics/clinvar_gnomad',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_TRANSCRIPT_WINDOW,
          tracks: [
            { ...GENE_TRACK_COLLAPSED, height: 60 },
            { trackId: 'hg38-clinvarMain', height: 150 },
            { trackId: GNOMAD_TRACK_ID, height: 150 },
          ],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 180000,
    settleMs: 10000,
    viewportHeight: 660,
    diffThreshold: 0.02,
  },

  // What a click on one of those variants gives back: the feature details
  // widget, with ClinVar's own columns in it. The point of the figure is that
  // the columns are the file's, not JBrowse's -- a BigBed's extra fields arrive
  // as fields, so the significance and the review status are readable without
  // leaving the browser.
  //
  // The click is a locus anchor rather than a coordinate: the display is canvas,
  // so there is no element per variant, and `locusAnchor` resolves the point
  // from the live model instead of from a measurement that was true for one
  // window width.
  {
    mode: 'url',
    name: 'genomes_basics/variant_details',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_EXON_WINDOW,
          tracks: [
            { ...GENE_TRACK_COLLAPSED, height: 70 },
            { trackId: 'hg38-clinvarMain', height: 140 },
          ],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 180000,
    settleMs: 10000,
    viewportHeight: 700,
    diffThreshold: 0.02,
    // the click necessarily leaves the hover tooltip standing, over both the
    // feature it names and the panel that now says the same thing at length
    hideTooltip: true,
    actions: [
      {
        type: 'click',
        anchor: {
          locus: 'chr17:7,674,245',
          track: 'hg38-clinvarMain',
          fracY: 0.1,
        },
      },
      { type: 'waitForText', text: 'phenotypeList' },
      { type: 'delay', ms: 1500 },
    ],
  },

  // The HPRC pangenome callset as a genotype matrix: one row per haplotype of
  // the 232-sample minigraph-cactus graph, drawn at each variant's real
  // position, over the same transcript window as the ClinVar figure.
  //
  // LinearMultiSampleVariantDisplay rather than the track's default, which is
  // one allele-frequency band and says nothing about who carries what. Naming
  // the display type is a `type` on the view's tracks entry -- a config that a
  // reader reaches through the track menu's "Display types".
  //
  // The track's own companion, the allele inventory, is NOT here and was tried:
  // it carries only the graph's larger indels (59 of them across a megabyte of
  // chr17, none inside TP53's 24 kb), so at this locus it is an empty track
  // being correct.
  {
    mode: 'url',
    name: 'genomes_basics/hprc_pangenome',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_TRANSCRIPT_WINDOW,
          tracks: [
            { ...GENE_TRACK_COLLAPSED, height: 60 },
            {
              trackId: 'hg38-hprc-v2.0-pangenome-vcf',
              type: 'LinearMultiSampleVariantDisplay',
              height: 420,
            },
          ],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 180000,
    settleMs: 10000,
    viewportHeight: 730,
    diffThreshold: 0.02,
  },

  // ── More content than the track height shows ─────────────────────────────

  // The "Set feature height" menu, on the gnomAD track the figure above draws as
  // a clipped pile. Both radio groups are in one submenu and the figure's job is
  // "where do I click", the same job alignments/height_mode_fit does for reads --
  // and for the same reason a before/after was not built here: two 150px piles of
  // the same variants differing only in whether the overflow is behind a
  // scrollbar is nearly invisible at figure scale.
  //
  // The submenu opens by CLICK on its own testid rather than by hover: the row
  // is one of four in the track menu and a hover is timing-sensitive, which is
  // what `openFeatureHeightSubmenu` already does for the alignments menu.
  // `Super-compact` and the fit label are the last rows of each group, so
  // waiting on both is waiting for the whole submenu to have painted.
  {
    mode: 'url',
    name: 'genomes_basics/feature_height_menu',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_TRANSCRIPT_WINDOW,
          tracks: [
            { ...GENE_TRACK_COLLAPSED, height: 60 },
            { trackId: GNOMAD_TRACK_ID, height: 150 },
          ],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 180000,
    settleMs: 10000,
    viewportWidth: 1200,
    viewportHeight: 620,
    diffThreshold: 0.02,
    actions: [
      trackMenuIcon(GNOMAD_TRACK_ID),
      { type: 'waitForText', text: FEATURE_HEIGHT_MENU },
      {
        type: 'click',
        selector: '[data-testid^="cascading-submenu-set_feature_height"]',
      },
      { type: 'waitForText', text: 'Super-compact' },
      { type: 'waitForText', text: FIT_FEATURE_LABEL },
      { type: 'delay', ms: 800 },
    ],
  },

  // The other half of the same problem, on the track that has it worst: JASPAR
  // draws every motif match the file carries, and the file carries ~9,900 of them
  // across this 2 kb (measured 2026-08-13 off JASPAR2026.bb). UCSC's browser
  // draws 500 of those -- its trackDb ships `filter.score 400`, and jb2hubs
  // carries that setting through into `metadata.ucsc` on the converted track --
  // so the two frames are the same window with and without UCSC's own default.
  //
  // Both frames render without a force-load prompt, and that is the density gate
  // being OFF rather than satisfied: `AUTO_FORCE_LOAD_BP` leaves it undefined
  // below 20 kb of visible bp, on the reasoning that a small window is cheap.
  // So nothing intervenes here -- the track simply draws what it has, and the
  // saturated frame is the honest answer to "what does a reader get".
  //
  // `jexlFiltersSetting` (the model prop the "Filter by..." dialog writes), not
  // the `jexlFilters` config slot, because the frame is a reader having applied
  // the filter rather than a config having shipped one.
  //
  // 2 kb rather than the 6 kb promoter window above: at 6 kb even the filtered
  // population is ~1 feature/px and the second frame saturates too, which would
  // make the pair read as "the filter did nothing".
  {
    mode: 'url',
    name: 'genomes_basics/dense_filter',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_TSS_WINDOW,
          tracks: [
            { ...GENE_TRACK_COLLAPSED, height: 60 },
            { trackId: JASPAR_TRACK_ID, height: 240 },
          ],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 180000,
    settleMs: 10000,
    // 550: the 240px track plus the collapsed gene track plus the app chrome.
    // At 420 the run reported 125px of the JASPAR track below the fold, which
    // would have cut the frame the pair is read on.
    viewportHeight: 550,
    diffThreshold: 0.02,
    stages: [
      { actions: [PARK_CURSOR] },
      {
        url: sessionSpec(UCSC_HG38_CONFIG, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'hg38',
              loc: TP53_TSS_WINDOW,
              tracks: [
                { ...GENE_TRACK_COLLAPSED, height: 60 },
                {
                  trackId: JASPAR_TRACK_ID,
                  height: 240,
                  jexlFiltersSetting: [JASPAR_SCORE_FILTER],
                },
              ],
            },
          ],
        }),
        actions: [PARK_CURSOR],
      },
    ],
  },

  // "About track" on the phyloP track, for the section about what a checkbox
  // actually downloads: the dialog prints the adapter, so the hgdownload URL the
  // config points at is on screen rather than asserted in a paragraph.
  {
    mode: 'url',
    name: 'genomes_basics/about_track',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_TRANSCRIPT_WINDOW,
          tracks: [PHYLOP_TRACK],
        },
      ],
    }),
    readyText: 'phyloP',
    readyTimeout: 120000,
    settleMs: 8000,
    viewportWidth: 1000,
    viewportHeight: 700,
    diffThreshold: 0.02,
    actions: [
      trackMenuIcon('hg38-phyloP100way'),
      { type: 'waitForText', text: 'About track' },
      { type: 'click', text: 'About track' },
      { type: 'waitForText', text: 'bigWigLocation' },
      { type: 'delay', ms: 1200 },
    ],
  },

  // A GenArk assembly, to close the page where it started: same app, same two
  // clicks, a smaller catalog. Same gene, too -- `loc` is the bare symbol rather
  // than a coordinate, so the frame is also the proof that the accession's own
  // name index answered it.
  {
    mode: 'url',
    name: 'genomes_basics/genark_axolotl',
    url: sessionSpec(AXOLOTL_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: AXOLOTL_ASSEMBLY,
          loc: 'tp53',
          // No gene track listed. The search opens the one whose index answered
          // -- RefSeq All (GFF) -- and highlights the hit in it, so naming a
          // second gene track here would draw the same gene twice.
          tracks: [
            { trackId: `${AXOLOTL_ASSEMBLY}-gc5Base`, height: 90 },
            { trackId: `${AXOLOTL_ASSEMBLY}-repeatMasker`, height: 90 },
          ],
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 180000,
    settleMs: 10000,
    viewportHeight: 640,
    diffThreshold: 0.02,
  },
]
