import {
  DEMO_CONFIG,
  HG002_NANOPORE_HP_TRACK,
  VOLVOX,
  VOLVOX_SV_CRAM_ADAPTER,
  cascadeBoxes,
  lgvSession,
  menuCascade,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

export const alignmentsSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'volvox_alignments',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram_alignments'],
    }),
    viewportWidth: 1000,
    viewportHeight: 550,
    readyText: 'ctgA',
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'sequence_track',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:20000-20050',
      tracks: ['volvox_refseq'],
    }),
    viewportWidth: 1100,
    viewportHeight: 400,
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'waitForText', text: 'Open track selector' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 500 },
    ],
  },

  {
    mode: 'url',
    name: 'alignments_soft_clipped',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:2615-2725',
      tracks: [
        {
          trackId: 'volvox-long-reads-sv-bam',
          type: 'LinearAlignmentsDisplay',
          showSoftClipping: true,
        },
      ],
    }),
    readyText: 'ctgA',
    // wider window per reviewer, shorter height to trim empty space below pileup
    viewportWidth: 900,
    viewportHeight: 450,
    settleMs: 4000,
    // soft-clip overhang renders dense per-base sequence letters, far more
    // glyphs per pixel than a typical track-label spec, so sub-pixel
    // glyph-positioning jitter (see DEFAULT_DIFF_THRESHOLD comment) adds up to
    // ~1.5% here instead of ~0.2%
    diffThreshold: 0.02,
  },

  // Read cloud display on the volvox synthetic-SV CRAM: mates are
  // laid out on the Y axis by the log distance between them, so insertion pairs
  // (drawn pink) separate from background. Each pair renders as two colored
  // squares at the read positions joined by a black connector line (the
  // arcMarker pass; see arc.slang / drawCanvas.ts) — the classic read-cloud look.
  // Drawn below the coverage band (readConnectionsDown) so the cloud doesn't
  // overlap the coverage histogram. Read arcs in an SV context are shown by the
  // multi-sv-trio spec.
  //
  // The two contigs carry different synthetic SV signatures (verified via
  // `samtools view -T volvox.fa volvox-sv.cram <ctg>`):
  //   ctgA — a normal FR band (~450 bp insert) plus a cluster of long-insert
  //     (~32 kb TLEN) deletion pairs and short-insert pairs, so its cloud spreads
  //     from the y=0 baseline up to the deletion signal — the rich read-cloud story.
  //   ctgB — ALL pairs are RL/outward-facing (mates point outward, the teal
  //     "RL" class) at a narrow 300-550 bp insert, an inversion-style signature.
  //     There are zero normal small-insert pairs, so the ctgB cloud is one flat
  //     RL band with nothing at the y=0 baseline — that empty baseline is the
  //     data, not a layout gap (the pileup below still fills from row 0).
  {
    mode: 'url',
    name: 'alignments/read_cloud',
    url: sessionSpec(VOLVOX, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'volvox_sv_cram_linked',
          name: 'volvox-sv read cloud',
          assemblyNames: ['volvox'],
          adapter: VOLVOX_SV_CRAM_ADAPTER,
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          // whole-genome zoom-out (both ctgA + ctgB): no `loc`, so afterAttach's
          // showAllRegionsInAssembly lays out the entire assembly — a wider zoom
          // than the single ctgA contig, so the read cloud reads as a compact
          // cluster with room around it (reviewer wanted to see it zoomed out past
          // the data's own extent). Local volvox assembly loads instantly, so the
          // showAllRegions call doesn't race a remote fetch.
          tracks: [
            {
              trackId: 'volvox_sv_cram_linked',
              type: 'LinearAlignmentsDisplay',
              readConnections: 'cloud',
              readConnectionsDown: true,
              // color the cloud by both insert size and orientation:
              // short-insert pairs always paint pink (overriding orientation,
              // so the insertion-supporting cluster stands out from the grey
              // normal background even though it's RR-oriented), while
              // long-/normal-insert pairs paint by their pair type. The arc
              // palette uses a saturated short-insert pink so the thin cloud
              // lines stay visible.
              arcColorByType: 'insertSizeAndOrientation',
              colorBy: { type: 'insertSizeAndOrientation' },
              // legend on (reviewer): the cloud leaves enough empty space that
              // the floating legend keys the insert-size/orientation colors
              // without obscuring the reads
              showLegend: true,
              coverageHeight: 100,
              readConnectionsHeight: 100,
              height: 600,
              userByteSizeLimit: 500_000_000,
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    viewportHeight: 520,
    settleMs: 25000,
  },

  // Soft clipping, two-stage figure: top frame opens the track menu's "Show..."
  // submenu with "Show soft clipping" boxed — soft clipping is NOT yet enabled,
  // so the reads render normally (clipped bases hidden). Bottom frame clicks the
  // item, enabling soft clipping and closing the menu, so it teaches cause→effect
  // (stage 1 must be the not-yet-enabled state, stage 2 the result with
  // no menu open). Combines the old separate menu + result screenshots.
  {
    mode: 'url',
    name: 'alignments_soft_clipped_menu',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      // zoomed in toward the soft-clip breakpoint
      loc: 'ctgA:2670-2730',
      tracks: ['volvox-long-reads-sv-bam'],
    }),
    readyText: 'ctgA',
    // wider + taller per reviewer request so the menu cascade and result-frame
    // pileup both have room
    viewportWidth: 1100,
    viewportHeight: 620,
    settleMs: 4000,
    // result frame renders dense per-base sequence letters in the soft-clip
    // overhang (see alignments_soft_clipped's diffThreshold comment)
    diffThreshold: 0.02,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Show...', 'Show soft clipping']),
        ],
        // box both the parent "Show..." submenu and the "Show soft clipping"
        // item it opens (reviewer asked to also circle "Show...")
        annotations: [
          { type: 'box', anchor: { text: 'Show...' } },
          { type: 'box', anchor: { text: 'Show soft clipping' } },
        ],
      },
      {
        // click the boxed item to actually enable soft clipping; the menu closes
        // on click, so the result frame shows the soft-clipped reads with no menu
        actions: [
          { type: 'click', text: 'Show soft clipping' },
          { type: 'waitForText', text: 'Show soft clipping', hidden: true },
          { type: 'hover', from: { x: 200, y: 100 } },
          { type: 'delay', ms: 2500 },
        ],
      },
    ],
  },

  // Right-click context menu on a read in a LinearAlignmentsDisplay (Open
  // feature details / Copy info / Dotplot of read vs ref / Linear read vs ref).
  // Read glyphs are canvas-drawn, so the rightclick uses a viewport coordinate;
  // a follow-up mouse move off the read clears its hover tooltip.
  {
    mode: 'url',
    name: 'linear_align_ctx_menu',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1500-2000',
      // short paired reads from volvox-sv (more interesting than
      // the big long reads the old capture used)
      tracks: ['volvox_sv_cram'],
    }),
    readyText: 'ctgA',
    settleMs: 6000,
    hideTooltip: true,
    actions: [
      { type: 'rightclick', from: { x: 400, y: 250 } },
      { type: 'waitForText', text: 'Open feature details' },
      { type: 'delay', ms: 800 },
    ],
    // clarify the action (it's unclear this menu comes from
    // right-clicking a read). Caption sits over the pileup just left of the menu
    // with a short arrow at the right-clicked read row (y=250 = the click point);
    // JBrowse intentionally clears the hover shading when the context menu opens,
    // so the arrow stands in for the missing highlight.
    annotations: [
      {
        type: 'text',
        x: 165,
        y: 285,
        maxWidth: 180,
        text: 'Right-click any read to open this menu',
      },
      // start the arrow to the right of the text pill (which spans ~x165-345)
      // so the line never crosses the callout box, then point up at the
      // right-clicked read
      { type: 'arrow', from: { x: 365, y: 300 }, to: { x: 392, y: 250 } },
    ],
  },

  // The Filter by dialog (SAM flag bitmask editor), opened by driving the track
  // menu. Illustrates the "Filtering reads" section.
  {
    mode: 'url',
    name: 'alignments/filter_dialog',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_sv_cram'],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'delay', ms: 500 },
      // The flag/tag dialog lives under the "Filter by..." submenu.
      ...menuCascade(['Filter by...', 'Edit filters...']),
      { type: 'click', text: 'Edit filters...' },
      { type: 'delay', ms: 1000 },
    ],
  },

  // Sort by base at a SNP, showing the right-click workflow (reviewer wanted the
  // menu over the SNP captured, not just the declarative result). The view is
  // centered on the ctgA:14481 SNP (a green-A mismatch column) with the reads
  // already sorted by that base, so the variant reads cluster at the top — a
  // right-click there reliably lands on a mismatch and opens the read context
  // menu's "SNP/Mismatch → Sort by base at position" submenu, boxed here.
  {
    mode: 'url',
    name: 'alignments_sort_by_base',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:14427-14534',
      showCenterLine: true,
      tracks: [
        {
          trackId: 'volvox_bam',
          type: 'LinearAlignmentsDisplay',
          sortedBy: {
            // 0-based internal coordinate: the SNP displayed as ctgA:14,481
            // (1-based) is position 14480 internally. Match the base the
            // right-click sort lands on so both figure frames sort identically.
            type: 'basePair',
            pos: 14480,
            refName: 'ctgA',
            assemblyName: 'volvox',
          },
        },
      ],
    }),
    readyText: 'ctgA',
    // narrower window; the rightclick x below is recomputed
    // for this width — the SNP at ctgA:14481 sits at ~0.51 of the 107bp region
    viewportWidth: 1100,
    // crop each stage to the populated header+pileup so the stacked two-frame
    // figure isn't padded by the empty viewport below (shorter window).
    // height 500 gives the right-click context menu breathing room below its last
    // item instead of clipping it at the frame edge (menu cut off)
    crop: { x: 0, y: 0, width: 1100, height: 500 },
    settleMs: 5000,
    hideTooltip: true,
    // two-stage: top frame is the right-click "SNP/Mismatch → Sort by base at
    // position" menu; bottom frame closes the menu to show the resulting sorted
    // pileup (reads carrying the same base at ctgA:14481 grouped together)
    stages: [
      {
        actions: [
          { type: 'rightclick', from: { x: 550, y: 272 } },
          ...menuCascade(['SNP/Mismatch', 'Sort by base at position']),
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Sort by base at position' } },
          // call out that the right-click happens on the variant column itself.
          // Anchored just left of the menu's top item so the label sits next to
          // the context menu instead of off in the corner
          {
            type: 'text',
            anchor: { text: 'SNP/Mismatch' },
            // text-anchor is "start", so x is the box's left edge and the label
            // grows rightward — push it well left so its right edge clears the
            // context menu's left edge instead of overlapping it
            dx: -440,
            dy: -30,
            maxWidth: 270,
            text: 'Right-click a mismatch to sort reads by that base',
          },
        ],
      },
      {
        actions: [
          // actually perform the sort by clicking the boxed menu item so the
          // bottom frame teaches cause→effect (and isn't a stale preset that
          // restored unsorted); the click closes the menu
          { type: 'click', text: 'Sort by base at position' },
          {
            type: 'waitForText',
            text: 'Sort by base at position',
            hidden: true,
          },
          // move the pointer off the pileup so no hover tooltip lingers, then
          // let the re-sort settle and repaint
          { type: 'hover', from: { x: 200, y: 100 } },
          { type: 'delay', ms: 2500 },
        ],
        // make the (subtly-grouped) sort legible: point at the center column
        // where the reads carrying each base at 14481 now stack into one block
        annotations: [
          {
            type: 'text',
            x: 610,
            y: 250,
            maxWidth: 330,
            text: 'Sorted: reads carrying each base at ctgA:14,481 now stack into one block — here the A-reads run down the center column.',
          },
          { type: 'arrow', from: { x: 605, y: 258 }, to: { x: 565, y: 235 } },
        ],
      },
    ],
  },

  {
    mode: 'url',
    name: 'alignments_track_arcs',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      // B2M (plus strand, chr15) — a ubiquitously-expressed housekeeping gene
      // with a single isoform and just 3 introns, so the RNA-seq sashimi arcs
      // are few and clean (GAPDH's many short exons gave "tons of small arcs").
      loc: 'chr15:45,003,000-45,012,000',
      // offset track labels so they overlay the tracks
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          // give the gene track room so the B2M model is clearly visible
          // above the sashimi arcs (gene track too short to see)
          type: 'LinearBasicDisplay',
          height: 120,
        },
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          // flagship sashimi shot: label each junction arc with its supporting-
          // read count, and use 'auto' placement so arcs split above/below by
          // strand instead of all stacking upward. super-compact
          // (featureHeight 1 / spacing 0) packs the pileup so it fits in view
          // instead of hitting "Max layout height reached". log coverage scale
          // so a single tall pileup peak doesn't flatten the rest of the
          // coverage histogram behind the arcs
          type: 'LinearAlignmentsDisplay',
          showSashimiLabels: true,
          sashimiArcsMode: 'auto',
          scaleType: 'log',
          featureHeight: 1,
          featureSpacing: 0,
        },
      ],
    }),
    readyText: 'B2M',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  {
    mode: 'url',
    name: 'hic_track',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr8:50,366,343-61,321,733',
      // offset labels so they overlay the tracks
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          // hide gene descriptions so the gene track stays compact next to
          // the Hi-C display
          type: 'LinearBasicDisplay',
          showDescriptions: false,
        },
        'hic',
      ],
    }),
    readySelector: '[data-testid="hic-display-done"]',
    readyTimeout: 60000,
    settleMs: 10000,
  },

  // The same modifications CRAM shown twice in ONE ultra-wide frame — top row in
  // modifications mode (each call drawn at its MM-tag position), bottom row in
  // methylation mode (both modified and reference-CpG-inferred unmodified
  // positions) — over a UCSC CpG island on chr20. Each row is labeled with the
  // mode it is rendered in. The config
  // track (human_chr20_mod_call_5mC_5hmC_CG_cram) supplies the methylation-mode
  // row; a sessionTrack copy with its own trackId supplies the modifications-mode
  // row (the same trackId can't appear twice in a view). The island is
  // hypo-methylated, so the methylation row reads as a blue block. Replaces a
  // hand-curated capture.
  {
    mode: 'url',
    name: 'alignments/modifications2',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'human_chr20_mod_call_5mC_5hmC_CG_cram_modifications',
          name: 'human_chr20_mod_call_5mC_5hmC_CG (CRAM) (modifications)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'CramAdapter',
            cramLocation: {
              uri: 'https://jbrowse.org/genomes/GRCh38/methylation/human_chr20_mod_call_5mC_5hmC_CG.cram',
              locationType: 'UriLocation',
            },
            craiLocation: {
              uri: 'https://jbrowse.org/genomes/GRCh38/methylation/human_chr20_mod_call_5mC_5hmC_CG.cram.crai',
              locationType: 'UriLocation',
            },
            sequenceAdapter: {
              type: 'BgzipFastaAdapter',
              fastaLocation: {
                uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
                locationType: 'UriLocation',
              },
              faiLocation: {
                uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.fai',
                locationType: 'UriLocation',
              },
              gziLocation: {
                uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.gzi',
                locationType: 'UriLocation',
              },
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          // zoomed out a bit from the old ~20kb window; the ultra-wide viewport
          // keeps roughly the same bp/px so the mod marks stay legible
          loc: 'chr20:19,742,000-19,778,000',
          tracks: [
            // CpG island annotation first (top) so the callout text on the CRAM
            // rows below doesn't cover it
            'cpgisland_ucsc_hg38',
            {
              trackId: 'human_chr20_mod_call_5mC_5hmC_CG_cram_modifications',
              colorBy: { type: 'modifications' },
              // lift the fetch-size gate so the CRAM auto-loads headless
              // instead of sitting on the force-load prompt (same mechanism
              // as the smalldel/multisv specs)
              userByteSizeLimit: 500_000_000,
            },
            {
              trackId: 'human_chr20_mod_call_5mC_5hmC_CG_cram',
              // the methylation view is now modifications + fillUnmarked (the
              // "fill in unmarked cytosines" checkbox): every CpG painted, with
              // implicit-unmethylated ones blue
              colorBy: {
                type: 'modifications',
                modifications: { fillUnmarked: true },
              },
              userByteSizeLimit: 500_000_000,
            },
          ],
        },
      ],
    }),
    readyText: 'CpG',
    readyTimeout: 60000,
    settleMs: 35000,
    hideTooltip: true,
    // no track menu in this frame: the mode radios carry no color swatches at
    // that level, so the open menu covered half the reads to show nothing the
    // row labels don't already say (reviewer). Wide single frame, both rows'
    // full width visible.
    viewportWidth: 2000,
    viewportHeight: 760,
    annotations: [
      {
        type: 'text',
        anchor: {
          selector:
            '[data-testid^="trackRenderingContainer-"][data-testid$="-human_chr20_mod_call_5mC_5hmC_CG_cram_modifications"]',
        },
        dx: 250,
        dy: -60,
        // matches the probability callout's width so the two pills line up
        maxWidth: 340,
        fontSize: 16,
        // Both callouts name the menu radio (colorBy.tsx); the second is
        // abbreviated to its distinguishing clause to fit the callout. "only"
        // here vs "every CpG" below is the contrast the figure teaches — it's why the
        // island reads empty on this row and blue on the next.
        text: 'One color per modification type: only positions marked in the MM tag',
      },
      {
        // blue is every CpG whose most likely state is unmodified: both the ones
        // the MM tag never called and the ones it called with low probability
        // (reviewer) — the old "CpGs the MM tag left unmodified" claimed only
        // the first.
        type: 'text',
        anchor: {
          selector:
            '[data-testid^="trackRenderingContainer-"][data-testid$="-human_chr20_mod_call_5mC_5hmC_CG_cram"]',
        },
        dx: 250,
        // this callout is 4 lines to the type callout's 1, and an anchored text
        // grows downward from the container's mid-line, so it needs the extra
        // lift to clear the frame bottom. maxWidth keeps the heading on one line.
        dy: -110,
        maxWidth: 340,
        fontSize: 16,
        text: `Plus low-probability & unmodified in blue: every CpG painted

- red = methylated
- blue = low probability or unmarked`,
      },
    ],
  },

  // Phased HG002 ONT reads grouped AND colored by the HP tag (alignments_track.md
  // "Sort, color, and filter by tag"). Replaces a 5-stage menu-walkthrough figure
  // with the single end state: groupBy + colorBy HP splits the pileup into one
  // tinted section per haplotype, so the phased reads read at a glance. Same
  // built-in HP grouping the smalldel figure uses, on the same HG002 ultralong
  // ONT track; userByteSizeLimit lifts the force-load gate, readySelector waits
  // for the pileup canvas to paint.
  {
    mode: 'url',
    name: 'alignments/haplotype',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG002_NANOPORE_HP_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          // tighter window so the per-haplotype split and the phased
          // variant columns read clearly
          loc: '1:63,005,000-63,008,000',
          tracks: [
            {
              trackId: 'hg002_nanopore_hp',
              type: 'LinearAlignmentsDisplay',
              height: 500,
              userByteSizeLimit: 200_000_000,
              groupBy: { type: 'tag', tag: 'HP' },
              colorBy: { type: 'tag', tag: 'HP' },
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="pileup-display-done"]',
    readyTimeout: 90000,
    viewportHeight: 700,
    settleMs: 15000,
  },

  // Companion to alignments/haplotype: shows HOW to reach grouping — the track
  // menu opened at "Group by..." with its submenu expanded (reviewer wanted a
  // separate figure for the menu path). Choosing "Group by..." opens a dialog
  // where the tag (e.g. HP) is entered. Same HG002 ONT track; reads load via
  // userByteSizeLimit, then the menu is driven open and the entry boxed.
  {
    mode: 'url',
    name: 'alignments/haplotype_groupby',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG002_NANOPORE_HP_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:63,005,000-63,008,000',
          tracks: [
            {
              trackId: 'hg002_nanopore_hp',
              type: 'LinearAlignmentsDisplay',
              height: 300,
              userByteSizeLimit: 200_000_000,
              // start ungrouped and uncolored: the figure demonstrates the
              // group-by mechanic itself, so the reads are plain until the
              // dialog is submitted (reviewer: initial state shouldn't already
              // have the color-by/group-by settings applied)
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="pileup-display-done"]',
    readyTimeout: 90000,
    viewportHeight: 550,
    settleMs: 15000,
    hideTooltip: true,
    // Three-stage figure: stage 1 is the menu path (track menu ->
    // Group by... submenu, the inner item boxed); stage 2 is the dialog that item
    // opens, with the Tag dimension chosen and HP entered; stage 3 submits it and
    // shows the RESULT — the pileup split into HP 1 / HP 2 / undefined sections.
    stages: [
      {
        actions: [
          {
            type: 'click',
            selector:
              '[data-testid="track_menu_icon"][data-trackid="hg002_nanopore_hp"]',
          },
          { type: 'waitForText', text: 'Group by...' },
          { type: 'hover', text: 'Group by...' },
          // submenu opened once its items render
          { type: 'waitForText', text: 'Ungroup (this track)' },
          { type: 'delay', ms: 800 },
        ],
        annotations: [{ type: 'box', anchor: { text: 'Group by...' } }],
      },
      {
        actions: [
          // both menu items read "Group by..."; the inner (dialog-opening) one
          // renders later in the DOM, so target the last match by XPath
          {
            type: 'click',
            selector:
              '::-p-xpath((//li[@role="menuitem"][normalize-space(.)="Group by..."])[last()])',
          },
          {
            type: 'waitForText',
            text: 'Renders the reads as stacked sections',
          },
          { type: 'delay', ms: 500 },
          // open the dimension dropdown and pick the Tag option (label has parens
          // /commas that break the text pseudo-selector, so match by XPath)
          { type: 'click', selector: '[role="dialog"] [role="combobox"]' },
          { type: 'delay', ms: 400 },
          {
            type: 'click',
            selector:
              '::-p-xpath(//li[@role="option"][starts-with(normalize-space(.),"Tag")])',
          },
          { type: 'delay', ms: 400 },
          {
            type: 'type',
            selector: '[data-testid="group-tag-name-input"]',
            value: 'HP',
          },
          // let the optional "Found values" tag preview resolve
          { type: 'delay', ms: 1500 },
        ],
      },
      {
        actions: [
          // submit the dialog -> the pileup regroups into HP sections
          {
            type: 'click',
            selector: '[role="dialog"] button[type="submit"]',
          },
          {
            type: 'waitForSelector',
            selector: '[data-testid="pileup-display-done"]',
          },
          { type: 'delay', ms: 2000 },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Alignments track interactions
  // ────────────────────────────────────────────────────────────────────────

  // Compact read drawing on real human data: HG002 Illumina hs37d5 2x250 (high
  // coverage, so the difference compact mode makes is obvious). The display is
  // preset to the compact preset (featureHeight 3 / spacing 0) so the pileup is
  // already drawn compact; the track menu is opened to the "Read height"
  // submenu with the now-active Compact option boxed — i.e. the toggled state and
  // the menu path that sets it, in one figure. Remote DEMO_CONFIG data.
  {
    mode: 'url',
    name: 'alignments/compact',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr1:161,172,613-161,181,745',
      tracks: [
        {
          trackId: 'illumina_hg002',
          type: 'LinearAlignmentsDisplay',
          featureHeight: 3,
          featureSpacing: 0,
        },
      ],
    }),
    readyText: 'HG002',
    readyTimeout: 60000,
    settleMs: 12000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      ...menuCascade(['Read height', 'Compact'], 800),
    ],
    // box both the "Read height" parent submenu and the "Compact" item it opens
    annotations: [
      { type: 'box', anchor: { text: 'Read height' } },
      { type: 'box', anchor: { text: 'Compact' } },
    ],
  },

  // Read connections (arc display): two-stage figure on the volvox-sv CRAM (whose
  // discordant pairs make the arcs meaningful). Top frame: the track menu's "Read
  // connections → Show pair overlay" radio submenu with "Arcs" boxed, drawn over
  // a plain pileup (no arcs yet). Bottom frame: "Arcs" selected, so the arcs
  // render. Cropped to drop the empty viewport below the short track.
  {
    mode: 'url',
    name: 'alignments/select_arc_display',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_sv_cram'],
    }),
    readyText: 'ctgA',
    // shorter viewport (rather than a crop) so the result frame isn't mostly
    // whitespace while still leaving room for the deep "Read connections" submenu
    viewportHeight: 600,
    settleMs: 5000,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Read connections', 'Show read arcs'], 600),
        ],
        // box only the "Show read arcs" checkbox (this figure is
        // specifically about enabling read arcs)
        annotations: [{ type: 'box', anchor: { text: 'Show read arcs' } }],
      },
      {
        // tick the "Show read arcs" checkbox so the result frame shows arcs
        actions: [
          { type: 'click', text: 'Show read arcs' },
          { type: 'delay', ms: 3000 },
        ],
      },
    ],
  },

  // COLO829 tumor nanopore reads colored by base modification (5mC/5hmC) across a
  // UCSC CpG island on chr20 (use COLO829_tumor.ht at a CpG island + add
  // a CpG island track). Declarative `colorBy: {type:'modifications'}` — the same
  // state the track menu's Color by → Modifications → Type
  // applies — because driving that 3-level hover menu live is unreliable over the
  // COLO829 GPU display (its mod-data load keeps repainting the canvas, which
  // closes the MUI menu mid-cascade). userByteSizeLimit auto-loads the reads.
  {
    mode: 'url',
    name: 'alignments/modifications1',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr20:18,493,346-18,511,070',
      tracks: [
        'cpgisland_ucsc_hg38',
        {
          trackId: 'COLO829_tumor.ht',
          colorBy: { type: 'modifications' },
          // legend is opt-in now; this teaching figure explicitly shows
          // the 5mC/5hmC color key
          showLegend: true,
          userByteSizeLimit: 100_000_000,
        },
      ],
    }),
    readyText: 'COLO829',
    readyTimeout: 60000,
    settleMs: 35000,
    // colorBy:modifications is set declaratively so the mod data is already
    // loaded and painted by the time the menu opens. Then drive the live Color
    // by → Modifications → One color per modification type path so the figure
    // shows the menu route, not just the result (reviewer asked to actually open
    // the menu). The MM/ML modes live in a "Modifications" submenu with two
    // radios ("One color per modification type" / "One color per type, plus
    // low-probability & unmodified in blue"); the per-type filter, threshold
    // slider and
    // cytosine context sit flat beneath them (no dialog). The selector is scoped
    // by data-trackid to the COLO829 alignments track — the bare track_menu_icon
    // matched the CpG-island feature track first, whose Color by menu has no
    // modifications options.
    actions: [
      {
        type: 'click',
        selector:
          '[data-testid="track_menu_icon"][data-trackid="COLO829_tumor.ht"]',
      },
      ...menuCascade(
        ['Color by...', 'Modifications', 'One color per modification type'],
        800,
      ),
    ],
    annotations: cascadeBoxes([
      'Color by...',
      'Modifications',
      'One color per modification type',
    ]),
  },

  // ────────────────────────────────────────────────────────────────────────
  // RNA-seq tutorial screenshots (use hg19 ACTB region from DEMO_CONFIG)
  // ────────────────────────────────────────────────────────────────────────

  // Whole-gene overview: coverage histogram, strand-colored splice arcs, and the
  // spliced read pileup over ACTB — the anchor figure for "what RNA-seq looks
  // like". minSashimiScore 3 drops the low-support aligner-noise arcs (see
  // compact_stacked below for the rationale).
  {
    mode: 'url',
    name: 'rnaseq/basic',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,567,000-5,570,000',
      trackLabels: 'offset',
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          type: 'LinearAlignmentsDisplay',
          coverageHeight: 120,
          height: 460,
          maxHeight: 2000,
          minSashimiScore: 3,
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 15000,
    viewportHeight: 700,
  },

  // Compact read drawing mode: featureHeight 3 / spacing 0 packs the full ACTB
  // read stack into view, with maxHeight raised so the whole pileup renders
  // instead of clipping at "Max layout height reached" — that full, dense stack
  // (deep = highly expressed) is the point compact mode makes, and what the
  // reviewer found unclear at the default maxHeight.
  {
    mode: 'url',
    name: 'rnaseq/compact_stacked',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,566,500-5,570,500',
      // offset labels so they overlay the tracks
      trackLabels: 'offset',
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          type: 'LinearAlignmentsDisplay',
          featureHeight: 3,
          featureSpacing: 0,
          maxHeight: 2000,
          // taller SNPCoverage band + shorter pileup viewport + shorter
          // browser: coverageHeight is the LinearAlignmentsDisplay
          // coverage band, the pileup viewport = height - coverageHeight
          coverageHeight: 120,
          height: 420,
          // ACTB's real minus-strand introns have 449/290/29/27/4 reads;
          // the spurious forward-strand sashimi arcs are single-/2-read
          // aligner noise (correct XS-tag strand, just low support). A
          // min-support of 3 drops the noise, keeps the real junctions.
          minSashimiScore: 3,
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 15000,
    viewportHeight: 650,
  },

  // Long-read IsoSeq RNA-seq at ACTB.
  {
    mode: 'url',
    name: 'rnaseq/longread_isoseq',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,566,000-5,571,000',
      // offset labels so they overlay the tracks
      trackLabels: 'offset',
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'hg_isoforms.fasta_bam',
          // taller SNPCoverage band: coverageHeight is the
          // LinearAlignmentsDisplay coverage-track height (default 45).
          // super-compact featureHeight=1 so every isoform read
          // stacks in view instead of hitting "Max layout height reached".
          type: 'LinearAlignmentsDisplay',
          coverageHeight: 120,
          height: 620,
          featureHeight: 1,
          featureSpacing: 0,
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 15000,
    // tall enough for the 620px compact pileup + the coverage band + chrome
    viewportHeight: 900,
  },

  // Strand-specific RNA-seq at the surfeit locus — the most tightly-packed gene
  // cluster in the vertebrate genome, with genes on alternating strands
  // (RPL7A +, SURF1 -, SURF2 +, SURF4 -) sharing bidirectional promoters.
  // colorBy firstOfPairStrand colors each read pair by its fragment strand, so
  // the strongly-transcribed RPL7A reads are all one color even though SURF1
  // sits immediately downstream on the opposite strand — the per-read strand is
  // exactly what assigns each read to the correct gene when transcripts abut or
  // overlap. The reads are already colored by firstOfPairStrand in the session
  // (so the auto-appended live "Open in JBrowse" link opens the colored view —
  // don't move this to a menu-click-only stage, which would leave the live link
  // uncolored), and the track menu is opened over them along Color by... →
  // Paired end → First of pair strand (boxed, and shown checked) so the one
  // frame teaches both the menu path and its result.
  {
    mode: 'url',
    name: 'rnaseq/strand_specific',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr9:136,214,000-136,229,000',
      trackLabels: 'offset',
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          type: 'LinearAlignmentsDisplay',
          colorBy: { type: 'firstOfPairStrand' },
          coverageHeight: 110,
          height: 460,
          maxHeight: 2000,
          minSashimiScore: 3,
        },
      ],
    }),
    readyText: 'RPL7A',
    readyTimeout: 60000,
    settleMs: 15000,
    viewportHeight: 760,
    hideTooltip: true,
    actions: [
      trackMenuIcon('Pairend_StrandSpecific_51mer_Human_hg19'),
      ...menuCascade(['Color by...', 'Paired end', 'First of pair strand']),
    ],
    annotations: cascadeBoxes([
      'Color by...',
      'Paired end',
      'First of pair strand',
    ]),
  },
]
