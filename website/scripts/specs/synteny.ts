import {
  CGIAB_HAP1_PIF_TRACK,
  DOTPLOT_CONFIG,
  HS1_MM39_CONFIG,
  PICALM_ALU_LOCUS,
  VAPB_SVA_LOCUS,
  VOLVOX,
  cgiabUrl,
  hg38ChimpSynteny,
  hpyloriSyntenyWithGenes,
  hpyloriUrl,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

export const syntenySpecs: ScreenshotSpec[] = [
  // Human vs chimp synteny (hosted liftOver chain, zoomed to an RB1 intron with
  // a human-specific L1HS insertion). 'full' cigarMode paints the indel as a
  // colored wedge. Also guards the oversized-block viewport clip — a
  // chromosome-scale block must render at high zoom instead of a blank canvas.
  {
    mode: 'url',
    name: 'synteny_human_chimp_cigar_modes',
    url: hg38ChimpSynteny('full'),
    viewportWidth: 1200,
    viewportHeight: 850,
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 12000,
  },
  // Second human-specific-TE example: an SVA_F retrotransposon inserted in VAPB.
  {
    mode: 'url',
    name: 'synteny_te_vapb_sva',
    url: hg38ChimpSynteny('full', VAPB_SVA_LOCUS),
    viewportWidth: 1200,
    viewportHeight: 850,
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 12000,
  },
  // Third human-specific-TE example: a small AluYb8 insertion in PICALM.
  // PICALM has many RefSeq isoforms — superCompact keeps the gene lanes from
  // dwarfing the ~0.3 kb insertion.
  {
    mode: 'url',
    name: 'synteny_te_picalm_alu',
    url: hg38ChimpSynteny('full', PICALM_ALU_LOCUS),
    viewportWidth: 1200,
    viewportHeight: 850,
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  {
    mode: 'url',
    name: 'dotplot',
    // use the full peach_grape.paf (grape_peach_paf), not the small in-repo paf
    // that the config defaultSession loads
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
          tracks: ['grape_peach_paf'],
        },
      ],
    }),
    readySelector: '[data-testid="dotplot_webgl_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 8000,
  },

  {
    mode: 'url',
    name: 'linear_synteny',
    // Whole-genome grape vs peach MCScan synteny as an explicit controlled
    // session (was a reviewer share link whose mismatched per-panel zoom fanned
    // ribbons far off the left edge — the "drawing offscreen" the review
    // flagged). Both panels span their full assemblies at matched scale, so the
    // ribbons stay inside the view. Per-query color plus a higher alpha and a
    // taller synteny band keep the straight ribbons legible.
    url: sessionSpec('test_data/config_dotplot.json', {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['grape_peach_synteny_mcscan'],
          drawCurves: false,
          colorBy: 'query',
          // higher alpha + a taller synteny band give the ribbons room to read,
          // and autoDiagonalize reorders the panels into clean diagonals
          // (increase height, add opacity, diagonalize; then opacity
          // bumped a little more). levelHeights (not a `levels` snapshot) is the
          // key the launch init consumes.
          alpha: 0.8,
          levelHeights: [360],
          autoDiagonalize: true,
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
        },
      ],
    }),
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 10000,
  },

  // Multi-way synteny demos: grape_peach_cacao for the multiway_synteny.md
  // (ortholog tables) tutorial, ecoli_pangenome for the allvsall_synteny.md
  // tutorial. Both load a
  // hosted demo config (whose defaultSession opens the stacked LinearSyntenyView)
  // as a bare ?config= against the local build, since MCScanBlocksAdapter /
  // AllVsAllPAFAdapter are newer than jbrowse.org/code/jb2/latest. Generous
  // timeout/settle: the config pulls remote genomes + a synteny file and
  // autoDiagonalize runs a whole-genome RPC before the canvas settles.
  {
    mode: 'url',
    name: 'multiway_synteny/grape_peach_cacao',
    // Rows peach / cacao / grape. One grape_peach_cacao_blocks track (listing
    // all three assemblies) backs both bands — the view tells the adapter which
    // pair each band draws. colorBy:'reference' anchors every level on the
    // middle row (cacao, shared by both bands) so a cacao chromosome carries ONE
    // color as it's traced up into peach and down into grape. autoDiagonalize
    // reorders/flips each lower axis to follow the one above.
    //
    // This order is deliberate: diagonalize cascades top-down (each level
    // reorders its lower axis against the row above), and it can only clean a
    // pair with ~1:1 chromosome correspondence. cacao-grape is that pair, so it
    // goes LAST (bottom) where nothing downstream re-scrambles it → a clean
    // diagonal band. The top peach-cacao band is transitive (peach and cacao
    // relate only through the grape MCScan reference) AND cross-karyotype
    // (peach 8 / grape 19 / cacao 10 chr), so it stays busy — but its
    // chromosomes ARE now ordered to minimize crossing (cacao is reordered
    // against peach at level 0). This previously looked un-diagonalized because
    // runDiagonalize fetched without a targetAssemblyName, so the multi-genome
    // MCScanBlocksAdapter defaulted the mate to grape and reordered cacao
    // against the wrong (peach-grape) band — leaving cacao in raw fai order.
    // Mirrors the hosted config's defaultSession init otherwise.
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/grape_peach_cacao/config.json',
      ),
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              { assembly: 'peach' },
              { assembly: 'cacao' },
              { assembly: 'grape' },
            ],
            tracks: [
              ['grape_peach_cacao_blocks'],
              ['grape_peach_cacao_blocks'],
            ],
            colorBy: 'reference',
            autoDiagonalize: true,
          },
        ],
      },
    ),
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 15000,
  },

  // Gene-level ortholog zoom: drill into a ~75 kb window of the conserved
  // block (grape 11 / peach G7 / cacao IX) where 10 consecutive orthologous
  // genes step monotonically across all three genomes. showOnlyGenes collapses
  // each locus to its gene glyph, and compact displayMode packs the rows so the
  // synteny ribbons connect individual orthologs one-to-one. All three run in
  // the same (forward) orientation, so no [rev] flips are needed.
  {
    mode: 'url',
    name: 'multiway_synteny/grape_peach_cacao_gene_orthologs',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/grape_peach_cacao/config.json',
      ),
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              {
                assembly: 'peach',
                loc: 'G7:19,290,000-19,362,000',
                tracks: [
                  {
                    trackId: 'peach_genes',
                    showOnlyGenes: true,
                    displayMode: 'compact',
                    showDescriptions: false,
                  },
                ],
              },
              {
                assembly: 'grape',
                loc: '11:1,840,000-1,927,000',
                tracks: [
                  {
                    trackId: 'grape_genes',
                    showOnlyGenes: true,
                    displayMode: 'compact',
                    showDescriptions: false,
                  },
                ],
              },
              {
                assembly: 'cacao',
                loc: 'IX:4,665,000-4,743,000',
                tracks: [
                  {
                    trackId: 'cacao_genes',
                    showOnlyGenes: true,
                    displayMode: 'compact',
                    showDescriptions: false,
                  },
                ],
              },
            ],
            tracks: [
              ['grape_peach_cacao_blocks'],
              ['grape_peach_cacao_blocks'],
            ],
            drawCurves: true,
            colorBy: 'reference',
          },
        ],
      },
    ),
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 12000,
  },
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_pangenome',
    // colorBy:'default' (not 'query'): these are single-chromosome strains, so
    // per-query-name coloring paints everything one near-uniform color and adds
    // no signal (query-name coloring is only useful with multiple
    // chromosomes). Default red ribbons read cleaner here.
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/ecoli_pangenome/config.json',
      ),
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              { assembly: 'K12' },
              { assembly: 'Sakai' },
              { assembly: 'CFT073' },
              { assembly: 'NCTC86' },
            ],
            // one all-vs-all track backs every band (lists all four assemblies)
            tracks: [['ecoli_ava'], ['ecoli_ava'], ['ecoli_ava']],
            drawCurves: false,
            colorBy: 'default',
            // drop short minimap2 alignments so the shared backbone reads as
            // clean ribbons instead of a dense noise band
            minAlignmentLength: 10000,
          },
        ],
      },
    ),
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 15000,
  },

  // The "Add gene tracks" payoff for allvsall_synteny.md: what a ribbon gap
  // actually contains. Two rows (K12 over Sakai) at the Sp5 prophage that
  // carries stx2A/stx2B (Sakai chr:1,267,107-1,268,347).
  //
  // The loci are not a free choice — they are read off the PAF. One 35 kb block
  // (Sakai 1,210,882-1,246,166 <-> K12 1,031,619-1,067,671, 1:1) is the shared
  // backbone; it ends at Sakai 1,246,166 and nothing from Sakai 1,252,260 to
  // 1,274,685 aligns to K-12 at all. So the K12 window is placed to end just
  // past where that block runs out: the ribbon enters from the left, stops, and
  // the stx2 genes sit in the bare stretch beyond it with no ribbon above them.
  // (The island's own far flanks align to K12 ~566 kb, a different locus — the
  // prophage inserted into a rearranged site — which is why this frames the
  // backbone block rather than the flanks.)
  //
  // showOnlyGenes drops the CDS lanes and the full-width `region` feature that
  // RefSeq GFFs carry for the whole chromosome. No minAlignmentLength: at this
  // zoom the short alignments are signal, not noise.
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_stx_island',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/ecoli_pangenome/config.json',
      ),
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              {
                assembly: 'K12',
                loc: 'chr:1,044,000-1,078,000',
                tracks: [
                  {
                    trackId: 'K12_genes',
                    showOnlyGenes: true,
                    displayMode: 'compact',
                    showDescriptions: false,
                  },
                ],
              },
              {
                assembly: 'Sakai',
                loc: 'chr:1,220,000-1,290,000',
                tracks: [
                  {
                    trackId: 'Sakai_genes',
                    showOnlyGenes: true,
                    displayMode: 'compact',
                    showDescriptions: false,
                  },
                ],
              },
            ],
            tracks: [['ecoli_ava']],
            drawCurves: true,
            colorBy: 'default',
          },
        ],
      },
    ),
    viewportHeight: 560,
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 15000,
  },

  // The Linear synteny view import form for the allvsall_synteny.md "From the
  // UI" section, using the all-vs-all Quick start path. A bare LinearSyntenyView
  // session spec is rejected (needs >=2 views), so open it the way a user does:
  // load the ecoli_pangenome demo config with no views, then Add -> Linear
  // synteny view -> an empty view that lands on the import form. The form opens
  // in Quick start with the config's synteny track already selected, so the rows
  // it implies are on screen immediately: one single-stage figure, no
  // menu-driving, annotating the three things the tutorial names (the mode
  // toggle, the track, the rows it fills) plus Launch.
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_import_form',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/ecoli_pangenome/config.json',
      ),
      { views: [] },
    ),
    readyText: 'Select a view to launch',
    readyTimeout: 60000,
    settleMs: 1000,
    // Quick start is a short form (a select, the rows it implies, Launch), so
    // this is sized to the form rather than the taller manual row stack
    viewportHeight: 340,
    actions: [
      { type: 'click', text: 'Add' },
      { type: 'waitForText', text: 'Linear synteny view' },
      { type: 'click', text: 'Linear synteny view' },
      // the rows summary only renders once a track is selected, so waiting on it
      // is a real readiness signal rather than a duration guess
      {
        type: 'waitForSelector',
        selector: '[data-testid="quick-start-rows"]',
      },
      { type: 'delay', ms: 1000 },
    ],
    annotations: [
      {
        type: 'text',
        text: 'Quick start launches straight from a synteny track',
        x: 780,
        y: 95,
        maxWidth: 320,
      },
      {
        type: 'arrow',
        from: { x: 770, y: 110 },
        anchor: { text: 'Quick start' },
      },
      // box the rows the chosen track fills in (reviewer)
      {
        type: 'box',
        anchor: { selector: '[data-testid="quick-start-rows"]' },
      },
      {
        type: 'text',
        text: 'Every assembly in the track becomes a row, then Launch',
        x: 780,
        y: 205,
        maxWidth: 340,
      },
      {
        type: 'arrow',
        from: { x: 770, y: 235 },
        anchor: { text: 'Launch' },
      },
    ],
  },

  // For the gallery: load the exact curated share session the reviewer wants
  // captured verbatim (peach Pp05 vs grape chr2 with the per-gene MCScan
  // connections + the red/blue inverted-vs-non-inverted synteny blocks). The
  // bare ?config= url is served against the local build; the password param
  // auto-decrypts the shared session so it loads with no interaction. The
  // docs live-link becomes the same query on jbrowse.org/code/jb2/latest.
  {
    mode: 'url',
    name: 'linear_synteny_gallery',
    url: '?config=test_data%2Fconfig_dotplot.json&session=share-4MjF5YGM_G&password=rByjt',
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 10000,
  },

  // Whole-genome human (hs1/T2T-CHM13) vs mouse (mm39) synteny, mirroring the
  // hs1_vs_mm39 config defaultSession: 500k minlen drops short-alignment
  // hairball noise, autoDiagonalize reorders mm39 chroms into clean diagonals,
  // and low alpha + per-query coloring give legible straight ribbons
  // (matches data/hs1ToMm39/ribbon-500k.png reference). Remote UCSC liftOver PIF
  // + two 2bit genomes, so allow a long ready/settle.
  {
    mode: 'url',
    name: 'hs1_vs_mm39_synteny',
    url: sessionSpec(HS1_MM39_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['hs1ToMm39.over.chain.pif'],
          minAlignmentLength: 500000,
          drawCurves: false,
          autoDiagonalize: true,
          colorBy: 'query',
          alpha: 0.4,
          levelHeights: [350],
          views: [{ assembly: 'hs1' }, { assembly: 'mm39' }],
        },
      ],
    }),
    readySelector: '[data-testid="synteny_canvas_done"]',
    // autoDiagonalize holds the synteny canvas (and thus synteny_canvas_done)
    // off-screen until the diagonalize RPC lands and the reorder is applied, so
    // the canvas only ever appears in its final diagonalized state. The remote
    // 2bit genomes + S3 PIF make that whole-genome fetch slow, so allow
    // generous headroom.
    readyTimeout: 180000,
    settleMs: 15000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/dotplot_result',
    // The cgiab config ships this synteny track with a plain PAFAdapter pointed
    // at a .pif.gz — but PAFAdapter doesn't strip the PIF q/t refName prefixes,
    // so every feature's refName ("qhaplotype1-…") fails to match the assembly
    // refName ("haplotype1-…") and the dotplot renders empty. Override the track
    // with the correct PairwiseIndexedPAFAdapter (tabix .pif.gz) so the dots paint.
    url: cgiabUrl({
      sessionTracks: [CGIAB_HAP1_PIF_TRACK],
      views: [
        {
          type: 'DotplotView',
          // GRCh38 on x (stays in its natural chr1->chrX order) and the
          // fragmented HG008T.hap1 assembly on y: autoDiagonalize reorders the
          // vertical axis, so putting the assembly there reorders/flips its
          // contigs to form a clean diagonal against a readable reference axis.
          // (Reordering the reference axis instead scrambles the familiar
          // chromosome order and breaks the single diagonal into a staircase.)
          views: [{ assembly: 'GRCh38_GIABv3' }, { assembly: 'HG008T.hap1' }],
          tracks: ['HG008T.hap1_pif'],
          autoDiagonalize: true,
        },
      ],
    }),
    readySelector: '[data-testid="dotplot_webgl_canvas_done"]',
    readyTimeout: 90000,
    viewportWidth: 1800,
    // gate on the WebGL canvas `settled` test-id (canvas painted + no display
    // still fetching), then settle long for the heavy whole-genome PIF fetch to
    // paint its dots. (A `readyText: 'chr1'` gate is unreliable here: the axis
    // labels wrap their refName in an SVG <title>, and puppeteer's ::-p-text
    // matches that non-rendered <title> element, which fails the visible: true
    // wait — plus substrings like the chr1_..._random contig collide.)
    settleMs: 60000,
  },

  // The dotplot import form with HG008T.hap1 on one axis and GRCh38 on the other
  // (tutorial caption). An empty DotplotView (views:[{},{}]) shows the form; both
  // selectors default to the config's first assembly (GRCh38_GIABv3), so open the
  // first (x-axis) selector and pick HG008T.hap1. Replaces a stale hand-made
  // capture that showed unrelated generic assembly names. Selecting via the UI
  // (not pre-setting assemblies in the snapshot) keeps the form open — pre-set
  // assemblies auto-launch the view.
  {
    mode: 'url',
    name: 'sv_cgiab/dotplot_import_form',
    url: cgiabUrl({ views: [{ type: 'DotplotView', views: [{}, {}] }] }),
    // the cgiab config has synteny tracks, so the form opens in Quick start;
    // this figure is about picking the two assemblies, which is Manual
    readyText: 'Quick start',
    readyTimeout: 60000,
    settleMs: 3000,
    viewportWidth: 1500,
    // tall enough to include the optional synteny-track row below the assembly
    // selectors and the full wrapped helper text
    viewportHeight: 400,
    actions: [
      // Manual inherits Quick start's track, so the axes already read
      // HG008T.hap1 / GRCh38_GIABv3 with the synteny track selected — exactly
      // the pairing this figure wants. No menu-driving needed to set them.
      { type: 'click', text: 'Manual' },
      { type: 'waitForText', text: 'Select assemblies for dotplot view' },
      { type: 'delay', ms: 1000 },
    ],
  },

  {
    mode: 'url',
    name: 'sv_cgiab/synteny_view',
    // Same fix as sv_cgiab/dotplot_result: the config's plain PAFAdapter can't
    // strip the PIF q/t refName prefixes, so ribbons never map. Override with
    // PairwiseIndexedPAFAdapter. hap1 contigs 16 (↔chr3, ↔chr13) and 11 (↔chr13)
    // are the ones that actually align to the displayed GRCh38 chromosomes, so
    // the ribbons connect (contig 15 maps to chr1/chr5, not shown here).
    url: cgiabUrl({
      sessionTracks: [CGIAB_HAP1_PIF_TRACK],
      views: [
        {
          type: 'LinearSyntenyView',
          // curved ribbons (drawCurves is a LinearSyntenyView-level property) so
          // the connections read clearly. Renders against the local
          // build (cgiabUrl is now a bare ?config= url) so drawCurves is honored
          // — the published jb2/latest release predates it.
          drawCurves: true,
          // taller synteny band (LinearSyntenyViewHelper.height, default 100) so
          // the ribbons have room to spread out. NB the launch init
          // handler consumes `levelHeights`, not a `levels` snapshot — the
          // latter is silently dropped, which is why the band stayed short.
          levelHeights: [260],
          // drop short noisy alignments and lighten the ribbons so the dense
          // "dark areas" (many overlapping anchors stacking opacity into solid
          // fans) read as clean syntenic blocks
          minAlignmentLength: 50000,
          alpha: 0.2,
          tracks: ['HG008T.hap1_pif'],
          views: [
            {
              loc: 'chr3:1-198295559 chr13:1-114364328',
              assembly: 'GRCh38_GIABv3',
            },
            {
              loc: 'haplotype1-0000016:1-212902875 haplotype1-0000011:1-99479325',
              assembly: 'HG008T.hap1',
            },
          ],
        },
      ],
    }),
    readyText: 'chr3',
    readyTimeout: 90000,
    viewportWidth: 1800,
    // fit the taller curved synteny band + both LGV panels without a tall
    // white margin
    viewportHeight: 620,
    // giant remote assembly PAF; synteny_canvas_done can exceed 90s, so settle
    // long rather than gate on it
    settleMs: 45000,
  },

  // H. pylori synteny tutorial (synteny_visualization.md) — live hpylori demo

  {
    mode: 'url',
    // assemblies intentionally not pre-set: supplying them auto-launches the
    // DotplotView, but this tutorial image is specifically the import form
    name: 'sv_synteny/dotplot_import',
    url: hpyloriUrl({ views: [{ type: 'DotplotView', views: [{}, {}] }] }),
    // the hpylori config has synteny tracks, so the form opens in Quick start;
    // this tutorial is specifically about choosing each axis, so switch to
    // Manual rather than capture a mode the surrounding prose doesn't describe
    readyText: 'Quick start',
    readyTimeout: 60000,
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'Manual' },
      { type: 'waitForText', text: 'Select assemblies for dotplot view' },
      { type: 'delay', ms: 1000 },
    ],
    // No callouts: the import form already labels its two selectors ("x-axis
    // assembly"/"y-axis assembly"), and which assembly goes on which axis is
    // arbitrary here (the old "query"/"target" framing was a track-level
    // distinction the view doesn't impose), so added annotations only mislead
  },

  {
    mode: 'url',
    name: 'sv_synteny/dotplot',
    url: hpyloriUrl({
      views: [
        {
          type: 'DotplotView',
          tracks: ['26695_vs_j99.pif'],
          // Axis order matches what the import form's Quick start produces for
          // this track, so the tutorial's click-path lands on this exact plot:
          // assemblyNames is [query, target] = [j99, 26695], and a dotplot puts
          // query on y / target on x. hview is views[0], vview is views[1].
          views: [{ assembly: 'hpylori_26695' }, { assembly: 'hpylori_j99' }],
        },
      ],
    }),
    settleMs: 18000,
  },

  {
    mode: 'url',
    name: 'sv_synteny/linear_synteny_genes',
    url: hpyloriSyntenyWithGenes(),
    readyText: 'NC_018939.1',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  // ────────────────────────────────────────────────────────────────────────
  // Dotplot / synteny interactions
  // ────────────────────────────────────────────────────────────────────────

  // Dotplot launch, two-stage figure: top frame opens the app "Add" menu with
  // "Dotplot view" boxed; bottom frame is the import form it opens (launched
  // from an empty session so only the import form shows, no leftover LGV).
  // Replaces the old separate dotplot_menu screenshot. Narrow window + height
  // crop keep the figure tight on the menu and form.
  {
    mode: 'url',
    name: 'dotplot_add',
    url: sessionSpec(VOLVOX, { views: [] }),
    readyText: 'Select a view to launch',
    viewportWidth: 900,
    settleMs: 2000,
    // slightly shorter crop for both frames
    crop: { x: 0, y: 0, width: 900, height: 460 },
    stages: [
      {
        actions: [
          { type: 'click', text: 'Add' },
          { type: 'waitForText', text: 'Dotplot view' },
          { type: 'delay', ms: 500 },
        ],
        // box the Add menu button as well as the Dotplot view item
        annotations: [
          { type: 'box', anchor: { text: 'Add' } },
          { type: 'box', anchor: { text: 'Dotplot view' } },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Dotplot view' },
          // volvox has synteny tracks, so the form opens in Quick start; this
          // figure is about picking assemblies by hand, which is Manual
          { type: 'waitForText', text: 'Quick start' },
          { type: 'click', text: 'Manual' },
          { type: 'waitForText', text: 'Select assemblies for dotplot view' },
          { type: 'delay', ms: 1500 },
        ],
      },
    ],
  },

  // Two-stage figure: (top) dotplot drag-selection context menu showing "Open
  // linear synteny view", (bottom) the linear synteny view it launches.
  // Uses the curated MCScan anchor tracks (the same pair the linear_synteny
  // figure uses) rather than the raw grape_peach_paf. A small drag-selection
  // over one diagonal block in the lower-left (peach Pp01 vs grape chr1) launches
  // a legible synteny view instead of the whole-genome criss-cross the reviewer
  // rejected.
  {
    mode: 'url',
    name: 'synteny_from_dotplot_view',
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
          tracks: [
            'grape_peach_synteny_mcscan',
            'grape_peach_synteny_mcscan_simple',
          ],
        },
      ],
    }),
    readySelector: '[data-testid="dotplot_webgl_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 5000,
    actions: [
      // small rubberband-drag over a single diagonal block in the lower-left
      // (a focused subsection, not the whole region — reviewer; ~75% of the
      // previous drag span, centered on the same block)
      { type: 'drag', from: { x: 126, y: 259 }, to: { x: 224, y: 311 } },
      { type: 'waitForText', text: 'Open linear synteny view' },
      { type: 'delay', ms: 1000 },
    ],
    stages: [
      // top frame: the context menu left open by the shared actions above
      {},
      // bottom frame: launch the linear synteny view, close the now-redundant
      // dotplot view (views[0], so the first close_view button) and let it draw
      {
        actions: [
          { type: 'click', text: 'Open linear synteny view' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="synteny_canvas_done"]',
          },
          { type: 'delay', ms: 2000 },
          { type: 'click', selector: '[data-testid="close_view"]' },
          { type: 'delay', ms: 2000 },
        ],
      },
    ],
  },
  {
    mode: 'url',
    name: 'gallery/yeast_dotplot',
    url: sessionSpec('test_data/yeast_synteny/config.json', {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'R64' }, { assembly: 'YJM1447' }],
          tracks: ['dotplot_track'],
          autoDiagonalize: true,
        },
      ],
    }),
    readySelector: '[data-testid="dotplot_webgl_canvas_done"]',
    readyTimeout: 90000,
    settleMs: 10000,
  },
]
