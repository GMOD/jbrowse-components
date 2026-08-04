import {
  CGIAB_ASM_PIF_TRACK,
  DOTPLOT_CONFIG,
  HG38_HS1_CONFIG,
  HS1_MM39_CONFIG,
  PICALM_ALU_LOCUS,
  UCSC_HG38_CONFIG,
  VAPB_SVA_LOCUS,
  VOLVOX,
  cgiabUrl,
  hg38ChimpSynteny,
  hpyloriSyntenyWithGenes,
  hpyloriUrl,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'
import { ECOLI_DEMO_BASE } from './demoBase.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// PAR1 through the end of the euchromatic male-specific region of T2T chrY,
// which is what the self-alignment covers (Yq12 beyond it is DYZ satellite).
const CHRY_MSY_LOCUS = 'chrY:2,700,000-26,600,000'

// hg38 vs T2T-CHM13 (hs1) at TNNT3, the locus the genomes.jbrowse.org demo
// session parks on. `view` carries the ribbon-drawing settings that differ
// between the default figure and the curved/transparent-indel one.
function tnnt3Session(view: Record<string, unknown> = {}) {
  return sessionSpec(HG38_HS1_CONFIG, {
    views: [
      {
        type: 'LinearSyntenyView',
        colorBy: 'strand',
        tracks: [['hg38_hs1_synteny']],
        ...view,
        views: [
          {
            assembly: 'hg38',
            loc: 'chr11:1,881,000-1,955,000',
            tracks: [{ trackId: 'hg38-genes', geneGlyphMode: 'longestCoding' }],
            trackLabels: 'offset',
          },
          {
            // same window shifted by the +83.7 kb hg38->hs1 offset the demo
            // session's two views were parked at, so the two panels frame the
            // same genes
            assembly: 'hs1',
            loc: 'chr11:1,964,700-2,038,700',
            // the hs1 GFF is RefSeq All plus regulatory/"biological region"
            // features, so showOnlyGenes is what makes it read like the
            // curated hg38 track above
            tracks: [
              {
                trackId: 'hs1-genes',
                geneGlyphMode: 'longestCoding',
                showOnlyGenes: true,
              },
            ],
            trackLabels: 'offset',
          },
        ],
      },
    ],
  })
}

// Genes over repeats in each panel of the finished FTO comparison, one entry per
// track. RefSeq Curated is the same gene track (and the same longest-isoform
// glyph) the LGV the launch came from is showing, and the human pair matches
// what that view's tracks were copied into the anchor panel as — so the two
// bottom frames differ in the chimp panel and nothing else.
//
// The heights are the figure's, which is the point of declaring this frame
// rather than clicking it together: pinned, they hold the two frames to roughly
// one height instead of the default four times over. Repeat labels stay ON here
// (they are off in the launching view, which is 4x this window): at 18 kb this
// interval holds a dozen elements, and the name on the one in the gap is what
// makes the figure's claim checkable rather than asserted.
const FTO_PANEL_TRACKS = {
  hg38: [
    {
      trackId: 'hg38-ncbiRefSeqCurated',
      geneGlyphMode: 'longestCoding',
      height: 60,
    },
    {
      trackId: 'hg38-rmsk',
      displayMode: 'compact',
      height: 72,
    },
  ],
  // `panTro6-ncbiRefSeq`, not the Curated track the human panel uses: RefSeq
  // Curated is a human-first product and chimp's copy of it is sparse enough to
  // leave this window empty, which would put a blank lane opposite FTO.
  panTro6: [
    {
      trackId: 'panTro6-ncbiRefSeq',
      geneGlyphMode: 'longestCoding',
      height: 60,
    },
    {
      trackId: 'panTro6-rmsk',
      displayMode: 'compact',
      height: 72,
    },
  ],
}

// shared framing for the TNNT3 figures: remote 2bit genomes + hosted PIF/GFF,
// so allow headroom, and equal heights so the two-part stack is clean
const TNNT3_FRAME = {
  mode: 'url' as const,
  viewportWidth: 1200,
  viewportHeight: 520,
  readySelector: '[data-testid="synteny_canvas_done"]',
  readyTimeout: 120000,
  settleMs: 12000,
}

// The two files one MCScan run writes, each drawn on its own and stacked into
// one figure. Same window and same view settings in both parts, so the only
// variable is which file the adapter is reading: `.anchors` puts a ribbon on
// every orthologous gene pair, `.anchors.simple` puts one ribbon on each block
// those pairs make up. The tutorial stated that difference in prose and showed
// one figure with both tracks on at once, where neither is separable.
//
// The window is a run of seven consecutive MCScan blocks, read out of the
// .anchors.simple file itself: grape chr9 56,558-7,626,065 against peach Pp03
// 2,204,428-6,833,100, five collinear and two inverted, in the same order on
// both genomes. A window of ONE block — which this figure used to frame — makes
// `.anchors.simple` a single ribbon spanning the entire band, i.e. a solid slab
// with nothing to compare it against; seven blocks separated by gaps are seven
// ribbons, which is what "one ribbon per block" means. Straight ribbons, not
// curved: within a collinear block a curve only bows a flat correspondence.
//
// Neither panel carries a track: the subject is the ribbon band, so
// collapseEmptyRows drops each row to its scalebar rather than a "No tracks
// active" block.
function mcscanFilePartSpecs(): ScreenshotSpec[] {
  // The second frame draws BOTH files on the one synteny level, per review
  // ("both tracks blended"). That reads only because the window holds several
  // blocks: the view's 0.2 alpha makes each block a pale trapezoid, and the gene
  // ribbons it was built from paint darker inside it, with the between-block
  // gaps left empty by the .simple file but crossed by stray single anchors.
  // Blocks first in the level so the gene threads land on top of them.
  const part = (name: string, trackIds: string[], label: string) => ({
    mode: 'url' as const,
    name,
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: [trackIds],
          drawCurves: false,
          levelHeights: [260],
          collapseEmptyRows: true,
          views: [
            {
              assembly: 'grape',
              loc: 'chr9:1-7,700,000',
              tracks: [],
            },
            {
              assembly: 'peach',
              loc: 'Pp03:2,100,000-6,900,000',
              tracks: [],
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 8000,
    // two collapsed scalebar rows around one 260px band
    viewportHeight: 445,
    annotations: [
      {
        type: 'text' as const,
        x: 24,
        y: 56,
        fontSize: 22,
        maxWidth: 700,
        text: label,
      },
    ],
  })
  return [
    part(
      'mcscan_synteny/anchors',
      ['grape_peach_synteny_mcscan'],
      '.anchors open; one ribbon per gene pair',
    ),
    part(
      'mcscan_synteny/anchors_simple',
      ['grape_peach_synteny_mcscan_simple', 'grape_peach_synteny_mcscan'],
      '.anchors and .anchors.simple open; one ribbon per gene\nrendered on top of chained synteny blocks',
    ),
  ]
}

// The three frames of the "launch a synteny view from a selection" flow, all
// starting from the same one-vs-all lane session and the same rubberband drag
// over ~chr:800,000-808,000 of its 20 kb window. Each frame carries the actions
// of the ones before it (a capture is one page load, so a later frame has to
// redo the chain) and stops at its own state, with only the height that state
// needs.
function launchFromSelectionParts(): ScreenshotSpec[] {
  const url = sessionSpec(
    encodeURIComponent('https://jbrowse.org/demos/ecoli_pangenome/config.json'),
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:795,000-815,000',
          tracks: [
            {
              trackId: 'ecoli_ava',
              type: 'LGVSyntenyDisplay',
              groupBy: { type: 'mateAssembly' },
              hideSelfAlignments: true,
              featureHeight: 14,
              height: 135,
            },
          ],
        },
      ],
    },
  )
  // the drag is on the scalebar strip above the tracks; the menu it raises
  // collects the launch under "Launch", which the selection frame shows opened
  // so the figure names the entry rather than just the group. This config
  // carries three all-vs-all datasets, and the choice between them is a field
  // in the dialog rather than a menu of them — the dialog opens on the one this
  // view has open. The menu rows go by testid rather than by text: the track's
  // name is also its label in the view above, and a text match resolves to the
  // first visible match, which is that label rather than the row.
  const select = [
    { type: 'drag' as const, from: { x: 375, y: 150 }, to: { x: 975, y: 150 } },
    {
      type: 'waitForSelector' as const,
      selector: '[data-testid="cascading-submenu-launch"]',
    },
    {
      type: 'click' as const,
      selector: '[data-testid="cascading-submenu-launch"]',
    },
    {
      type: 'waitForSelector' as const,
      selector: '[data-testid="cascading-menuitem-linear_synteny_view"]',
    },
    { type: 'delay' as const, ms: 500 },
  ]
  const openDialog = [
    {
      type: 'click' as const,
      selector: '[data-testid="cascading-menuitem-linear_synteny_view"]',
    },
    { type: 'waitForText' as const, text: 'Panels, top to bottom' },
    { type: 'delay' as const, ms: 4000 },
  ]
  const base = {
    mode: 'url' as const,
    url,
    readySelector: '[data-testid="pileup-display-done"]',
    readyTimeout: 120000,
    settleMs: 12000,
  }
  return [
    {
      ...base,
      name: 'multiway_synteny/ecoli_launch_selection',
      // the lanes plus the selection's own menu, nothing below it
      viewportHeight: 420,
      actions: select,
    },
    {
      ...base,
      name: 'multiway_synteny/ecoli_launch_dialog',
      // The dialog centers in the viewport and MUI caps its paper at the
      // viewport minus 64px, past which the content scrolls — so this is sized
      // for the whole dialog, buttons included. At 620 the action row was below
      // that cap and the frame cut it off mid-button, which since the launch
      // grew a second way out ("Replace current view" beside "Open in new
      // view") is the row worth showing.
      viewportHeight: 760,
      actions: [...select, ...openDialog],
    },
    {
      ...base,
      name: 'multiway_synteny/ecoli_launch_result',
      // five genome rows (each collapsed to its ruler, since the launch gives
      // them no tracks) and the four bands between them
      viewportHeight: 620,
      actions: [
        ...select,
        ...openDialog,
        // "Replace current view", the dialog's other way out: the launched view
        // takes the linear view's slot, so the frame is the result rather than
        // mostly the source. (This used to be Submit followed by a click on
        // close_view, which is the same two steps done by hand.)
        //
        // This click is where the run's `[mobx-state-tree] ... no longer part of
        // a state tree` warns come from (plus `[findParentThat] node has no
        // parent`), and they are benign. Replacing destroys the LGV subtree
        // while its observer components are still mounted — React unmounts in
        // the commit after the action — so MobX's staleness check re-evaluates
        // their dependencies across the dead nodes: `view.height` walks tracks →
        // displays. MST's livelinessChecking defaults to 'warn', so nothing
        // throws and the reads feed a render that never commits. They carry
        // `Action: '/session.replaceView()'` because MST leaves that action
        // context set while MobX flushes reactions at the end of the action, and
        // they print interleaved under other specs' [n/total] lines because the
        // generator runs four browsers at once — the `[name] browser[warn]:`
        // prefix is the attribution, not the counter above them.
        { type: 'click', text: 'Replace current view' },
        {
          type: 'waitForSelector',
          selector: '[data-testid="synteny_canvas_done"]',
        },
        { type: 'delay', ms: 4000 },
        // No color legend and no palette menu (reviewer). The launched view
        // already draws the PAF's CIGAR (cigarMode defaults to 'full', and
        // all_vs_all.paf is built with `minimap2 -c`), so the wedges inside
        // these ribbons are the insertions and deletions; the legend that names
        // them is one floating box in the corner, and the menu it is turned on
        // from is a full-height overlay across the left half of the frame —
        // together they cost more of the five-row stack than the naming is
        // worth here. The prose above the figure names Show color legend.
      ],
    },
  ]
}

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
    //
    // Grape and peach are divergent enough that this PAF is all short hits: the
    // median block is well under a kb and the longest is ~12kb against a 227 x
    // 486 Mbp plot, so every block draws as a single dot and the min-length
    // filter is what leaves anything readable.
    //
    // No colorBy. Per-query coloring was added here to separate the survivors,
    // and it does not: a rainbow of one-pixel dots reads as noise with extra
    // steps (reviewer). Black is the house style for a dotplot, and where the
    // plain plot has no structure to show, that is the dataset's problem to fix
    // rather than the palette's.
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
          tracks: ['grape_peach_paf'],
          minAlignmentLength: 2000,
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
    url: sessionSpec(DOTPLOT_CONFIG, {
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

  // The last paragraph of multiway_synteny.md, which had no figure: the same
  // .blocks track in a PLAIN LGV. With no second row there is no target
  // assembly, so the adapter serves every pair the table covers at once and the
  // grape row carries its peach and its cacao orthologs together;
  // "Group by... > Mate assembly" splits that into one labelled lane per genome.
  // Baked into the session (groupBy on the track entry) rather than driven
  // through the menu, so the figure can't drift from it.
  //
  // Same window as the gene-ortholog figure above (grape 11), so the two are the
  // same locus read the two ways: as a stack of three genomes, and as one genome
  // with a lane per mate.
  {
    mode: 'url',
    name: 'multiway_synteny/blocks_one_vs_all',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/grape_peach_cacao/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'grape',
            loc: '11:1,840,000-1,927,000',
            tracks: [
              {
                trackId: 'grape_genes',
                showOnlyGenes: true,
                displayMode: 'compact',
                showDescriptions: false,
              },
              {
                trackId: 'grape_peach_cacao_blocks',
                type: 'LGVSyntenyDisplay',
                groupBy: { type: 'mateAssembly' },
                // an anchor block is short at this zoom, and what the figure is
                // about is which lane has one, so the bars get some thickness
                featureHeight: 14,
                height: 90,
              },
            ],
          },
        ],
      },
    ),
    readySelector: '[data-testid="pileup-display-done"]',
    readyTimeout: 120000,
    settleMs: 12000,
    viewportHeight: 428,
  },

  // orthofinder_synteny.md: human/chicken/frog/spotted gar/zebrafish, stacked
  // on OrthoFinder orthogroups rather than a whole-genome aligner. One
  // vertebrates_orthogroups track (MCScanBlocksAdapter) backs all four bands.
  // The assemblies are ChromSizesAdapter (no sequence, names/lengths only, see
  // the tutorial's "Assemblies without sequence" section) - a tagged
  // jbrowse-web release may not carry the LinearSyntenyView fix that
  // combination needs, so this renders against the site's own build (main)
  // rather than a fixed jbrowse-web version the way the other synteny specs
  // above do.
  {
    mode: 'url',
    name: 'orthofinder_synteny/vertebrates',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/orthofinder_vertebrates/config.json',
      ),
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              { assembly: 'human' },
              { assembly: 'chicken' },
              { assembly: 'frog' },
              { assembly: 'gar' },
              { assembly: 'zebrafish' },
            ],
            tracks: [
              ['vertebrates_orthogroups'],
              ['vertebrates_orthogroups'],
              ['vertebrates_orthogroups'],
              ['vertebrates_orthogroups'],
            ],
            colorBy: 'reference',
            // On, and it runs on every level including the last (review: "the
            // last comparison with zebrafish is particularly scrambled, unclear
            // if autodiagonalization is working there"). Checked against a
            // rendered autoDiagonalize:false control: without it the rows sit in
            // their natural order (chicken 1..Z, zebrafish 1..25) and the upper
            // bands lose the vertical bundling they have here, so it is running
            // and it is helping.
            //
            // The bottom band stays dense because the map it is drawing is not
            // one-to-one, which is measurable from the demo's own files rather
            // than a matter of opinion. Weighting each chromosome by its link
            // count, a chromosome's single best partner accounts for 79% of its
            // links chicken to frog, 50% human to chicken, and 33% gar to
            // zebrafish: past the teleost genome duplication, two thirds of
            // every gar linkage group's orthologs land somewhere other than its
            // best zebrafish partner. No left-to-right ordering can make that
            // diagonal, and no filter rescues it either (dropping every
            // multi-copy expansion would still leave ~13k of the band's ~17.8k
            // links). The band is dense because the answer is.
            autoDiagonalize: true,
            // and one bp/px down the stack, see the wheat spec below. Row
            // length is genome size here too: human's 3.1 Gb against the
            // 0.9-1.5 Gb of the four below it, with gar and zebrafish (0.90 and
            // 1.35) the pair the bottom band is really about.
            sameScale: true,
            // see the grasses spec below for why these settings; the three
            // OrthoFinder figures are the same picture on different genomes
            collapseEmptyRows: true,
            levelHeights: [180, 180, 180, 180],
            // 0.3, twice what the grasses and wheat figures take (review:
            // "increase opacity"). Alpha is a per-link constant and the picture
            // is what the links pile up into, so the value that reads is set by
            // how collinear the genomes are, not by the figure being one of a
            // set. The grasses are five grass genomes: a rice chromosome's
            // orthologs land almost entirely on one partner, the links arrive as
            // tight bundles and 0.15 saturates them. These five span ~430 My and
            // a teleost genome duplication, so the same 0.15 spread the same
            // number of links over the whole band and every one of them came out
            // as background — the lower bands in particular read as a grey wash
            // with a few strong diagonals on it. At 0.3 a single ortholog is
            // visible and the bundles are solid without flooding their bands.
            alpha: 0.3,
            drawCurves: false,
          },
        ],
      },
    ),
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 15000,
    viewportHeight: 1000,
  },

  // orthofinder_synteny.md: rice/sorghum/maize/brachypodium/foxtail millet.
  // Maize's whole-genome duplication is the thing to see: a maize gene's
  // orthogroup commonly holds two maize copies, so the .blocks conversion's
  // --pick expand default draws both rather than picking one arbitrarily,
  // and the maize bands carry visibly more ribbons per rice/sorghum gene than
  // the non-duplicated pairs do.
  {
    mode: 'url',
    name: 'orthofinder_synteny/grasses',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/orthofinder_grasses/config.json',
      ),
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              { assembly: 'rice' },
              { assembly: 'sorghum' },
              { assembly: 'maize' },
              { assembly: 'brachypodium' },
              { assembly: 'setaria' },
            ],
            tracks: [
              ['grasses_orthogroups'],
              ['grasses_orthogroups'],
              ['grasses_orthogroups'],
              ['grasses_orthogroups'],
            ],
            colorBy: 'reference',
            autoDiagonalize: true,
            // One bp/px down the stack, see the wheat spec below. This set has
            // the widest size spread of the three (brachypodium 0.27 Gb to
            // maize 2.14 Gb), so it is also where the shared scale costs the
            // most frame: the four small rows are drawn between an eighth and a
            // third of maize's length.
            sameScale: true,
            // No row carries a track, so every row was spending ~90px on a "No
            // tracks active / Open track selector" block: five of them, down the
            // middle of the frame, over half the height the ribbons had.
            collapseEmptyRows: true,
            // and the reclaimed height goes to the bands. A ribbon here is one
            // gene pair, so a band's legibility is entirely how far apart its
            // crossings are drawn.
            levelHeights: [180, 180, 180, 180],
            // Under the 0.2 default, which is tuned for alignment ribbons with
            // area; an orthogroup link is a hairline at whole-genome zoom, and
            // tens of thousands of them at 0.2 saturate into one wash where a
            // dense chromosome-to-chromosome bundle and a lone scattered
            // ortholog paint the same. Lower, only overlap accumulates color,
            // so the bundles are the visible thing and the singletons stay
            // background. These grass chromosomes are near one-to-one, so the
            // links arrive as tight bundles and this is as high as it can go;
            // the vertebrates figure takes twice it, for the opposite reason.
            alpha: 0.15,
            // Straight chords, though this is the one case the drawCurves
            // docstring recommends itself for. Rendered both: the bezier version
            // is by far the prettier picture and the worse figure, because a
            // curve leaves its chromosome vertically and only bends toward its
            // partner in the middle of the band, so the bundles braid together
            // where they cross and stop pointing at anything. Which chromosome
            // maps to which is the whole content here, and a straight chord is
            // the line that says it.
            drawCurves: false,
          },
        ],
      },
    ),
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 15000,
    // five collapsed scalebar rows and four 180px bands
    viewportHeight: 1000,
  },

  // orthofinder_synteny.md: wheat's own polyploidy/domestication history, not
  // an abstract duplication. Stack order is the evolutionary chain: Aegilops
  // tauschii (diploid D-genome donor) - bread wheat (hexaploid ABD) - durum
  // (domesticated tetraploid AB) - wild emmer (durum's wild tetraploid
  // ancestor) - Triticum urartu (diploid A-genome donor) - T. timopheevii (a
  // second, independent AG tetraploid that also traces to the A-genome donor).
  // Every adjacent band is therefore a real step rather than an arbitrary
  // pairing. Six rows (one more than the other two sets here), hence the taller
  // viewport.
  {
    mode: 'url',
    name: 'orthofinder_synteny/wheat',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/orthofinder_wheat/config.json',
      ),
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              { assembly: 'tauschii' },
              { assembly: 'wheat' },
              { assembly: 'durum' },
              { assembly: 'emmer' },
              { assembly: 'urartu' },
              { assembly: 'timopheevii' },
            ],
            tracks: [
              ['wheat_orthogroups'],
              ['wheat_orthogroups'],
              ['wheat_orthogroups'],
              ['wheat_orthogroups'],
              ['wheat_orthogroups'],
            ],
            colorBy: 'reference',
            autoDiagonalize: true,
            // One bp/px down the whole stack instead of fitting each row to the
            // pane. This set is the case for it: the rows run 4.2 Gb (diploid
            // tauschii) to 14.5 Gb (hexaploid bread wheat), so fit-to-width drew
            // them all the same length and stretched tauschii's 7 chromosomes
            // across the same span as wheat's 21 — which both hides the
            // polyploidy the figure is about and puts every ribbon between those
            // two rows at a 3x horizontal ratio, fanning what is really a clean
            // 1:1 D-genome correspondence. Same scale, the row lengths ARE the
            // genome sizes and a D chromosome sits over its own copy.
            sameScale: true,
            // see the grasses spec above for why these four settings; the three
            // OrthoFinder figures are the same picture on different genomes
            collapseEmptyRows: true,
            levelHeights: [170, 170, 170, 170, 170],
            alpha: 0.15,
            drawCurves: false,
          },
        ],
      },
    ),
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 15000,
    // six collapsed scalebar rows and five 170px bands. 1120 cut the bottom
    // row's scalebar in half, which is the row that names timopheevii's
    // sequences; 1165 cleared it but left a dead strip under the frame.
    viewportHeight: 1140,
  },

  // orthofinder_synteny.md: the 4A translocations, out of the same wheat demo
  // and the same one orthogroup track as the six-row figure above. Two rows:
  // all seven Aegilops tauschii chromosomes over bread wheat 4A alone. The
  // whole D genome is on the top row on purpose - the content is that only
  // three of its seven chromosomes reach 4A at all, which a row pre-filtered to
  // those three would assert rather than show.
  //
  // VERIFIED against the demo's own files, since the caption carries the whole
  // finding. Joining tauschii.blocks.gz to tauschii.bed.gz and wheat.bed.gz
  // gives 2,874 orthogroup links landing on 4A, and their 4A positions per donor
  // chromosome are
  //   4D  2045 links   5th-95th pct     9.9 Mb - 602.1 Mb
  //   5D   295 links   5th-95th pct   604.0 Mb - 641.4 Mb
  //   7D   407 links   5th-95th pct   647.3 Mb - 742.4 Mb
  // -- three consecutive, non-overlapping blocks in that order, with every other
  // tauschii sequence contributing 30 links or fewer over the whole chromosome
  // (2D 30, 3D 25, 1D 19, 6D 18). That is the "scattered singletons" the prose
  // claims, measured.
  //
  // NO ON-FIGURE LABELS NAMING THE THREE BLOCKS, and it is not for want of
  // trying. A synteny view's sub-panels have no `view-container-<id>` element --
  // only top-level views get one (ViewContainer.tsx) -- so a `{view: [0,1],
  // locus}` anchor resolves to nothing and the run says so. The fallback, an
  // in-app `highlight` on the bottom row, draws into the row's tracks area, and
  // this row is a bare scalebar with no tracks, so it has nowhere to paint
  // either. Both were rendered before being removed. Labelling this row needs
  // either a track on it (there is no useful one at 745 Mb) or a locus anchor
  // that works on a sub-panel. The caption does the naming instead, and it now
  // says the red bundle leaves the RIGHT-HAND END of 5D -- the one real
  // misreading risk here, since that apex sits a few px from the 6D tick label
  // and 6D contributes 18 links to the whole chromosome.
  {
    mode: 'url',
    name: 'orthofinder_synteny/wheat_4a',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/orthofinder_wheat/config.json',
      ),
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              // Named in numeric order, which is the point: this demo's
              // chrom.sizes was written largest-first, so the assembly's own
              // region order is 2D 7D 3D 5D 4D 1D 6D and a whole-assembly row
              // interleaves the three donor chromosomes among the four that
              // draw nothing, with the 7D and 5D bundles crossing the 4D one
              // (rendered, and it is much the worse picture). The 23 unplaced
              // scaffolds it also drops are 0.46% of the row and invisible
              // either way. build_orthofinder_synteny.sh now writes chrom.sizes
              // in the GFF3's order, so a rebuilt set would not need this.
              { assembly: 'tauschii', loc: '1D 2D 3D 4D 5D 6D 7D' },
              { assembly: 'wheat', loc: '4A' },
            ],
            tracks: [['wheat_orthogroups']],
            // by the TOP row's chromosome (colorBy 'query' paints views[level],
            // 'target' views[level+1]), so each donor chromosome carries its own
            // color down into 4A. 'reference' - what the other three OrthoFinder
            // figures use to keep a chromosome one color across several bands -
            // degenerates here: one band, and every link lands on the same
            // single bottom-row chromosome, so it paints the figure one color.
            colorBy: 'query',
            // off. The three segments are the figure, and their order along 4A
            // is a fact about 4A; reordering and flipping the top row to
            // straighten the ribbons would rewrite the thing being shown.
            autoDiagonalize: false,
            // and no sameScale either: 4A is one chromosome against a 4.2 Gb
            // genome, so a shared bp/px draws it as a sixth of the frame. Each
            // row fitted to the pane puts 4A across the full width, which is
            // what separates its three segments.
            collapseEmptyRows: true,
            levelHeights: [430],
            // 0.5, well over the 0.15 the whole-genome wheat figure takes. That
            // one is drawing every D-genome link against every A/B/D partner;
            // this is one chromosome's worth, a twentieth as many ribbons over
            // a taller band, and at 0.15 the two translocated bundles read as
            // smoke beside the native one.
            alpha: 0.5,
            drawCurves: false,
          },
        ],
      },
    ),
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 15000,
    // two collapsed scalebar rows and one 430px band
    viewportHeight: 640,
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
            // IAI39 goes last on purpose. The other four are near-colinear
            // with each other (every pair >92% forward), so bands 1-3 are the
            // shared-backbone picture and the bottom band is the only one with
            // real structure: IAI39 carries five inversions over 50 kb against
            // K12, the largest 281 kb and 350 kb, which draw as two clean X
            // crossings rather than as noise.
            views: [
              { assembly: 'K12' },
              { assembly: 'Sakai' },
              { assembly: 'CFT073' },
              { assembly: 'NCTC86' },
              { assembly: 'IAI39' },
            ],
            // one all-vs-all track backs every band (lists all five assemblies)
            tracks: [
              ['ecoli_ava'],
              ['ecoli_ava'],
              ['ecoli_ava'],
              ['ecoli_ava'],
            ],
            drawCurves: false,
            colorBy: 'default',
            // drop short minimap2 alignments so the shared backbone reads as
            // clean ribbons instead of a dense noise band
            minAlignmentLength: 10000,
            levelHeights: [110, 110, 110, 110],
            // None of the five rows carries a track, so every row collapses to
            // a bare scalebar instead of a ~90px "No tracks active / Open
            // track selector" block — five of those cost more of the viewport
            // than the ribbons they're stacked around.
            collapseEmptyRows: true,
            // No autoDiagonalize. It reorders and flips a level's lower axis,
            // and neither lever applies: each assembly is a single contig, so
            // there is nothing to reorder, and the flip is per-axis rather than
            // per-block, so it cannot help a row whose inversions are internal
            // (IAI39) — tested, the render is unchanged. The slant is not a
            // rearrangement to correct either: each row spans its own whole
            // genome across the same pixel width, and the genomes differ in
            // length (K-12 4.64 Mb vs Sakai 5.50 Mb), so a colinear alignment
            // has to draw as a diagonal.
          },
        ],
      },
    ),
    // five collapsed scalebar rows and four 110px bands, sized to them
    // (collapseEmptyRows shrinks each row from ~175px to a bare scalebar)
    viewportHeight: 715,
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
  // 1,274,685 aligns to K-12 at all. The stx2 genes sit in that bare stretch,
  // beyond the backbone block, with no ribbon above them. (The island's own far
  // flanks align to K12 ~566 kb, a different locus — the prophage inserted into
  // a rearranged site — which is why this frames the backbone block, not the
  // flanks.)
  //
  // Both windows are the same 70 kb span so the two rows render at the same
  // bp/px — the "Square view" state the reviewer asked for (both LGVs use the
  // full view width, so equal spans give equal zoom). The backbone block is
  // aligned to the same relative x in each (K12 1,026,000-1,096,000 vs Sakai
  // 1,205,000-1,275,000), so its ribbon runs roughly horizontal and the stx2
  // island bulges into the bare right side of the Sakai row.
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
                loc: 'chr:1,026,000-1,126,000',
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
                // Both rows extend the same 30 kb further right (still 100 kb, so
                // same bp/px and the backbone ribbon stays horizontal): pulls the
                // stx2 island in from the cluttered right edge toward mid-view.
                assembly: 'Sakai',
                loc: 'chr:1,205,000-1,305,000',
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
    // Point out the stx2 island (the reviewer's ask). The box and arrow ANCHOR
    // to the stx2B gene's own label text, so they track the actual gene at
    // capture time instead of hand-tuned pixels landing on a neighbor.
    annotations: [
      {
        // right-aligned against the right edge (reviewer's ask). stx2B sits at
        // about two thirds across, so the callout is on the far side of what it
        // names and the arrow now runs right-to-left; `textAlign: 'end'` is what
        // pins the pill's RIGHT edge at x, since its width is only known once
        // the text is measured in the page.
        type: 'text',
        text: 'stx2 (Shiga toxin) prophage island\npresent in Sakai, absent from K-12',
        x: 1470,
        y: 335,
        textAlign: 'end',
        maxWidth: 380,
      },
      {
        type: 'arrow',
        from: { x: 1085, y: 365 },
        // stop short of the stx2B label instead of landing on top of it — the
        // box below marks the gene itself. Offset toward the tail, which is now
        // on the right.
        anchor: { text: 'stx2B' },
        dx: 45,
        dy: -28,
      },
      {
        // grown upward off the label so it wraps the stx2B GLYPH as well —
        // the default label-sized box clipped the glyph along its top edge
        type: 'box',
        anchor: { text: 'stx2B' },
        dy: -14,
        height: 36,
      },
    ],
  },

  // The "One strain against all the others" section of allvsall_synteny.md: the
  // same all-vs-all track in a PLAIN LGV. With no second row there is no target
  // assembly, so the adapter draws K-12 against every other sample at once, and
  // LGVSyntenyDisplay's "Group by... > Mate assembly" splits that into one
  // section per strain. Baked into the session (groupBy on the track entry)
  // rather than driven through the menu, so the figure can't drift from it.
  //
  // The window is read off the PAF, not chosen for looks. K-12's phenylacetate
  // catabolism operon (paaABCDEFGHIJK + paaXY, chr:1,446,378-1,465,230, with
  // feaR/feaB/tynA just upstream) has no alignment at all in Sakai
  // (1,446,100-1,467,908 bare) or CFT073 (1,446,270-1,465,276 bare), while
  // NCTC86 runs through it in one 33 kb block (1,434,958-1,467,909). Neither
  // Sakai's nor CFT073's annotation carries a phenylacetate gene. The window
  // puts the shared flanks on both sides of that break, so two lanes visibly
  // stop where the third continues.
  //
  // The right edge reaches past 1,467,921 on purpose: the IS elements
  // insD2/insC2/insI2 sit immediately downstream of the island, and each one
  // aligns to ten-plus loci per strain. Under one-row-per-group those land on
  // top of each other, so they read as the dark ticks that the shading is for —
  // the same repeat pile that used to stack seven rows deep in every lane and
  // squeeze the actual synteny into a sliver.
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_one_vs_all',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/ecoli_pangenome/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'K12',
            loc: 'chr:1,440,000-1,473,000',
            // The island itself, banded across every track so the gene block
            // and the two lanes that stop at its left edge are one object
            // rather than two things a reader has to line up by eye. Explicit
            // rgba because getHighlightColor uses a supplied color as-is. 0.13
            // is picked off the composite, not by eye: over white it lands at
            // (250,240,224), an obvious cream, while over a forward-strand bar
            // it moves (240,141,131) to (237,140,116) — invisible. That matters
            // because darker salmon already MEANS overlap depth here, so a band
            // heavy enough to tint the bars would read as data.
            highlight: [
              {
                refName: 'chr',
                start: 1446100,
                end: 1467921,
                color: 'rgba(214,137,16,0.13)',
              },
            ],
            tracks: [
              {
                trackId: 'K12_genes',
                showOnlyGenes: true,
                displayMode: 'compact',
                showDescriptions: false,
              },
              {
                trackId: 'ecoli_ava',
                type: 'LGVSyntenyDisplay',
                groupBy: { type: 'mateAssembly' },
                // "Group by... > Hide self-alignment lane". K-12 cannot have a
                // line against itself — all_vs_all.paf is built with
                // `minimap2 -X`, which skips each sequence's own diagonal — so
                // its lane held only K-12's internal paralogy and every
                // reviewer read it as missing data. Hidden, the figure is the
                // four lanes it is actually about.
                hideSelfAlignments: true,
                // Same thicker bar as the whole-genome figure below, and for
                // the same reason: what the reader is asked to find is where a
                // lane STOPS, and a 7px bar makes that a hairline.
                featureHeight: 14,
                // One row per strain (the LGVSyntenyDisplay default), so the
                // track is its five lanes and nothing else. Stacked, four
                // groups already needed 210px, almost all of it empty: the row
                // count came from the IS-element pile at the right edge, not
                // from the synteny anyone is looking at.
                height: 135,
              },
            ],
          },
          // The graph of the same island, in the same frame (review: "I don't
          // see the graph in this screenshot. should be combined figure?").
          // What the lanes cannot say is what the strains that stop at the
          // island's left edge carry INSTEAD — sequence absent from the
          // alignment is absent from the PAF — and that is the short arm beside
          // the long node here.
          //
          // The gfatools slice rather than a launch cut off the segments index:
          // the tabix cut expands one hop off the region and a link is indexed
          // at its reference-side endpoint, so CFT073's and IAI39's detours —
          // which leave at s501 and rejoin at s506 — come in as 43 bp/558 bp
          // stubs with nothing behind them, which is the opposite of what this
          // pane is here to show. `gfatools view -R … -r 1` walks the graph
          // itself. Same file, settings and ramp as pangenome/rgfa_paa_bubble,
          // which draws this graph under a three-strain synteny view.
          //
          // The plugin loads from the hosted demo config's own `esmUrl`, which
          // is on the generator's pre-approved list (trustCapturePlugins), so
          // the cross-origin plugin warning does not cover the capture.
          {
            type: 'GraphGenomeView',
            gfaLocation: { uri: `${ECOLI_DEMO_BASE}/ecoli_paa_subgraph.gfa` },
            layoutMode: 'force',
            colorScheme: 'reference-position',
            colorDomain: { start: 1445000, end: 1474500 },
          },
        ],
      },
    ),
    viewportHeight: 1190,
    // Both panes: the lanes' own done-marker AND the graph's layout timing.
    // `body:has(A) B` is an AND — a bare list would be a CSS OR and fire on
    // whichever landed first, which here is always the lanes.
    readySelector:
      'body:has([data-testid="graph-perf-stats"]) [data-testid="pileup-display-done"]',
    readyTimeout: 120000,
    settleMs: 12000,
    // name the island, since "three lanes stop here" is only interesting once
    // the reader knows what stops. One line; the rest is in the caption.
    annotations: [
      {
        // centred in the strip between the last lane and the graph pane's own
        // header, which is what the LGV's spare height is for here
        type: 'text',
        fontSize: 18,
        maxWidth: 560,
        x: 250,
        y: 430,
        text: 'paa operon (phenylacetate catabolism): present in K-12 and NCTC86, absent from the other three',
      },
      {
        // The island in the graph pane, ringed the way
        // pangenome/rgfa_paa_bubble rings it — same segment, same slice, so the
        // two figures mark the same node. Anchored through the view's own
        // nodePositions, which resolves to a point ON the polyline: the arc's
        // bounding-box centre is the empty space it encloses.
        type: 'circle',
        anchor: { view: 1, graphNode: 's502' },
        radius: 40,
      },
    ],
  },

  // The allvsall_synteny.md "From a lane to a stack, for one locus" section:
  // going from the one-vs-all lanes above to the stacked view of one locus,
  // which is the launch this figure documents. Three parts, each its own spec
  // and its own capture height, stacked by the `compose` below: the selection
  // and the offer it raises, the dialog that offer opens, and the view it
  // launches. Each is a UI chain rather than a session — the rubberband menu and
  // the dialog are only reachable by driving the UI, and baking the launched view
  // into a session would show the destination without the thing being documented
  // — but they are separate specs rather than `stages` of one so that each frame
  // is only as tall as its own state. As stages they shared the height the
  // five-row stack needs, which left the dialog frame mostly empty.
  //
  // Deliberately NOT the paa window ecoli_one_vs_all uses. That locus is the one
  // place in the genome where three of the four strains have no alignment at
  // all, so a selection inside it discovers a single mate and the launch
  // degenerates to the pairwise case this section is contrasting against. This
  // is a shared-backbone window instead, where every strain aligns and the
  // launch produces the five-row stack.
  ...launchFromSelectionParts(),
  {
    mode: 'compose',
    name: 'multiway_synteny/ecoli_launch_from_selection',
    parts: [
      'multiway_synteny/ecoli_launch_selection',
      'multiway_synteny/ecoli_launch_dialog',
      'multiway_synteny/ecoli_launch_result',
    ],
  },
  // The whole-genome end of the same "One strain against all the others"
  // section: the figure above, zoomed all the way out over K-12's 4.6 Mb. Same
  // track (ecoli_ava) on purpose — it is this tutorial's own all_vs_all.paf, and
  // "the same mode zoomed out" should be literally the same lanes.
  //
  // It used to run on ecoli_pggb_ava (AllVsAllIndexedPAFAdapter) to cover the
  // indexed adapter in a plain LGV. That was wrong twice over, both in the
  // hosted asset rather than in our code, and both invisible in a caption:
  //
  //  - Wrong NCTC86. jbrowse.org/demos/ecoli_pangenome/ecoli_pggb_ava.pif.gz
  //    carries NCTC86#1#chr = 4,903,501 bp (GCF_003697165.2) while every
  //    assembly in that same config — and all_vs_all.paf.gz — is 5,111,920 bp
  //    (GCF_002007705.1). The two deposits of the isolate are
  //    reverse-complements, so all 34 K-12/NCTC86 rows drew reverse-strand: a
  //    solid blue lane that reads as a whole-genome inversion and is an
  //    accession mismatch. ecoli_cactus_ava has the same 4,903,501 NCTC86, so
  //    the pangenome_cactus figures inherit it.
  //  - Reciprocal duplication. pggb's wfmash step emits each pair in both
  //    directions (K12|Sakai 21 rows and Sakai|K12 20 rows, and so on for all
  //    six pairs), so mean depth is 2.0 across the whole genome and the overlap
  //    shading darkened every lane uniformly — it meant "both directions", not
  //    "repeats". The two directions segment differently, so nothing downstream
  //    can dedupe them safely.
  //
  // all_vs_all.paf.gz has neither problem: 5,111,920 bp NCTC86, one direction
  // per pair. Fixing the pggb asset needs a rebuild and re-upload, and even then
  // the tabix point is thin here — a 4.6 Mb whole-chromosome query returns
  // essentially the whole file, so the index saves nothing at this zoom. The
  // prose now points at the make-pif section instead of claiming the figure
  // demonstrates it.
  //
  // Both representations of that PAF are in ONE frame (reviewer: "would be cool
  // to show this and the multi-way synteny in same figure, so that we could see
  // the inversions"). The lanes live on the K-12 row of a LinearSyntenyView
  // rather than in a separate view, so they share that row's axis with the four
  // ribbon bands below them: IAI39's inversions are the blue stretches in the
  // top lane AND the crossings in the bottom band, at the same x.
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_one_vs_all_whole_genome',
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
                loc: 'chr:1-4,641,652',
                tracks: [
                  {
                    trackId: 'ecoli_ava',
                    type: 'LGVSyntenyDisplay',
                    groupBy: { type: 'mateAssembly' },
                    // The K12 lane can hold no self-alignment — all_vs_all.paf
                    // is built with `minimap2 -X`, which skips each sequence's
                    // own diagonal — so it is hidden rather than explained away.
                    hideSelfAlignments: true,
                    // Per-base mismatches are sub-pixel at 3.2kb/px — thousands
                    // of inter-strain SNPs, each drawn at a 1px floor, painted
                    // every lane a solid brown-and-purple wall and buried the
                    // block structure the figure is about.
                    showMismatches: false,
                    // Thicker than the default bar: at 3.2kb/px the information
                    // is the WHITE, and a 3px gap in a 7px bar is not a gap
                    // anyone sees.
                    featureHeight: 20,
                    height: 115,
                  },
                ],
              },
              // IAI39 SECOND, not last as in the standalone multi-way figure:
              // the bands are between adjacent rows, so this is the only order
              // where a K12<->IAI39 band exists at all. Its crossings then sit
              // directly under the blue stretches of the IAI39 lane above, on
              // the same K12 axis — which is the whole reason the two
              // representations are in one frame.
              { assembly: 'IAI39' },
              { assembly: 'Sakai' },
              { assembly: 'CFT073' },
              { assembly: 'NCTC86' },
            ],
            tracks: [
              ['ecoli_ava'],
              ['ecoli_ava'],
              ['ecoli_ava'],
              ['ecoli_ava'],
            ],
            drawCurves: false,
            // Strand, not the 'default' red the standalone multi-way figure
            // uses, because strand is what the two halves have in common:
            // LGVSyntenyDisplay colors its lanes by strand already, so an
            // inversion is blue in the lane AND a blue ribbon in the band.
            colorBy: 'strand',
            minAlignmentLength: 10000,
            levelHeights: [100, 100, 100, 100],
          },
        ],
      },
    ),
    viewportHeight: 1030,
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
  // menu-driving, annotating the three things the tutorial names: the mode
  // toggle, the track, and the rows it fills.
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
    viewportHeight: 356,
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
        text: 'Every assembly in the track becomes a row',
        x: 780,
        y: 205,
        maxWidth: 340,
      },
      // pointed at the rows, not at Launch: a submit button at the bottom of a
      // form needs no callout, and an arrow across the frame to reach it was
      // the largest thing in the figure (reviewer)
      {
        type: 'arrow',
        from: { x: 770, y: 220 },
        anchor: { selector: '[data-testid="quick-start-rows"]' },
      },
    ],
  },

  // The pairwise MCScan figure for tutorials/mcscan_synteny.md: peach Pp05 vs
  // grape chr2, the per-gene .anchors ribbons between them and the
  // .anchors.simple blocks (red collinear / blue inverted) as an
  // LGVSyntenyDisplay row in each panel — both adapters in one view, which is
  // what the tutorial is about.
  //
  // Was the last `share-` link in the repo. Decrypting that session showed why
  // it had to go: a frozen Apr-2021 snapshot, so the capture baked its stale
  // "Grape vs Peach (small) 4/2/2021" session name into the title bar, and its
  // grape panel sat at a negative offsetPx — scrolled left of the region start,
  // leaving a grey off-region block in the corner of the figure. The locs below
  // are read off that capture's own location boxes, so the view is the same
  // minus the dead space; `sessionName=Screenshot` comes from sessionSpec().
  // Strand coloring needs no slot — it's the LGVSyntenyDisplay colorBy default.
  //
  // As a share session this figure incidentally covered the legacy per-instance
  // `heightPreConfig` path — an alignments-base refactor once dropped that prop,
  // discarding the session's stored 28/52px synteny heights so both panels fell
  // back to the 250px alignments default. Setting `height` directly here retires
  // that incidental coverage, which is fine: extractInstanceHeight owns the
  // migration and sessionMigrations.test.ts covers it directly (one case uses
  // this very session's 52px value).
  {
    mode: 'url',
    name: 'mcscan_anchors',
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          drawCurves: true,
          // both MCScan tracks on one level: the coarse anchor set plus the
          // simple per-gene anchors drawn over it
          tracks: [
            ['grape_peach_synteny_mcscan', 'grape_peach_synteny_mcscan_simple'],
          ],
          levelHeights: [236],
          views: [
            {
              assembly: 'peach',
              loc: 'Pp05:7,380,181-14,148,567',
              tracks: [
                {
                  trackId: 'grape_peach_synteny_mcscan_simple',
                  type: 'LGVSyntenyDisplay',
                  height: 60,
                },
              ],
            },
            {
              assembly: 'grape',
              loc: 'chr2:1-7,112,179',
              tracks: [
                {
                  trackId: 'grape_peach_synteny_mcscan_simple',
                  type: 'LGVSyntenyDisplay',
                  height: 60,
                },
              ],
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 10000,
    // just the app, and enough for the lower panel's own synteny row: the old
    // capture left the bottom ~28% of the PNG blank
    viewportHeight: 640,
  },

  ...mcscanFilePartSpecs(),
  {
    mode: 'compose',
    name: 'mcscan_synteny/anchors_vs_simple',
    parts: ['mcscan_synteny/anchors', 'mcscan_synteny/anchors_simple'],
  },

  // The same MCScan run as a dotplot, which mcscan_synteny.md never mentioned:
  // one dot per orthologous gene pair, so the whole-genome plot is the one jcvi
  // itself draws, from the file the tutorial has already loaded. autoDiagonalize
  // reorders the grape axis to follow peach: in raw .fai order the same runs are
  // scattered over the plot, and grape has 19 chromosomes to peach's 8, so
  // reading which pairs correspond is the whole point of the reorder.
  //
  // Black, like every other dotplot here. Per-query coloring was tried and
  // dropped (reviewer): the diagonalized runs already separate on position, and
  // the palette only competes with them.
  {
    mode: 'url',
    name: 'mcscan_synteny/dotplot',
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
          tracks: ['grape_peach_synteny_mcscan'],
          autoDiagonalize: true,
        },
      ],
    }),
    readySelector: '[data-testid="dotplot_webgl_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 8000,
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

  // hg38 vs T2T-CHM13 at TNNT3, reproducing the genomes.jbrowse.org/demos/
  // session (Fig 5C of the T2T variation paper, science.abl3533). Called
  // against GRCh38 the locus looks like a 24 kb inversion plus a 22 kb deletion
  // ablating LINC01150 in every individual; against T2T-CHM13 the same 22 kb is
  // simply inversely transposed to the other side of TNNT3. colorBy 'strand'
  // paints that flipped segment against the collinear ribbons around it, so the
  // rearrangement is the only off-color block in the view. Curved ribbons plus
  // 'matches' (transparent indels) keep strand the only thing color means, which
  // is what makes the flipped block read at a glance.
  {
    ...TNNT3_FRAME,
    name: 'synteny_hg38_hs1_tnnt3',
    url: tnnt3Session({ drawCurves: true, cigarMode: 'matches' }),
  },

  // Two-part figure for the genomes_synteny tutorial: the same view as it opens
  // (straight ribbons, colored indels) over the same view after the two ribbon
  // settings the tutorial points at. Each part is its own session, so the stack
  // can't drift from what the live links open.
  {
    ...TNNT3_FRAME,
    name: 'genomes_synteny/ribbons_default',
    url: tnnt3Session(),
    // The top frame also has to answer "where are those two settings?", so it
    // opens the header's View options menu and hovers Show... — 'Show curved
    // lines' is in that submenu while 'CIGAR display mode' stays visible in the
    // parent, so one frame carries both controls the section asks the reader to
    // change. The live link still opens the plain default state.
    actions: [
      { type: 'click', selector: '[aria-label="View options"]' },
      { type: 'hover', text: 'Show...' },
      { type: 'waitForText', text: 'Show curved lines' },
      // the submenu popper is settled in the DOM the moment that text appears,
      // but it is its own compositor layer and swiftshader rasterizes it a frame
      // or two late: the capture came out with the parent menu painted, the
      // submenu blank, and the 'Show curved lines' box floating over the track
      // behind it. Same race as bigwig/whole_genome_coverage, same fix.
      { type: 'delay', ms: 1000 },
    ],
    // box the two controls the section asks the reader to change, rather than
    // labelling the frame "As it opens" (which said nothing about the menu)
    annotations: [
      {
        type: 'text',
        x: 24,
        y: 56,
        fontSize: 22,
        text: 'Straight ribbons, colored indels',
      },
      { type: 'box', anchor: { text: 'CIGAR display mode' } },
      { type: 'box', anchor: { text: 'Show curved lines' } },
    ],
  },
  {
    ...TNNT3_FRAME,
    name: 'genomes_synteny/ribbons_curved',
    // curved ribbons trace where each block lands instead of shearing across
    // the gap; 'matches' leaves the CIGAR indels see-through so the strand
    // coloring is the only thing painting the ribbons
    url: tnnt3Session({ drawCurves: true, cigarMode: 'matches' }),
    annotations: [
      {
        type: 'text',
        x: 24,
        y: 56,
        fontSize: 22,
        text: 'Curved lines + transparent indels',
      },
    ],
  },
  {
    mode: 'compose',
    name: 'genomes_synteny/ribbon_settings',
    parts: [
      'genomes_synteny/ribbons_default',
      'genomes_synteny/ribbons_curved',
    ],
  },

  // genomes_synteny tutorial: the whole launch path in one figure, reached the
  // way a reader reaches it on genomes.jbrowse.org, from a plain hg38 LGV. Loads
  // that site's own hg38 config, so the track names, categories and menu are the
  // ones on screen there. That config declares only hg38; mm39 arrives on its
  // own because the Hubs plugin it loads answers Core-handleUnrecognizedAssembly
  // for the name the liftOver track references, and the launch menu item is
  // gated on exactly that mate assembly resolving.
  //
  // Four stages of one spec rather than four specs. The first three are one live
  // session — a context menu, the dialog it opens, the view that dialog creates
  // — each reachable only by driving the one before it. The fourth is the
  // RESULT, so it declares its own session (`url` on the stage) instead of being
  // clicked out of the third. They stay one spec because the grid is what puts
  // them side by side: `compose` appends committed PNGs with no gutter and no
  // rows, so a figure split across specs would lose the 2x2 layout below.
  //
  // In a 2x2 grid (`stageColumns`), not a column: stacked, four frames of the
  // same app chrome ran 4320px tall and a reader scrolled past the launch to
  // reach its result. The panels carry their step number, since a grid has two
  // reading orders and the numbers pick one.
  //
  // Human vs CHIMP at an FTO intron, not human vs T2T and no longer human vs
  // mouse. Same-species assemblies make every block near-identical and the
  // launched view says nothing a reader could not have guessed, so it has to be
  // cross-species; but mouse was the wrong kind of cross-species for a figure
  // whose payoff frame is a ribbon full of indel wedges. At ~90 My every gap is
  // a gap and none of them is attributable to anything, which is what the review
  // asked to fix ("a gene where the insertions and deletions are more clearly
  // assignable to a single transposon insertion").
  //
  // hg38 chr16:54,042,096-54,048,145 is a 6,049 bp **L1HS** — the youngest,
  // still-active human LINE-1 subfamily, so human-specific by subfamily — sitting
  // in an FTO intron. Read out of the hub's own RepeatMasker file
  // (jbrowse.org/ucsc/hg38/rmsk.bed.gz), with 641 bp of unique sequence between
  // it and the nearest upstream element (THE1D) and ~4.5 kb to the nearest
  // downstream one (AluSx), so the chain has clean anchors either side and the
  // insertion is a single gap rather than a repeat-dense smear.
  //
  // NOT the RB1/VAPB/PICALM loci: those are the linear-synteny guide's TE
  // figures and they read the same hg38ToPanTro6.over.pif.gz this hub track
  // does, so reusing one would republish an existing picture from a different
  // menu.
  //
  // 18 kb: about three window-widths of the element itself, so both flanks are
  // in frame with their repeats named. At the 300 kb this figure once opened on,
  // RepeatMasker was a solid strip rather than repeats and the CIGAR wedges were
  // a mass of overlapping triangles.
  //
  // The right-click is a viewport coordinate, not a selector: the chain-block
  // canvas fills the display's whole height, so its center lands well below the
  // row of blocks. The gene display carries an explicit height for the same
  // reason — an auto height is a function of how many isoforms RefSeq draws
  // here, and everything below it (the chain canvas the click lands in) moves
  // with it.
  {
    mode: 'url',
    name: 'genomes_synteny/launch_sequence',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr16:54,036,000-54,054,000',
          tracks: [
            {
              trackId: 'hg38-ncbiRefSeqCurated',
              geneGlyphMode: 'longestCoding',
              height: 60,
            },
            // RepeatMasker is open BEFORE the launch, not added after it. Two
            // things follow, and both are the point of the figure: the reader
            // can already line the repeats up against the gaps in the chain
            // below them, and "Copy this view's tracks into its panel" carries
            // both tracks into the human panel of the launched view — so the
            // step left over for the last frame is the mouse panel, one panel
            // rather than four tracks across two.
            {
              trackId: 'hg38-rmsk',
              displayMode: 'compact',
              // labels on: at 18 kb this window holds about a dozen elements, so
              // the names fit on one row, and the one on the L1HS is what the
              // whole figure is pointing at
              height: 70,
            },
            {
              // stacked, not the one-row-per-group default: the collapsed band
              // is a single row of merged blocks, so a right-click lands on
              // whatever fragment is under the cursor. Stacked, the long
              // conserved chains are their own bars and the launch can be aimed
              // at a big one.
              trackId: 'hg38_to_panTro6_liftOver',
              type: 'LGVSyntenyDisplay',
              collapseGroupRows: false,
              // one row: this window sits inside a single chromosome-scale
              // chain, so the rest of the display would be empty canvas under
              // the menu
              height: 60,
            },
          ],
        },
      ],
    }),
    // 900, not the 1200 the column version used: two of these side by side is
    // the composed width, and the frame still holds the launch dialog (~500px)
    // and the context menu.
    viewportWidth: 900,
    // the top row's height: tall enough for the whole context menu in stage 1
    // (the binding frame) — the menu opens below the clicked block, so the boxed
    // "Launch synteny view" item is its last line. The bottom row sets its own,
    // taller, height per stage.
    viewportHeight: 575,
    stageColumns: 2,
    hideTooltip: true,
    // resolving mm39 through the hub plugin raises a "Successfully loaded"
    // snackbar over whichever frame the connection lands in
    hideSelectors: ['.MuiSnackbar-root'],
    readySelector: '[data-testid="pileup-display-done"]',
    // the UCSC hub config is ~570 tracks and pulls three remote plugins
    readyTimeout: 120000,
    settleMs: 10000,
    stages: [
      {
        actions: [
          { type: 'rightclick', from: { x: 666, y: 396 } },
          { type: 'waitForText', text: 'Open feature details' },
          // leave the item the reader is being pointed at under the cursor, so
          // it carries the menu's own hover highlight as well as the box below
          { type: 'hover', text: 'Launch synteny view for this position' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          {
            type: 'text',
            x: 24,
            y: 56,
            fontSize: 20,
            text: '(1) Right-click a chain block',
          },
          {
            type: 'box',
            anchor: { text: 'Launch synteny view for this position' },
            strokeWidth: 3,
          },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Launch synteny view for this position' },
          // the dialog's own text, not its title: "Launch synteny view" is also
          // the prefix of the menu item just clicked
          {
            type: 'waitForText',
            text: 'Use CIGAR to map the current visible region to the target',
          },
        ],
        annotations: [
          {
            type: 'text',
            x: 24,
            y: 56,
            fontSize: 20,
            text: '(2) Confirm how each panel is framed',
          },
        ],
      },
      {
        actions: [
          // "Replace current view", not "Open in new view": the launch is
          // anchored on the locus the LGV above is already showing, so the
          // alternative leaves two views of one place stacked and this frame
          // spends its top half restating stage 1. Both buttons are the dialog's
          // own, and the prose names the choice.
          { type: 'click', text: 'Replace current view' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="synteny_canvas_done"]',
            timeout: 120000,
          },
          // mm39 resolves through the hub plugin and the chain track refetches
          // at the launched view's own bpPerPx, both after the canvas first
          // paints
          { type: 'delay', ms: 10000 },
        ],
        // The synteny view alone now, so this frame is its own height: the
        // human panel (the launching view's two tracks, copied), the band, and
        // the mate panel's empty-state block. That block is ~120px shorter than
        // the two tracks stage 4 puts in its place, so the two cells of the row
        // cannot both be full — compose pads this one, and padding it is better
        // than clipping stage 4 or squeezing four tracks to fit.
        viewportHeight: 570,
        annotations: [
          {
            type: 'text',
            x: 24,
            y: 56,
            fontSize: 20,
            text: '(3) The synteny view it opens',
          },
        ],
      },
      // The payoff frame: the same comparison once BOTH panels have genes and
      // repeats. Stage 3 is what the launch hands you — its human panel arrives
      // carrying the launching view's gene track (anchorPanelTracks; the dialog's
      // "Copy this view's tracks into its panel"), and the mouse panel, which
      // nothing in that view can speak for, arrives empty. So the step left to
      // the reader is the mate panel plus the repeats on both, and the figure
      // shows the result rather than the click path to it.
      //
      // Declared as its own session rather than clicked together on the page
      // stage 3 left. The launched view is created by the app at click time, so
      // driving it means opening each panel's track selector, filtering, ticking
      // and closing — a dozen brittle clicks that also can't set a per-track
      // height, which is what lets this frame match its grid neighbour's.
      // Written as a session spec it is four track entries. Same view, same two
      // windows: the locstrings are the ones the CIGAR mapping produced in stage
      // 3, so this is that view with tracks on, not a different one.
      //
      // panTro6 needs no setup here either, for the same reason it needs none in
      // the LGV above: naming it resolves it through the hub plugin, which also
      // brings the panTro6 hub's tracks (jbrowse.org/ucsc/panTro6/config.json) —
      // which is where panTro6-ncbiRefSeq and panTro6-rmsk come from.
      //
      // drawCurves and cigarMode 'matches' ("Transparent indels"), both review
      // asks and both only meaningful on THIS frame: an indel drawn as a gap
      // rather than as a painted wedge is what makes the L1HS read as the human
      // side having sequence the chimp side does not, instead of as one more
      // colored triangle among the alignment's ordinary noise. Stages 1-3 keep
      // the defaults, since they are about the launch rather than about the
      // ribbon.
      {
        url: sessionSpec(UCSC_HG38_CONFIG, {
          views: [
            {
              type: 'LinearSyntenyView',
              tracks: [['hg38_to_panTro6_liftOver']],
              drawCurves: true,
              cigarMode: 'matches',
              views: [
                {
                  assembly: 'hg38',
                  loc: 'chr16:54,035,008-54,055,008',
                  tracks: FTO_PANEL_TRACKS.hg38,
                },
                {
                  assembly: 'panTro6',
                  loc: 'chr16:39,085,191-39,099,009',
                  tracks: FTO_PANEL_TRACKS.panTro6,
                },
              ],
            },
          ],
        }),
        readySelector: '[data-testid="synteny_canvas_done"]',
        viewportHeight: 690,
        annotations: [
          {
            type: 'text',
            x: 24,
            y: 56,
            fontSize: 20,
            text: '(4) Chimp tracks on, ribbon drawn with transparent indels',
          },
        ],
      },
    ],
  },

  // One dotplot per haplotype. HG008T v3.2 is haplotype-resolved, so a single
  // plot puts both haplotypes' scaffolds on one axis interleaved — every GRCh38
  // chromosome then has TWO counterparts and the "diagonal" is doubled, which is
  // what made the combined figure hard to read. Each spec restricts the y axis to
  // one haplotype via the per-axis `displayedRegionNames` glob, so each plot is a
  // plain assembly-vs-reference diagonal.
  ...(['hap1', 'hap2'] as const).map(hap => ({
    mode: 'url' as const,
    name: `sv_cgiab/dotplot_${hap}`,
    // The old hap1/hap2 synteny tracks shipped a plain PAFAdapter pointed at a
    // .pif.gz — but PAFAdapter doesn't strip the PIF q/t refName prefixes, so
    // every feature's refName ("qchr3_chr13_hap1") failed to match the assembly
    // refName ("chr3_chr13_hap1") and the dotplot rendered empty. The config now
    // ships HG008T_v3.2_pif as a PairwiseIndexedPAFAdapter; this session track
    // keeps the same adapter so the figure and the hosted config agree.
    url: cgiabUrl({
      sessionTracks: [CGIAB_ASM_PIF_TRACK],
      views: [
        {
          type: 'DotplotView',
          // GRCh38 on x (stays in its natural chr1->chrX order) and the
          // fragmented HG008T v3.2 assembly on y: autoDiagonalize reorders the
          // vertical axis, so putting the assembly there reorders/flips its
          // contigs to form a clean diagonal against a readable reference axis.
          // (Reordering the reference axis instead scrambles the familiar
          // chromosome order and breaks the single diagonal into a staircase.)
          views: [
            { assembly: 'GRCh38_GIABv3' },
            // the scaffold names all end in _hap1/_hap2, so one glob picks a
            // haplotype without hand-listing its 16-19 scaffolds
            { assembly: 'HG008T_v3.2', displayedRegionNames: [`*_${hap}`] },
          ],
          tracks: ['HG008T_v3.2_pif'],
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
  })),

  // The dotplot import form with HG008T v3.2 on one axis and GRCh38 on the other
  // (tutorial caption). An empty DotplotView (views:[{},{}]) shows the form; both
  // selectors default to the config's first assembly (GRCh38_GIABv3), so open the
  // first (x-axis) selector and pick HG008T v3.2. Replaces a stale hand-made
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
    // selectors and the full wrapped helper text — 400 clipped the card's bottom
    // edge mid-sentence
    viewportHeight: 450,
    actions: [
      // Manual inherits Quick start's track, so the axes already read
      // HG008T v3.2 / GRCh38_GIABv3 with the synteny track selected — exactly
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
    // PairwiseIndexedPAFAdapter.
    // The v3.2 scaffolds are named for the GRCh38 chromosomes they carry, and
    // chr3_chr13_hap1 is a single contig carrying both (100.7Mb aligned to chr3
    // + 98.2Mb to chr13 in HG008T_v3.2.paf) — the translocation itself, as one
    // assembled sequence. Pairing it with chr13_hap2 (the untranslocated hap2
    // chr13) puts the derivative and its normal counterpart side by side.
    url: cgiabUrl({
      sessionTracks: [CGIAB_ASM_PIF_TRACK],
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
          // v3.2 is far more contiguous than the verkko haplotypes this figure
          // used to show, so the old 50kb floor let through enough short
          // alignments to stack into solid fans that hid the junction. 500kb
          // leaves the arm-level blocks that make the chr3/chr13 fusion legible.
          minAlignmentLength: 500000,
          alpha: 0.35,
          tracks: ['HG008T_v3.2_pif'],
          views: [
            {
              loc: 'chr3:1-198295559 chr13:1-114364328',
              assembly: 'GRCh38_GIABv3',
            },
            {
              loc: 'chr3_chr13_hap1:1-212897834 chr13_hap2:1-99565785',
              assembly: 'HG008T_v3.2',
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
    viewportHeight: 500,
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
    // sized to the content: the rest of the viewport was page background
    viewportHeight: 471,
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

  // The "Coloring genes by ortholog" section of synteny_visualization.md: the
  // same three-strain stack with the gene tracks colored by their `gene`
  // attribute instead of one flat color, so a symbol carries one color down all
  // three panels.
  //
  // Review: "the colors are just very bad here". Most of the frame was one
  // strong magenta, and that was not a palette problem: two thirds of these
  // genes carry no `gene` attribute at all, only a locus tag, so
  // `randomColor(undefined)` painted every one of them the same color and they
  // read as a large named group. They are grey now, so a color in this figure
  // means what the section says it means — an ortholog symbol, the same color
  // in all three panels.
  //
  // The colored genes stay on `randomColor` rather than a curated rainbow,
  // because the figure documents what the "Color by attribute" dialog writes
  // (ColorByAttributeDialog builds this exact jexl) and a hand-picked palette
  // would be a picture of something the dialog cannot produce. Review: "ideally
  // we get a better palette, pulling from good color set rather than like random
  // rgb" — answered in `randomColor` itself rather than here. It now places its
  // hues in OKLCH at a fixed lightness and chroma instead of raw HSL, so every
  // value comes out equally light and equally colorful, which is the property a
  // curated categorical palette actually has. It stays a hash rather than a list
  // of N because it has no allocator: see its docstring.
  {
    mode: 'url',
    name: 'sv_synteny/ortholog_colors',
    url: hpyloriSyntenyWithGenes({
      geneColor:
        "jexl:get(feature,'gene') ? randomColor(get(feature,'gene')) : 'rgb(175,175,175)'",
    }),
    readyText: 'NC_018939.1',
    readyTimeout: 60000,
    settleMs: 12000,
    // the default 800 clips the bottom strain's gene labels
    viewportHeight: 812,
  },

  // The mistake the tutorial's Troubleshooting table describes, and the app's own
  // report of it. `assemblyNames` on a synteny track is [query, target], the
  // reverse of the minimap2 argument order, so writing it the other way round is
  // the common misconfiguration: JBrowse then asks the adapter for the top row's
  // refNames and gets the bottom row's, which is what the one-shot check at view
  // load compares. A session track is the only way to state it — the hosted
  // config's own track is correct — so this reuses that PIF with the two names
  // swapped, and the view draws nothing because no name resolves.
  {
    mode: 'url',
    name: 'sv_synteny/assembly_order_warning',
    url: hpyloriUrl({
      sessionTracks: [
        {
          type: 'SyntenyTrack',
          trackId: 'hpylori_reversed_assembly_names',
          name: '26695 vs CHC155 (assemblyNames reversed)',
          assemblyNames: ['hpylori_26695', 'hpylori_chc155'],
          adapter: {
            type: 'PairwiseIndexedPAFAdapter',
            assemblyNames: ['hpylori_26695', 'hpylori_chc155'],
            pifGzLocation: {
              uri: 'https://jbrowse.org/demos/hpylori/26695_vs_chc155.pif.gz',
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'TBI',
              location: {
                uri: 'https://jbrowse.org/demos/hpylori/26695_vs_chc155.pif.gz.tbi',
                locationType: 'UriLocation',
              },
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: [['hpylori_reversed_assembly_names']],
          collapseEmptyRows: true,
          levelHeights: [200],
          views: [
            { assembly: 'hpylori_26695', loc: 'NC_018939.1' },
            { assembly: 'hpylori_chc155', loc: 'NZ_AP026446.1' },
          ],
        },
      ],
    }),
    // the warning icon IS the subject, so it is also the ready signal: it
    // appears when the load-time check has resolved, which is later than the
    // canvas reporting an empty draw
    readySelector: '[aria-label*="synteny warning"]',
    readyTimeout: 120000,
    settleMs: 6000,
    // an empty band is the point here, so the shoot-time settled check has to
    // allow a view with nothing drawn in it
    allowUnsettled: true,
    viewportHeight: 425,
    actions: [
      { type: 'click', selector: '[aria-label*="synteny warning"]' },
      { type: 'waitForText', text: 'Synteny warnings' },
      { type: 'delay', ms: 1500 },
    ],
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
    // Left at the default 800 despite ~380px of page background under the
    // bottom frame. The drag below is a raw dotplot-canvas coordinate, so any
    // height change moves the block it is aimed at and the launch never
    // happens: tried 440, the synteny canvas never appeared. Re-deriving the
    // drag is the prerequisite, not the height.
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
      { type: 'waitForText', text: 'Linear synteny view' },
      { type: 'delay', ms: 1000 },
    ],
    stages: [
      // top frame: the context menu left open by the shared actions above
      {},
      // bottom frame: launch the linear synteny view, close the now-redundant
      // dotplot view (views[0], so the first close_view button) and let it draw
      {
        actions: [
          { type: 'click', text: 'Linear synteny view' },
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
  // A chromosome against itself, which no pairwise plot can produce: the filled
  // wedge on the diagonal at ~9.3 Mb is the TSPY tandem array, and the lattice
  // of off-diagonal crossings at 21-26 Mb is the Yq palindrome family, each arm
  // meeting its own inverted copy.
  //
  // The alignment covers chrY:2,700,000-26,600,000 (PAR1 through the end of the
  // euchromatic MSY), so the view frames that rather than the whole chromosome:
  // Yq12 is ~30 Mb of DYZ satellite that minimap2 with -P does not finish on in
  // reasonable time, and it would be empty here.
  //
  // 25 kb minimum. Below ~30 kb the dispersed repeats black the plot out
  // entirely, above ~100 kb only the palindromes survive.
  //
  // The config's two assemblies read a two-line chrY chrom.sizes checked in
  // beside it rather than UCSC's hs1.chrom.sizes.txt, which is what this spec
  // originally used. hgdownload timed the fetch out mid-render and failed the
  // spec, and a remote file that only ever supplies one line's worth of
  // information here is not worth the dependency. It also keeps hs1's other
  // ~2000 contigs off both axes.
  //
  // If this ever hangs with no error, suspect a remote fetch rather than
  // anything about the config: an assembly named after a refName it contains
  // was the first theory and it is wrong, verified by rendering that exact
  // naming against the local chrom.sizes.
  {
    mode: 'url',
    name: 'dotplot_self_chry',
    url: sessionSpec('test_data/chry_self/config.json', {
      views: [
        {
          type: 'DotplotView',
          tracks: ['hs1_chrY_self'],
          views: [
            { assembly: 'T2T_chrY', loc: CHRY_MSY_LOCUS },
            { assembly: 'T2T_chrY_self', loc: CHRY_MSY_LOCUS },
          ],
          minAlignmentLength: 25000,
        },
      ],
    }),
    // near-square, so the diagonal reads at 45 degrees and the palindrome
    // crossings stay symmetric
    viewportWidth: 1000,
    viewportHeight: 760,
    readySelector: '[data-testid="dotplot_webgl_canvas_done"]',
    // 21 MB PIF plus the hs1 chrom.sizes, both remote
    readyTimeout: 180000,
    settleMs: 10000,
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
