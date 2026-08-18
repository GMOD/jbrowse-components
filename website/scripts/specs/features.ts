import {
  DEMO_CONFIG,
  PARK_CURSOR,
  UCSC_HG38_CONFIG,
  VOLVOX,
  cascadeBoxes,
  dismissMenus,
  lgvSession,
  menuCascade,
  openFeatureHeightSubmenu,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'

import type {
  ScreenshotAction,
  ScreenshotSpec,
} from '../screenshot-spec-types.ts'

// The feature-details route into the sequence panel, from an already-open
// feature: wait for the item, click it, then open the "Sequence type" select so
// the next action can pick a rendering. Three figures on this page take it.
//
// The delays are the panel's, not padding: the item appears before the details
// pane has finished laying out, and the sequence fetch runs between the click
// and the select being mounted. They were written out identically at all three
// sites, which is the thing a helper stops drifting.
const openFeatureSequence = (): ScreenshotAction[] => [
  { type: 'waitForText', text: 'Show feature sequence' },
  { type: 'delay', ms: 1000 },
  { type: 'click', text: 'Show feature sequence' },
  { type: 'delay', ms: 2000 },
  { type: 'click', selector: '[aria-label="Sequence type"]' },
  { type: 'delay', ms: 1000 },
]

// NA12878 direct-RNA nanopore reads sliced to just the PTEN locus and re-hosted,
// so the collapse-introns/sashimi figure downloads a ~2 MB deterministic file
// instead of range-querying the whole-genome BAM (which never quiesced before
// the loading-overlay timeout — the source of that figure's run-to-run flakiness).
export const PTEN_RNASEQ_BAM =
  'https://jbrowse.org/demos/rnaseq/NA12878-DirectRNA.PTEN.bam'
export const PTEN_RNASEQ_ADAPTER = {
  type: 'BamAdapter',
  bamLocation: { uri: PTEN_RNASEQ_BAM, locationType: 'UriLocation' },
  index: {
    location: { uri: `${PTEN_RNASEQ_BAM}.bai`, locationType: 'UriLocation' },
    indexType: 'BAI',
  },
}

// hg38 + NCBI RefSeq + ClinVar, loading the Protein3d plugin from the
// version-agnostic jbrowse.org plugin-store `latest/` path (served no-cache), so
// there's no pinned version to bump on a protein3d release. The protein-feature
// data-testid clicks in the spec below need protein3d >= v0.4.14, which `latest/`
// satisfies. Rendered against the *local* build (bare ?config=), which has the
// workspaces split API (session `init`) the side-by-side launch needs.
export const PROTEIN3D_CONFIG = 'test_data/protein3d_config.json'

// The volvox Apple3 mRNA, which two figures below open the feature-details panel
// on. Naming the mRNA's own span puts the click at its midpoint, so it is the
// furthest it can be from either end of the feature it has to hit; the depth is
// the row that mRNA packs into, measured from the track's top edge rather than
// from the top of the page.
const APPLE3_MRNA = {
  track: 'gff3tabix_genes',
  locus: 'ctgA:17,400-23,000',
  fracY: 0,
  dy: 121,
}

const PROTEIN_LAUNCH_GENE_TRACK = 'hg38-ncbiRefSeqCurated'

// TP53's own band, near the top of it: `longestCoding` draws one gene row, so a
// centered right-click lands on empty canvas and opens the view's own menu with
// no feature items on it.
const PROTEIN_LAUNCH_ANCHOR = {
  track: PROTEIN_LAUNCH_GENE_TRACK,
  locus: 'chr17:7,676,000',
  fracY: 0.2,
}

// The gene menu route protein/annotation_1d takes, on genomes.jbrowse.org's own
// hg38 config — the one the msa figures load and the one the tutorial's
// click-path is written against, rather than the pinned PROTEIN3D_CONFIG that
// protein/connected uses. The launcher is contributed to the gene menu by the
// plugin the hosted config loads; against the repo config's own protein3d the
// same right-click opens a menu with neither launcher on it, so the route the
// page documents is only reachable here.
//
// Split out from its one caller for the video tour `proteins/annotation_1d`,
// which films this same route: the one thing the still cannot say is that the
// launch opens the view with none of its tracks on.
//
// The split button had two more destinations until protein3d removed them, both
// reading the a3m AlphaFold advertises as `msaUrl` for the entry. That file is
// unfetchable — the whole `/files/msa/` path answers 403 at Google's edge — so
// neither ever built anything, and the figure of all three connected views that
// would have gone on this page has no route to it.
const PROTEIN_LAUNCH_SESSION = sessionSpec(UCSC_HG38_CONFIG, {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'hg38',
      loc: 'chr17:7,668,000-7,688,000',
      tracks: [
        // the two settings every right-clicked gene track in these figures
        // pins: the click is resolved against the track's band, and an auto
        // height is a function of how many isoforms RefSeq draws here
        {
          trackId: PROTEIN_LAUNCH_GENE_TRACK,
          geneGlyphMode: 'longestCoding',
          height: 60,
        },
      ],
    },
  ],
})

// Right-click TP53, open the launch dialog, and open the split button beside
// its Launch. Everything the dialog can build is on that menu.
const OPEN_PROTEIN_LAUNCH_MENU: ScreenshotAction[] = [
  { type: 'rightclick', anchor: PROTEIN_LAUNCH_ANCHOR },
  { type: 'waitForText', text: 'Launch protein view' },
  { type: 'click', text: 'Launch protein view' },
  // Launch is disabled until the dialog has mapped the transcript to a UniProt
  // entry and read its protein sequence, so an enabled Launch is the
  // declarative "the dialog has resolved" rather than a guess at how long
  // UniProt takes to answer.
  {
    type: 'waitForSelector',
    selector: 'button:not([disabled])::-p-text(Launch)',
    timeout: 120000,
  },
  // The arrow beside Launch. `More launch options` is the button's own
  // aria-label; the menu it opens is where the three other destinations live,
  // and none of them carries a test id.
  { type: 'click', selector: 'button[aria-label="More launch options"]' },
]

// What the `proteins/annotation_1d` tour films this same route against. The
// session and the anchor rather than the action list: the tour writes its own
// steps because it needs captions, holds and camera cuts the figure has no use
// for, but a tour that opened its own session or picked its own locus would
// document a route through an app this page's figure is not showing.
export const proteinLaunchFixtures = {
  session: PROTEIN_LAUNCH_SESSION,
  geneAnchor: PROTEIN_LAUNCH_ANCHOR,
}

export const featuresSpecs: ScreenshotSpec[] = [
  {
    // The session-wide feature-height default on alignments tracks.
    // featureHeight is a promotable slot (track value → session default →
    // promotedBase 7; spacing is derived from it, never stored). Each height row
    // in the "Read height" submenu carries a trailing pin
    // (PinAdornment, aria-label "make <preset> the default for all
    // tracks") that toggles that preset as the session default on click. The pin
    // writes *only* the default — it never rewrites a track's own value — so the
    // two open tracks are seeded differently to show both halves of that: the
    // pileup track has no featureHeight (it follows the default, so pinning
    // Compact turns it compact at once) and the CRAM track is customized to 12
    // (it keeps its own value, and is the "1 customized track" the snackbar
    // offers to override). Two stages mirror the how-to: stage 1 opens the
    // submenu with the Compact row's pin circled; stage 2 clicks it and boxes the snackbar
    // action, then makes the customized track compact so the frame shows the end
    // state.
    mode: 'url',
    name: 'feature_height_default',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1..8,000',
      tracks: [
        {
          trackId: 'volvox_alignments_pileup_coverage',
          type: 'LinearAlignmentsDisplay',
        },
        {
          trackId: 'volvox_cram_alignments_ctga',
          type: 'LinearAlignmentsDisplay',
          featureHeight: 12,
        },
      ],
    }),
    readyText: 'ctgA',
    // the two frames sit side by side (reviewer), so the pair is twice this
    // wide: narrowed from 1100, which made a 4400px PNG the page then scales
    // the menu text out of. `stageColumns` borders each frame, so the two app
    // windows are separated by a gutter rather than sharing an edge
    stageColumns: 2,
    viewportWidth: 950,
    // trimmed 100px off both frames (reviewer); MUI reflows the Read-height
    // submenu upward to stay inside the shorter viewport, and the pin circle
    // anchors to the live element, so it follows
    viewportHeight: 740,
    // alignments pileups keep re-laying-out while reads stream in; wait long
    // enough that the menu geometry is stable before the click sequence
    settleMs: 8000,
    hideTooltip: true,
    // belt-and-suspenders: also strip any lingering MUI tooltip popper the menu
    // driving leaves behind, so no tooltip bubbles into either frame (reviewer)
    hideSelectors: ['.MuiTooltip-popper'],
    stages: [
      {
        // top frame: the "Read height" submenu open, with the Compact row's
        // trailing pin hovered + circled so the one affordance that promotes a
        // height to the default reads at a glance
        // no hover on the pin: it's always rendered, and hovering pops its MUI
        // tooltip into the frame (reviewer). The circle marks it instead.
        actions: [
          trackMenuIcon('volvox_alignments_pileup_coverage'),
          ...openFeatureHeightSubmenu(),
        ],
        annotations: [
          {
            type: 'circle',
            anchor: {
              selector:
                '[aria-label="make Compact the default for all tracks"]',
            },
          },
          {
            type: 'text',
            x: 210,
            y: 34,
            maxWidth: 500,
            fontSize: 15,
            text: 'Each feature-height preset has a trailing pin that sets it as the default for all tracks of this type.',
          },
        ],
      },
      {
        // bottom frame: clicking the pin sets Compact as the session default,
        // which the uncustomized pileup track picks up at once (it turns compact
        // in place without the pin touching it); the resulting snackbar's action
        // (boxed, not clicked, so it stays on screen) reaches the one open track
        // still holding its own height. To show the end state — both tracks
        // compact — that track is then made compact through its own "Read height"
        // > Compact row (not the snackbar, which would dismiss the snackbar the
        // frame is meant to show). Each menu is dismissed with a neutral title-bar
        // click, not Escape, which would pop the snackbar. The snackbar ignores
        // clickaway and no longer auto-hides (actionable ones persist, see
        // SnackbarModel), so the click chain can't race a 5s timeout.
        actions: [
          {
            type: 'click',
            selector: '[aria-label="make Compact the default for all tracks"]',
          },
          { type: 'waitForText', text: 'Override 1 customized track' },
          ...dismissMenus(),
          // make the OTHER open track compact through its own Read-height menu
          // (not the snackbar action, which would dismiss the snackbar the
          // reviewer wants left visible) so the frame ends with both tracks
          // compact and the "Override 1 customized track" affordance still on screen
          trackMenuIcon('volvox_cram_alignments_ctga'),
          ...openFeatureHeightSubmenu(),
          { type: 'click', text: 'Compact' },
          { type: 'delay', ms: 400 },
          ...dismissMenus(),
          { type: 'delay', ms: 2000 },
        ],
        annotations: [
          {
            type: 'box',
            anchor: { text: 'Override 1 customized track' },
            strokeWidth: 3,
          },
          {
            type: 'text',
            x: 210,
            y: 34,
            maxWidth: 500,
            fontSize: 15,
            text: 'Clicking the pin sets Compact as the default: tracks following the default go compact at once, and the snackbar offers to apply it to the one customized track.',
          },
        ],
      },
    ],
  },

  // About track dialog (config + file header), opened from the track menu of a
  // CRAM track so the FILE INFO panel shows the full @SQ/@PG header.
  {
    mode: 'url',
    name: 'about_track',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram'],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    // The dialog is taller than the app window behind it, so what sits below it
    // is page background and the run reads that as slack: 121 css px at the
    // default 800. It re-centres as the viewport shrinks, so the blank closes at
    // about half the rate you take off — 680 leaves 61, just over the 50 the run
    // warns at. **Don't chase the warning to zero.** That needs ~580, where the
    // dialog rises over the app's toolbar and locstring and the frame stops
    // showing what the dialog was opened from. 61 is a framing choice.
    viewportHeight: 680,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'delay', ms: 500 },
      { type: 'click', text: 'About track' },
      { type: 'waitForText', text: 'AlignmentsTrack' },
      { type: 'delay', ms: 1500 },
    ],
  },

  // Color-by-CDS frame coloring on a gene track: human BRCA1 (hg19 NCBI RefSeq)
  // zoomed to base-pair resolution with the reference sequence track above
  // . Two stages mirror the how-to: stage 1 opens the view menu with
  // "Color CDS by reading frame" boxed; stage 2 clicks it, so each CDS codon is
  // tinted by its reading frame, joining the amino acids that are drawn at this
  // zoom either way, lined up to the reference codons above.
  //
  // ONE FRAME COLOUR, which is correct and is why the guide's prose does not ask
  // this figure to show a phase change. The window is inside BRCA1's exon 11
  // (chr17:41,243,451-41,246,877, 3426 bp), frame is constant within a CDS
  // segment, and the nearest junction is 550 bp away. There is no window that
  // fixes it either: two coding exons need ~130 bp at the tightest human intron,
  // and residue numbers stop at ~105 (below), so a frame-change frame and a
  // lettered frame are mutually exclusive here. The lettered one is what the
  // section is about.
  //
  // 91 bp, where this was 121: the residue NUMBER beside each letter (`Q1182`)
  // is what lines the frame up against the reference codons, and it is drawn
  // only once a codon is wide enough for the widest label the format can
  // produce -- one letter and five digits, plus a separator (peptidePositioning,
  // residueNumbersFit). That is a fixed budget rather than a measurement of the
  // label in hand, deliberately, so that every residue on screen agrees and
  // panning across residue 999 changes nothing; the cost is that a window this
  // side of about 105 bp draws bare letters. 121 bp was just past it.
  {
    mode: 'url',
    name: 'gene_track_color_by_cds',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr17:41,244,000-41,244,090',
      // offset labels so they overlay the tracks
      trackLabels: 'offset',
      tracks: [
        'Pd8Wh30ei9R',
        {
          trackId: 'ncbi_gff_hg19',
          type: 'LinearBasicDisplay',
          geneGlyphMode: 'longestCoding',
        },
      ],
    }),
    readyText: 'RefSeq',
    readyTimeout: 60000,
    viewportHeight: 500,
    stages: [
      {
        // top frame: the view (hamburger) menu open, the color-by-CDS toggle
        // ringed + boxed so the one click that enables it reads at a glance
        actions: [
          { type: 'click', selector: '[data-testid="view_menu_icon"]' },
          ...menuCascade(['Color CDS by reading frame']),
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="view_menu_icon"]' },
          },
          ...cascadeBoxes(['Color CDS by reading frame']),
        ],
      },
      {
        // bottom frame: after the click each codon is frame-tinted with its
        // amino acid drawn over it, aligned to the reference sequence above.
        // A checkbox row keeps the menu up (staysOnClick), so dismiss it —
        // otherwise it covers the left of the result it just produced
        actions: [
          { type: 'click', text: 'Color CDS by reading frame' },
          // dismiss through the backdrop rather than Escape, which returns
          // focus to the hamburger and leaves its tooltip in the frame.
          //
          // A bare coordinate on purpose, and not one that wants an anchor: the
          // menu's backdrop covers the viewport, so this hits nothing in
          // particular and any point off the menu would do. Same category as
          // `dismissMenus`. It does have to be INSIDE the viewport, which is the
          // one thing it can get wrong silently: at y 550 in a 500px capture the
          // click lands nowhere, the backdrop stays, and the frame is of the menu
          // over the result it just produced.
          { type: 'click', from: { x: 700, y: 420 } },
          { type: 'delay', ms: 5000 },
        ],
      },
    ],
  },

  // Selenoprotein transl_except highlight: GPX1 (hg19 NCBI RefSeq, chr3, minus
  // strand) has one in-frame UGA recoded as selenocysteine via a downstream
  // SECIS element, written as
  // `transl_except=(pos:complement(49395565..49395567),aa:Sec)`. Zoomed to that
  // codon with peptide lettering on, the overridden residue is drawn as `U` on an
  // orange codon background (translExceptColor) instead of the stop it would
  // otherwise be. Exercises parseTranslExcept's handling of NCBI's
  // complement()/accession-prefixed pos syntax on real data.
  {
    mode: 'url',
    name: 'gene_track_selenocysteine',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr3:49,395,505-49,395,625',
      colorByCDS: true,
      trackLabels: 'offset',
      tracks: [
        'Pd8Wh30ei9R',
        {
          trackId: 'ncbi_gff_hg19',
          type: 'LinearBasicDisplay',
          geneGlyphMode: 'longestCoding',
        },
      ],
    }),
    readyText: 'RefSeq',
    readyTimeout: 60000,
    settleMs: 6000,
    viewportHeight: 500,
  },

  // Viral polyprotein: the enterovirus D ORF1 CDS is cleaved into mature
  // peptides (mature_protein_region_of_CDS). They render as stacked rows, each
  // colored from a distinct palette and individually hoverable; the labels.name
  // config in the track surfaces each region's GFF `product` (VP1, 2A, 3C, …).
  // subfeatureLabels:'overlay' draws each product name on its peptide bar (the
  // matureProteinRegion glyph now emits floating labels like the transcript
  // glyph does).
  {
    mode: 'url',
    name: 'gene_track_mature_peptides',
    url: lgvSession('test_data/enterovirus_d/config.json', {
      assembly: 'GCF_000861205.1',
      loc: 'NC_001430.1:727-7,311',
      // offset labels so they overlay the tracks
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'ncbi_genes_enterovirus_d',
          // tall enough for the gene row + all 12 stacked mature peptides
          type: 'LinearBasicDisplay',
          height: 220,
          subfeatureLabels: 'overlay',
          showOnlyGenes: true,
        },
      ],
    }),
    readyText: 'NCBI genes',
    readyTimeout: 30000,
    settleMs: 4000,
    viewportHeight: 425,
  },

  // Collapse introns + RNA-seq sashimi: PTEN (hg38) with the MANE transcript
  // and a direct-RNA nanopore track. Right-clicking the gene and choosing
  // "Collapse introns" reshapes the view to the exons placed side by side; the
  // sashimi arcs from the RNA-seq splice junctions then connect adjacent exons.
  {
    mode: 'url',
    name: 'gene_track_collapse_introns',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'pten_directrna',
          name: 'NA12878 direct-RNA (PTEN)',
          assemblyNames: ['hg38'],
          adapter: PTEN_RNASEQ_ADAPTER,
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          // ~255kb rather than PTEN's own 109kb extent: zoomed out, the gene and
          // its sashimi arcs occupy the middle ~40% of the frame instead of
          // sprawling edge to edge behind the context menu (reviewer). The
          // alignments track gates on fetch size, not zoom, and the RNA BAM is a
          // PTEN-only slice, so the reads and arcs still render here.
          loc: 'chr10:87,790,000-88,045,000',
          // offset labels so they overlay the tracks
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'ncbi_refseq_109_hg38_latest',
              // one clean transcript per gene so the PTEN glyph + label is tidy.
              // The collapse-introns dialog's "Show only this feature" (on by
              // default) isolates the reshaped view to PTEN, dropping the
              // neighboring KLLN fragment — no jexl filter needed.
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
            },
            {
              // PTEN-only sliced RNA-seq BAM (see PTEN_RNASEQ_ADAPTER): a tiny
              // deterministic download, so the sashimi arcs are reliably present
              // at capture. compact pileup so the reads pack tightly
              trackId: 'pten_directrna',
              type: 'LinearAlignmentsDisplay',
              featureHeight: 3,
              // 'auto' splits the junction arcs above and below the reads to
              // minimize crossings (vs the default 'up', which stacks them all
              // above)
              sashimiArcsMode: 'auto',
              // The unfiltered pileup draws 159 distinct junctions, and 122 of
              // them carry 1-2 reads — nanopore aligner noise, much of it splice
              // sites shifted a few bp off a real one (e.g. 87958024 vs the true
              // 87958020). Crossing arcs everywhere (reviewer: chaotic).
              // Counted from the CIGAR N-ops of the (fixed, re-hosted) slice:
              // PTEN's 9 exons give exactly 8 real introns, each with 446-717
              // reads, while the loudest noise junction has 99 — so any cutoff
              // in that gap leaves precisely the 8 canonical introns. 200 sits
              // mid-gap (2.2x under the weakest real junction, 2x over the
              // loudest noise) rather than hugging either edge.
              minSashimiScore: 200,
            },
          ],
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 90000,
    settleMs: 6000,
    viewportHeight: 590,
    hideTooltip: true,
    // Two-stage walkthrough: (1) right-click the gene to reveal the Collapse
    // introns menu item, (2) the reshaped view with introns collapsed and the
    // sashimi arcs connecting adjacent exons. The confirmation dialog had its own
    // frame; it is now just driven through, since a stock dialog of prose and
    // defaults taught nothing the surrounding two frames don't (reviewer).
    actions: [
      // `readyText: 'NCBI RefSeq'` matches the track *name*, which appears before
      // the remote GFF finishes loading — so wait for the PTEN label itself to
      // render before acting on it.
      { type: 'waitForText', text: 'PTEN' },
    ],
    stages: [
      {
        // stage 1: right-click the gene's floating-label DOM element (not a raw
        // pixel), revealing the context menu with Collapse introns boxed
        actions: [
          { type: 'rightclick', text: 'PTEN' },
          { type: 'waitForText', text: 'Collapse introns' },
        ],
        annotations: [{ type: 'box', anchor: { text: 'Collapse introns' } }],
      },
      {
        // stage 2: click through the confirmation dialog (uncaptured) → the
        // reshaped view with introns collapsed. Scoped to `button::-p-text` so
        // the click can't resolve to dialog prose that happens to repeat the
        // button's wording.
        actions: [
          { type: 'click', text: 'Collapse introns' },
          { type: 'waitForText', text: 'Replace current view' },
          { type: 'click', selector: 'button::-p-text(Replace current view)' },
          { type: 'waitForText', text: 'Replace current view', hidden: true },
          // let the reshaped view refetch, then wait for the (tiny, sliced) RNA
          // BAM to load so the sashimi arcs are present in the capture
          { type: 'delay', ms: 2000 },
          {
            type: 'waitForSelector',
            selector: '[data-testid="loading-overlay"]',
            hidden: true,
          },
          { type: 'delay', ms: 3000 },
        ],
      },
    ],
  },
  // Gene feature-details sequence panel on a human gene (reviewer asked for a
  // human example over the volvox EDEN one, and a gene other than SELENOP —
  // that one's reserved for the transl_except/selenocysteine demo below in
  // feature_detail_protein). HBB (β-globin, chr11, minus strand) is used here:
  // reviewer asked for a *small* gene so the sequence panel shows short UTR,
  // CDS, and intron segments all at once rather than PTEN's huge exons. HBB is
  // the classic compact 3-exon gene (~1.6 kb, two small introns, short 5'/3'
  // UTRs). The type selector is set to the collapsed-intron + up/down-stream
  // variant so the panel shows the flanking sequence alongside the exon
  // structure.
  //
  // Uses config_demo's hg38 + ncbi_refseq_109_hg38_latest (labels by gene
  // symbol and exposes real CDS subfeatures, unlike the hg19 ncbi_gff / Gencode
  // tracks the earlier FAF1 attempt tried). geneGlyphMode 'longestCoding' draws a
  // single transcript, labeled with its gene symbol as a real floating DOM
  // label (LinearBasicDisplay always renders one), so the click targets it by
  // text rather than a pixel coordinate that drifts whenever the glyph's layout
  // changes.
  {
    mode: 'url',
    name: 'feature_detail_sequence',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr11:5,224,000-5,228,500',
      tracks: [
        {
          trackId: 'ncbi_refseq_109_hg38_latest',
          type: 'LinearBasicDisplay',
          geneGlyphMode: 'longestCoding',
          height: 200,
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 90000,
    settleMs: 8000,
    viewportHeight: 900,
    actions: [
      { type: 'click', text: 'HBB' },
      ...openFeatureSequence(),
      // collapsed introns keep 10bp of each intron so the exon structure reads
      // without huge intronic runs dominating the sequence, and the
      // up/down-stream variant additionally shows the flanking sequence
      {
        type: 'click',
        selector:
          '[data-testid="sequence_type_gene_updownstream_collapsed_intron"]',
      },
      { type: 'delay', ms: 3000 },
    ],
  },

  // Protein translation of SELENOP showing translation exceptions: the ten
  // in-frame UGA stop codons that NCBI RefSeq annotates as
  // `transl_except=(...,aa:Sec)` translate to selenocysteine (U), highlighted
  // amber in the peptide with a legend noting "10 selenocysteines (U) from
  // transl_except". Same setup/gene-label click as feature_detail_sequence;
  // only the type selector differs (Protein).
  {
    mode: 'url',
    name: 'feature_detail_protein',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr5:42,799,000-42,812,500',
      tracks: [
        {
          trackId: 'ncbi_refseq_109_hg38_latest',
          type: 'LinearBasicDisplay',
          geneGlyphMode: 'longestCoding',
          height: 200,
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 90000,
    settleMs: 8000,
    viewportHeight: 900,
    actions: [
      { type: 'click', text: 'SELENOP' },
      ...openFeatureSequence(),
      { type: 'click', text: 'Protein' },
      { type: 'delay', ms: 3000 },
    ],
  },

  // Customized feature details (customizing_feature_details.md) — volvox's
  // gff3tabix_genes track config carries a formatDetails JEXL callback that links
  // the name to a Google search, adds a custom "extrafield", and drops the type
  // field; clicking a gene shows the resulting panel.
  {
    mode: 'url',
    name: 'customized_feature_details',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:17200-23200',
      tracks: [{ trackId: 'gff3tabix_genes', height: 300 }],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    // shorter browser; the details panel scrolls so this only trims
    // empty space below the ringed hyperlink
    viewportHeight: 680,
    actions: [
      // canvas-drawn gene glyph: at this zoom the label is baked into the canvas
      // (no DOM text / overlay div to target), so the click resolves through the
      // view instead of naming a viewport point
      { type: 'click', anchor: APPLE3_MRNA },
      { type: 'waitForText', text: 'extrafield' },
      // the coordinate click leaves the cursor on the gene, so the hover overlay
      // shades it in the capture — move the pointer off the track to clear it
      PARK_CURSOR,
      { type: 'delay', ms: 2000 },
    ],
    // ring the formatDetails-generated hyperlink in the feature-details panel,
    // with the explanatory text above it. The previous arrow landed its head on
    // the link itself, covering the link text — the ring alone identifies it.
    annotations: [
      {
        type: 'circle',
        anchor: { selector: 'a[href^="https://google.com/?q="]' },
      },
      {
        type: 'text',
        x: 700,
        y: 150,
        text: 'The callback turns the name into a clickable link',
        // white-on-dark pill to match the other annotated figures
        background: 'rgba(0,0,0,0.78)',
        textColor: '#fff',
      },
    ],
  },

  // Feature-details upstream/downstream sequence panel (v1.1.0 blog post) — the
  // multi-exon volvox Apple3 gene (at ctgA:17400-23000) with "Show feature
  // sequence" expanded into the genomic-with-introns + up/down-stream mode so
  // the colored upstream / exon / intron / downstream sequence is shown.
  {
    mode: 'url',
    name: 'upstream_downstream_details',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:17200-23200',
      tracks: [{ trackId: 'gff3tabix_genes', height: 300 }],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    viewportHeight: 900,
    actions: [
      { type: 'click', anchor: APPLE3_MRNA },
      ...openFeatureSequence(),
      {
        type: 'click',
        text: 'Genomic w/ full introns +/- 100bp up+down stream',
      },
      { type: 'delay', ms: 3000 },
    ],
  },

  // Cytoband ideogram in the overview scale bar (v1.5.1 blog post) — hg19 from
  // the demo config (which carries a cytobands adapter) zoomed to a chr1 region.
  {
    mode: 'url',
    name: 'cytobands',
    // sized to the content: the rest of the viewport was page background
    viewportHeight: 347,
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:38,543,322-41,918,323',
      tracks: ['ncbi_gff_hg19'],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  // Connected genome + protein demo (TP53 / UniProt P04637). A single ProteinView
  // spec entry creates and connects its own LinearGenomeView via the plugin's
  // `connectedView` launch param, so the genome (NCBI RefSeq + ClinVar) and the
  // AlphaFold structure load linked. This uses the short-form declarative launch:
  // from just `uniprotId` + `transcriptId` the plugin derives the AlphaFold
  // structure URL, resolves the transcript feature from the hg38-ncbiRefSeq track
  // at `loc`, and translates its CDS to the protein sequence it aligns to the
  // structure. PROTEIN3D_CONFIG loads protein3d against the local build, whose
  // session has the `init` split API the side-by-side launch needs.
  //
  // That config pins the plugin to jbrowse.org/plugins/…/0.8.0/, not `latest/`:
  // the figure is a picture of a specific plugin's UI, so a release of it
  // shouldn't be able to change or break the capture without a commit here. Bump
  // the pin deliberately and re-render. (The comment used to claim a pin that
  // wasn't there, and pointed at jsDelivr, which is not where this loads from.)
  {
    mode: 'url',
    name: 'protein/connected',
    // the two panes and nothing under them, from the run's own
    // `CONTENT CLIPPED BELOW THE FOLD` at the track heights below
    viewportHeight: 990,
    url: sessionSpec(PROTEIN3D_CONFIG, {
      views: [
        {
          type: 'ProteinView',
          uniprotId: 'P04637',
          transcriptId: 'NM_000546.6',
          height: 540,
          // place the protein view to the right of its connected genome view
          // (left genome | right protein) via the workspaces split layout
          sideBySide: true,
          // keep the connected genome at the gene-wide view when a domain is
          // clicked so the domain shows as a highlighted sub-region
          zoomToBaseLevel: false,
          // Passed through as the new LinearGenomeView's `init`, so a track
          // entry here is an ordinary LGV one and takes a height. Which is what
          // fills the left column: side by side, the genome view is as tall as
          // the structure beside it, and at their default heights these two
          // tracks used a third of that and left the rest page background. The
          // ClinVar display is the one with more to show — it scrolls inside
          // its own band at any height, and at this one the rows a reader is
          // being invited to hover reach the bottom of the frame.
          connectedView: {
            assembly: 'hg38',
            loc: 'chr17:7,671,000-7,684,500',
            tracks: [
              { trackId: 'hg38-ncbiRefSeq', height: 150 },
              { trackId: 'clinvar_ncbi_hg38', height: 560 },
            ],
          },
        },
      ],
    }),
    // Waits for both the structure load and the genome↔structure pairwise
    // alignment to settle (this view has a connected transcript, so the test-id
    // only flips once the alignment is computed). settleMs is the molstar raster
    // paint beat at deviceScaleFactor 2, which can lag the model state a frame.
    readySelector: '[data-testid="protein-view-ready"]',
    readyTimeout: 90000,
    settleMs: 6000,
    // On macOS, headless Chrome's swiftshader rasterizes the molstar 3D canvas as
    // a featureless blob (no cartoon detail, no magenta motif highlight), so
    // uncomment firefox: true when regenerating there. Headless Chrome on Linux
    // renders it cleanly (the committed connected.png is such a capture), so the
    // flag stays off by default.
    // firefox: true,

    // Click the TP53 nuclear export signal (UniProt "Motif" 339-350) on the
    // protein feature track to drive the genome↔structure cross-highlight: the
    // motif residues select in the 3D structure (molstar) and a highlight band
    // is drawn over the connected LGV (NCBI RefSeq + ClinVar) at the mapped
    // genome region. The Motif track is used here rather than the Region track:
    // Region features (e.g. the 325-356 tetramerization region used previously)
    // are long and overlap each other, whereas the five UniProt motifs are
    // short and non-overlapping, so the clicked feature and its highlight read
    // cleanly. Feature bars expose data-testid (protein3d ≥ v0.4.14), but
    // "Motif" is shared by all five motifs, so data-feature-start disambiguates
    // this one (12 residues, well within the alignment track's 649px
    // horizontally-scrollable viewport). `scroll` centers the target in its
    // scrollable ancestor before the click, since the motif starts past residue
    // ~115, off the default-scrolled viewport.
    actions: [
      {
        type: 'waitForSelector',
        selector:
          '[data-testid="protein-feature-Motif"][data-feature-start="339"]',
      },
      {
        type: 'scroll',
        selector:
          '[data-testid="protein-feature-Motif"][data-feature-start="339"]',
      },
      {
        type: 'click',
        selector:
          '[data-testid="protein-feature-Motif"][data-feature-start="339"]',
      },
      { type: 'delay', ms: 6000 },
    ],
    // The click leaves the cursor on the motif, so protein3d's own tooltip sat
    // over the feature rows beside it — including the bar that was clicked,
    // which is the one thing in that panel the figure needs visible. Hidden at
    // the shot rather than cleared with PARK_CURSOR, which would also drop
    // whatever molstar is drawing off the hover.
    hideTooltip: true,
  },

  // The other view the protein dialog builds, and the one the page describes in
  // a paragraph with no picture: a linear genome view whose GENOME is the
  // protein. protein3d registers the UniProt accession as a temporary assembly
  // whose reference sequence is the amino-acid chain, then turns on a track per
  // UniProt feature type over it plus Antigen, Variation, pLDDT and
  // AlphaMissense. Coordinates are residues all the way down, so a reader sees
  // the same machinery answering a question the genome cannot phrase.
  //
  // Clicked rather than declared: `LaunchView-ProteinView` takes `url`,
  // `uniprotId`, `connectedView` and the rest, and nothing that opens this view.
  // The route through the dialog's split button is the only one there is, which
  // also makes the frame a picture of the button the prose names.
  //
  {
    mode: 'url',
    name: 'protein/annotation_1d',
    url: PROTEIN_LAUNCH_SESSION,
    readyText: 'NCBI RefSeq',
    // the UCSC hub config is ~570 tracks and pulls four remote plugins
    readyTimeout: 120000,
    actions: [
      ...OPEN_PROTEIN_LAUNCH_MENU,
      { type: 'click', text: 'Launch 1D protein annotation view' },
      // The launch adds the tracks to the session and opens the view with none
      // of them on, so the frame the page wants is four clicks further along.
      // `No tracks active` is the view's own empty state, and gating on it is
      // what says the assembly registered and the view navigated.
      { type: 'waitForText', text: 'No tracks active', timeout: 120000 },
      { type: 'click', text: 'Open track selector' },
      // The list opens with its categories collapsed, and everything protein3d
      // added is under this one.
      { type: 'click', text: 'Session tracks' },
      // The last of them to be added, so its row is the selector having
      // finished filling in.
      { type: 'waitForText', text: 'AlphaMissense scores', timeout: 120000 },
      // Four of the nineteen, in the order they stack: the two UniProt feature
      // types that carry TP53's story, then the two per-residue score tracks.
      // Every one of them thins out over the terminal tails the DNA-binding
      // core sits between, which is what makes one frame readable instead of
      // nineteen bands of the same length.
      { type: 'click', text: 'DNA binding' },
      { type: 'click', text: 'Natural variant' },
      { type: 'click', text: 'AlphaFold confidence' },
      { type: 'click', text: 'AlphaMissense scores' },
      // The drawer takes ~400px off the views while it is open and an LGV keeps
      // its bp-per-pixel across a resize, so the genome view above is captured
      // at a wider window than the session opened at unless this closes first.
      { type: 'click', selector: 'button[aria-label="Close drawer"]' },
      { type: 'waitForAppSettled' },
    ],
    // The launch leaves the cursor where the menu item was, which is over the
    // new view's own track area.
    hideTooltip: true,
    // the two views and nothing under them, from the run's own
    // `CONTENT CLIPPED BELOW THE FOLD`: at 900 the AlphaMissense heatmap was
    // cut mid-row, and it is the track a reader has least idea what to expect
    // of.
    viewportHeight: 1045,
  },
]
