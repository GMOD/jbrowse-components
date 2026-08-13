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

// CDKN1A (p21), the p53 target the last figures move to. On the PLUS strand,
// canonical TSS chr6:36,678,713 (NM_000389.5, from api.genome.ucsc.edu's
// ncbiRefSeqCurated rather than eyeballed) -- so upstream is leftwards here,
// the mirror of the TP53 promoter window above.
//
// 8 kb reaches from the far end of the upstream p53 matches to just past the
// TSS. It also brings PANDAR (36,673,620-36,675,126, minus) and DINOL
// (36,677,608-36,678,559, minus) into frame, which are p53-induced lncRNAs and
// come free with the same RefSeq track.
const CDKN1A_PROMOTER_WINDOW = 'chr6:36,673,000-36,681,000'

// The distal element, bracketed for the sequence figure. The JASPAR match is
// chr6:36,676,449-36,676,467, centred here. 110 bp, the same width as the TP53
// exon window above and for the same reason: at 200 the sequence track draws
// coloured blocks rather than letters, and the letters are the whole point.
const CDKN1A_DISTAL_ELEMENT_WINDOW = 'chr6:36,676,403-36,676,513'

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

// The two tracks the closing figure opens beside the gene, AS THE CHECKBOX
// LEAVES THEM. This page is the point-and-click one, so a display setting here
// is a claim that a reader clicking along gets this picture, and neither of the
// two settings worth making is reachable by clicking on the live site today:
//
// - GC Percent. UCSC's own trackDb for gc5Base asks for `windowingFunction
//   Mean` and `viewLimits 30:70`, which is a legible curve where the wiggle
//   default (whiskers, autoscaled) is a solid block: the file is 5-base bins,
//   so every summary bin in a several-hundred-kb window spans a min near 0 and
//   a max near 100. Both values ride in the hub config's `metadata.ucsc`, and
//   nothing translates them into `summaryScoreMode` / `minScore` / `maxScore`,
//   so a reader gets there through two track-menu trips (Score → Summary score
//   mode, then Score → Set min/max score) or not at all. jb2hubs is where that
//   belongs.
// - RepeatMasker by class. `LinearMultiRowFeatureDisplay` has no menu item for
//   `partitionField` and defaults it to `name`, which on a GenArk bigRmskBed is
//   one row per repeat -- thousands of hairlines, checked rather than reasoned
//   about. The class needs the jexl that cuts it off the name suffix, and
//   jb2hubs ALREADY writes exactly that display (hubtools' repeatClassDisplay,
//   with the colours and row order too). It is gated behind
//   RMSK_MULTIROW_DISPLAY because the display type landed after v4.3.0, which
//   is what jbrowse.org/code/jb2/latest still serves and therefore what the
//   live site runs. So today the lanes are not one click, they are none.
//
// When that gate drops, the by-class display arrives in the track's own
// `displays[]` and the figure gets it from the plain checkbox, with the same
// colours the cookbook uses. Add nothing here to bring it forward.
const AXOLOTL_GC_TRACK = {
  trackId: `${AXOLOTL_ASSEMBLY}-gc5Base`,
  height: 80,
}
const AXOLOTL_RMSK_ROWS = {
  trackId: `${AXOLOTL_ASSEMBLY}-repeatMasker`,
  height: 220,
}

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

// By trackId rather than by name: the page's prose names these, and a trackId
// that stops resolving fails the capture where a stale name would quietly render
// an empty track.
const JASPAR_TRACK_ID = 'hg38-jaspar2026'
const CLINVAR_TRACK_ID = 'hg38-clinvarMain'
// EXOMES rather than genomes: coding sequence is what the comparison is about,
// and the exome callset is both denser there and a fraction of the bytes.
const GNOMAD_TRACK_ID = 'hg38-gnomadExomesVariantsV4_1'

// Common enough to be standing in the population, at 0.1%. `AF` is a string
// column in the file's autoSql, and no cast is needed: jexl's `>=` is JS's, so
// "0.00025" >= 0.001 coerces and is false. A unary `+` does not parse in jexl,
// which is the tempting way to write the cast that isn't needed.
const GNOMAD_COMMON_FILTER = 'jexl:feature.AF >= 0.001'

// Which genetic ancestry group carries a variant at its highest frequency.
// `grpmax` is an in-line bigBed column, so this needs nothing but a colour
// callback -- the per-group table gnomAD's own browser draws lives in a sidecar
// file JBrowse does not read, and this is the part of it that ships in the
// track. Six groups occur (Finnish, Ashkenazi and Amish are excluded from
// grpmax by gnomAD), plus N/A where every group is zero.
//
// Okabe-Ito, which is colourblind-safe; the keys carry spaces, slashes and
// parens and jexl takes them quoted (checked against createJexlInstance).
const GNOMAD_ANCESTRY_COLORS: [string, string][] = [
  ['African/African American', '#E69F00'],
  ['Admixed American', '#56B4E9'],
  ['East Asian', '#009E73'],
  ['European (Non-Finnish)', '#0072B2'],
  ['Middle Eastern', '#D55E00'],
  ['South Asian', '#CC79A7'],
]
const GNOMAD_ANCESTRY_COLOR = `jexl:{${GNOMAD_ANCESTRY_COLORS.map(
  ([k, v]) => `'${k}':'${v}'`,
).join(',')}}[feature.grpmax] || '#999999'`
const GNOMAD_ANCESTRY_LEGEND = [
  ...GNOMAD_ANCESTRY_COLORS.map(([label, color]) => ({ label, color })),
  { label: 'No group above zero', color: '#999999' },
]

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

// ClinVar's own classification column. The three pathogenic classes spelled
// out rather than matched by prefix: jexl has no startsWith, and "Conflicting
// classifications of pathogenicity" contains the word without being a call.
const CLINVAR_PATHOGENIC_FILTER =
  "jexl:feature.clinSign == 'Pathogenic' || feature.clinSign == 'Likely pathogenic' || feature.clinSign == 'Pathogenic/Likely pathogenic'"

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

// One factor out of the whole JASPAR collection. `TFName` is a column of the
// file's own autoSql, so this is the expression a reader types into the track
// menu's "Filter by..." -- `jexlFiltersSetting` is the model prop that dialog
// writes, rather than the `jexlFilters` config slot a config would ship.
const JASPAR_TP53_FILTER = "jexl:get(feature,'TFName') == 'TP53'"

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
            { ...H3K4ME3_ROWS, height: 170 },
            { ...H3K27AC_ROWS, height: 170 },
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
    viewportHeight: 990,
    diffThreshold: 0.02,
  },

  // Four readings of one exon, on the same 110 bases the phyloP figure used:
  // AlphaMissense (predicted, from the protein), phyloP (measured, across
  // species), ClinVar (submitted, by diagnostic laboratories) and the reference
  // sequence with its translation. The point is that four methods with nothing
  // in common land on the same columns, so all four have to be in one frame.
  //
  // AlphaMissense is one MultiQuantitativeTrack whose four subtracks are the
  // four possible substituted bases, so a column is a position and a row is
  // "what if this base became an A/C/G/T".
  //
  // ClinVar over these 110 bp is 348 records, of which 151 are pathogenic or
  // likely pathogenic and 45 benign or likely benign (measured 2026-08-13 off
  // clinvarMain.bb). It is a wall at any height, and that IS the reading -- the
  // track is here for its colour and its density, not for its rows, so 150px
  // showing the top of the pile is the frame rather than a clipped one.
  {
    mode: 'url',
    name: 'genomes_basics/exon_four_ways',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_EXON_WINDOW,
          tracks: [
            { ...GENE_TRACK_COLLAPSED, height: 70 },
            { trackId: 'hg38-alphaMissense', height: 200 },
            { ...PHYLOP_TRACK, height: 90 },
            { trackId: CLINVAR_TRACK_ID, height: 150 },
            { trackId: 'hg38-refseq', height: 110 },
          ],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 180000,
    settleMs: 10000,
    // 990: at 900 the run cut 83px of the sequence track, which is one of the
    // four readings the frame is named for.
    viewportHeight: 990,
    diffThreshold: 0.02,
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
  // Frame 2 is coloured by `grpmax`, the ancestry group carrying the variant at
  // its highest frequency, so it is more than the same track with fewer rows.
  // All six groups occur here (19 African/African American, 15 East Asian, 14
  // European non-Finnish, 9 Admixed American, 7 South Asian, 7 Middle Eastern),
  // and the most skewed is chr17:7,674,638, 0.6% overall against 17% in
  // African/African American.
  //
  // Frame 3 is the other axis a reader would filter on: `annot` is gnomAD's own
  // consequence class, and pLoF is the high-impact end of it. 93 records, all
  // in coding sequence by construction, and nearly all of them singletons --
  // the opposite population to frame 2, from the same file.
  //
  // ClinVar is deliberately NOT in this figure. It was, and three dense variant
  // tracks over one gene read as noise; the exon figure above is where ClinVar
  // is legible.
  //
  // `jexlFiltersSetting` is the model prop the "Filter by..." dialog writes.
  {
    mode: 'url',
    name: 'genomes_basics/gnomad_filters',
    url: gnomadFrame(),
    readyText: 'TP53',
    readyTimeout: 180000,
    settleMs: 10000,
    viewportHeight: 560,
    diffThreshold: 0.02,
    stages: [
      { actions: [PARK_CURSOR] },
      {
        url: gnomadFrame({
          jexlFiltersSetting: [GNOMAD_COMMON_FILTER],
          color: GNOMAD_ANCESTRY_COLOR,
          legend: GNOMAD_ANCESTRY_LEGEND,
        }),
        actions: [PARK_CURSOR],
      },
      {
        url: gnomadFrame({ jexlFiltersSetting: [GNOMAD_PLOF_FILTER] }),
        actions: [PARK_CURSOR],
      },
    ],
  },

  // What a click gives back: the feature details widget, with ClinVar's own
  // columns in it. A BigBed's extra fields arrive as fields, so the
  // significance and the review status are readable without leaving the
  // browser.
  //
  // The ClinVar track behind it is filtered to the pathogenic classes, which
  // makes the backdrop one colour and one meaning rather than the eight-colour
  // significance mixture the unfiltered track draws. It is also the second
  // filter axis the page uses on a variant catalog: frequency for gnomAD,
  // clinical class here.
  //
  // The click is a locus anchor rather than a coordinate: the display is
  // canvas, so there is no element per variant, and `locusAnchor` resolves the
  // point from the live model instead of from a measurement that was true for
  // one window width.
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
            {
              trackId: CLINVAR_TRACK_ID,
              height: 140,
              jexlFiltersSetting: [CLINVAR_PATHOGENIC_FILTER],
            },
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
          track: CLINVAR_TRACK_ID,
          fracY: 0.1,
        },
      },
      { type: 'waitForText', text: 'phenotypeList' },
      { type: 'delay', ms: 1500 },
    ],
  },

  // ── What the protein the gene codes for does ───────────────────────

  // The one locus that is not TP53, and the reason to leave it: TP53 codes for a
  // transcription factor, so its binding sites are at the genes it regulates.
  // CDKN1A (p21) is the canonical one, and the picture there is made of three
  // tracks that have each already appeared on this page.
  //
  // JASPAR filtered to one factor, which is what makes the track a question
  // rather than a wall: the file holds 42,790 motif matches across this 8 kb and
  // 11 of them are TP53 (6 distinct positions, matched on both strands).
  // `TFName` is a column of the file's own autoSql, so the expression is the one
  // a reader types into "Filter by...".
  //
  // Measured 2026-08-13 against JASPAR2026.bb, encodeCcreRegistry.bb and the
  // ENCODE4 organ-average bigWigs (max over the first 12 organs), offsets from
  // NM_000389.5's TSS at chr6:36,678,713:
  //
  //   position         offset   cCRE class          DNase   H3K27ac   phyloP
  //   36,673,389-407   -5,324   TF                   0.08      0.91     0.08
  //   36,673,445-463   -5,268   TF                   0.08      0.91    -0.14
  //   36,674,740-758   -3,973   none                 0.12      1.12     3.18
  //   36,675,879-897   -2,834   none                 0.06      2.29    -0.23
  //   36,676,449-467   -2,264   Promoter             1.05     11.26     0.76
  //   36,677,331-349   -1,382   Proximal enhancer    0.78     12.66     2.01
  //
  // (DNase and H3K27ac are the max over the first 12 organs; over all 64 and 55
  // the ordering is the same and the gap is wider -- H3K27ac reaches 24.1 at the
  // distal element and 35.6 at the proximal one, against 1.5-6.8 at the other
  // four, and 33.8 over the TSS.)
  //
  // The last two are the response elements described for p21 (el-Deiry 1993,
  // ~-2.3 kb and ~-1.4 kb), and the four above them are the page's control:
  // same motif, same track, an order of magnitude less signal.
  //
  // Two things this figure deliberately does NOT claim, both checked first:
  //
  // - phyloP is in the table and not in the frame. It does not separate these
  //   sites: the most conserved of the six is the motif-only one at -3,973, and
  //   the distal element is at 0.76. A conservation lane here would contradict
  //   the caption.
  // - DNase does not peak ON the two elements. Its maxima in this window are the
  //   TSS and downstream (19.6 against 1.5 at the distal element), which is the
  //   ordinary promoter-vs-distal-element split and is what the caption says.
  //   H3K27ac is the lane that separates them, and it is drawn beside DNase
  //   rather than instead of it because the disagreement is the honest picture.
  {
    mode: 'url',
    name: 'genomes_basics/p53_target_cdkn1a',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: CDKN1A_PROMOTER_WINDOW,
          // The two elements the tracks below agree on, shaded because an 18 bp
          // site in an 8 kb view is three pixels wide: a highlight says WHERE,
          // which is the one thing this frame cannot show on its own. The four
          // that carry no regulatory signal are deliberately not shaded, so the
          // figure separates them the way the data does rather than by label.
          highlight: [
            {
              refName: 'chr6',
              start: 36676449,
              end: 36676467,
              assemblyName: 'hg38',
              label: 'distal p53 element',
            },
            {
              refName: 'chr6',
              start: 36677331,
              end: 36677349,
              assemblyName: 'hg38',
              label: 'proximal p53 element',
            },
          ],
          showHighlightChips: true,
          tracks: [
            // 100px: CDKN1A collapses to one row, and PANDAR and DINOL take one
            // each, so the lncRNAs the prose names are actually in the frame.
            { ...GENE_TRACK_COLLAPSED, height: 100 },
            {
              trackId: JASPAR_TRACK_ID,
              height: 70,
              jexlFiltersSetting: [JASPAR_TP53_FILTER],
            },
            { trackId: 'hg38-cCREregistry', height: 70 },
            // Both marks, as the promoter figure runs them, and the frame is
            // about whether they agree with the cCRE calls on which motif
            // matches matter.
            { ...H3K4ME3_ROWS, height: 170 },
            { ...H3K27AC_ROWS, height: 170 },
          ],
        },
      ],
    }),
    readyText: 'CDKN1A',
    readyTimeout: 180000,
    settleMs: 10000,
    diffThreshold: 0.02,
    // 960: the seven-row marks are 170px each and the run cut 103px at 840.
    viewportHeight: 960,
    actions: [PARK_CURSOR],
  },

  // The stronger element on the sequence. GAACATGTCCCAACATGTTG, which is the
  // p53 consensus RRRCWWGYYY twice over, and the JASPAR box spans exactly it.
  // 200 bp is inside the zoom where the sequence track draws letters.
  //
  // The cCRE stays in frame as the reason this match is the one that matters;
  // the gene track does not, since the nearest transcript starts 2 kb away and
  // the row would be empty.
  {
    mode: 'url',
    name: 'genomes_basics/p53_element_sequence',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: CDKN1A_DISTAL_ELEMENT_WINDOW,
          tracks: [
            {
              trackId: JASPAR_TRACK_ID,
              height: 70,
              jexlFiltersSetting: [JASPAR_TP53_FILTER],
            },
            { trackId: 'hg38-cCREregistry', height: 60 },
            // Both strands, no translation: this is 2 kb upstream of any coding
            // exon, so the three protein frames the sequence track draws by
            // default are three rows of noise here -- where on the TP53 exon
            // above they are the point. The reverse strand stays because the
            // motif is a palindrome and the match is called on both.
            {
              trackId: 'hg38-refseq',
              height: 80,
              showTranslation: false,
            },
          ],
        },
      ],
    }),
    readyText: 'chr6',
    readyTimeout: 180000,
    settleMs: 10000,
    diffThreshold: 0.02,
    viewportHeight: 480,
    actions: [PARK_CURSOR],
  },
  // "About track" on the phyloP track, for the section about what a checkbox
  // actually downloads: the dialog prints the adapter, so the hgdownload URL the
  // config points at is on screen rather than asserted in a paragraph.
  //
  // Two frames side by side rather than the dialog alone, because the dialog is
  // the answer and the menu item is the question: a reader who has never opened
  // that menu cannot get to the second frame from the first. Same shape as the
  // turn_on_phylop pair, and for the same reason -- the difference between the
  // frames is one click, and a reader compares them across rather than down.
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
          tracks: [AXOLOTL_GC_TRACK, AXOLOTL_RMSK_ROWS],
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 180000,
    settleMs: 10000,
    viewportHeight: 740,
    diffThreshold: 0.02,
  },
]
