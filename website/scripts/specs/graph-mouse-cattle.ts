// The mouse and cattle pangenome graphs, for the pangenome_mouse and
// pangenome_cattle tutorials:
// a mouse strain graph built from published assemblies, and the bovine
// super-pangenome projected from Leonard et al. 2023.
//
// The human figures are specs/graph-hprc.ts and the E. coli ones
// specs/graph-ecoli.ts; all three share only what specs/graph-fixtures.ts
// holds. Kept apart from graph-hprc.ts for the reason that file names: its
// fixture is one species' graph and its constants are all human loci, and a
// third species in it would make every `HPRC_` prefix a lie.
//
// WHY THESE TWO AT ALL, since the graph route is the same one the HPRC page
// already documents: the interesting thing here is not the mechanism, it is
// what changes and what does not when the species does. Both graphs are
// SV-resolution minigraph rGFA, like HPRC's `sv.gfa` -- so the tracks, the
// adapters and the coarse tier are identical, and what differs is what the
// graph can SAY. The mouse graph has no P or W lines, so it cannot state
// carriage at all; the bovine one was reconstructed from 12 P lines and can be
// deconstructed into a VCF that does. Each figure below is picked to show one
// of those.
import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { TOOLBAR_READY, local } from './graph-fixtures.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const CONFIG = local('test_data/graphgenomeview/pangenome_nonhuman.json')

// ---------------------------------------------------------------------------
// Mouse
// ---------------------------------------------------------------------------

// Dock2, and the window this figure draws was picked by MEASUREMENT rather than
// by reputation. It replaced an H2 figure, and the replacement is the point:
// H2 is mouse's MHC and what the mouse pangenome literature leads with, so it
// was the obvious second mouse panel -- and rendering it produced a competent
// picture of nothing. 44 bubbles and 94 segments over 150 kb draws as a chain
// with a scatter of 5-91 bp loops hanging off it, and no lane on the page said
// anything a reader could not have guessed. Picked on reputation, and it showed.
//
// This window came out of the mechanism the tutorial's "Finding the loci"
// section describes: rank the coarse tier by segments per bubble (`cn:i:`) and
// name each entry off the reference annotation. Mouse's densest DRAWABLE entry
// is a single bubble --
//
//   tabix …mouse-mm39-minigraph.bubbles.bed.gz 'mm39#0#chr11:34516044-34560497'
//
// returns exactly one row: `cn` 524 segments over 44,453 bp of GRCm39, with
// alternate paths from 3,943 bp to 114,372 bp. Three bubbles in the whole graph
// hold more segments and all three are 372 kb to 2.24 Mb wide, so this is the
// densest one that fits inside what the view will cut.
//
// It is INTRONIC and the figure claims nothing else. Dock2 is
// chr11:34,176,814-34,674,732 on the minus strand with 52 exons; the nearest
// ones end at 34,464,536 and begin at 34,578,334, so the bubble sits inside one
// ~114 kb intron and touches no exon. What is being shown is where the strain
// panel varies most, not a coding consequence.
const DOCK2_REGION = {
  refName: 'chr11',
  assemblyName: 'mm39',
  start: 34_516_044,
  end: 34_560_497,
}
const DOCK2_LOC = 'chr11:34,516,044-34,560,497'

// FORCE, and the only figure in this file that is. Both layouts were rendered
// before this was decided, because the other three panels here are anchored and
// the reasoning that settled them would have settled this one too:
//
//   anchored  18 rank lanes at 2.9% zoom, each large allele named at its
//             reference position -- 6.2, 12.8, 13.7, 4.1 kb deletions and a
//             couple of dozen more. Readable, and it looks like a denser
//             version of the Nnt panel above.
//   force     20% zoom, and the cut draws as what it is: several large loops
//             off one backbone with 425 nodes and 580 edges between them.
//
// The second is the figure, because this page's note tells a reader to check
// the node and edge counts before reaching for the force layout, and a rule
// with no counterexample on the page is a preference. Every other window here
// is a chain and force draws a chain as an arc -- recorded on each of their
// views below. This one is a single bubble holding 524 segments, and it is the
// shape the note is describing.
const dock2Spec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/mouse_dock2',
  url: sessionSpec(CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        id: 'mouse-dock2-lgv',
        assembly: 'mm39',
        loc: DOCK2_LOC,
        tracks: [
          // Nothing but an intron line and the gene's name crosses this
          // window, which is the context the figure needs and all of it.
          {
            trackId: 'mm39_ncbiRefSeq_ucsc',
            type: 'LinearBasicDisplay',
            height: 48,
          },
          // One row, whose own label states the ranking metric: this is the
          // bubble the derivation returned, and the lane says 524 in text.
          {
            trackId: 'mouse_minigraph_bubbles',
            type: 'LinearBasicDisplay',
            height: 52,
          },
          // Pileup for the reason the Nnt figure's lane is: these rows are the
          // alleles themselves, drawn at real magnitude off their CIGARs, which
          // is what makes a 3.9 kb path and a 114 kb one distinguishable.
          {
            trackId: 'mouse_minigraph_alleles',
            type: 'LinearPileupDisplay',
            height: 110,
          },
          // Labels off: 231 segment rows sit on the reference path here against
          // 56 in the whole 160 kb Nnt window, so the lane's subject is density
          // and a per-segment id is unreadable at that count anyway.
          {
            trackId: 'mouse_minigraph_segments',
            type: 'LinearBasicDisplay',
            showLabels: 'none',
            height: 90,
          },
        ],
      },
      {
        type: 'GraphGenomeView',
        displayName: 'Dock2 intron graph',
        loadedTrackId: 'mouse_minigraph_segments',
        loadedRegion: DOCK2_REGION,
        connectedViewId: 'mouse-dock2-lgv',
        colorScheme: 'reference-position',
        layoutMode: 'force',
      },
    ],
  }),
  readySelector: TOOLBAR_READY,
  readyTimeout: 300000,
  settleMs: 15000,
  viewportWidth: 1400,
  // The tallest figure in the file, and the run measured it rather than the
  // spec guessing: at 1150 it reported 181 css px of the graph pane below the
  // fold. A force layout of this cut needs the room -- the whole point of the
  // panel is its topology, and a topology with its bottom third missing is not
  // one. SLACK_WARN_PX reports the other direction if this ever over-shoots.
  viewportHeight: 1260,
  hideTooltip: true,
  annotations: [
    {
      type: 'text',
      text: 'C57BL/6J, the reference',
      fontSize: 18,
      leader: true,
      anchor: { view: 1, graphNode: 's110010685+' },
      dx: 20,
      dy: -110,
    },
    {
      type: 'text',
      text: 'sequence C57BL/6J lacks',
      fontSize: 18,
      leader: true,
      anchor: { view: 1, graphNode: 's110050877+' },
      dx: -230,
      dy: 10,
    },
  ],
}

// ---------------------------------------------------------------------------
// Bovine
// ---------------------------------------------------------------------------

// The BoLA class II region around BTNL2, and the figure the whole bovine half
// exists for: it is where the graph route and the variant route say different
// things about the same 124 kb, and both are right.
//
// The graph route reports 52 segments and 7 bubbles here, with two very large
// insertions -- 157,021 bp attributed to BIS and 110,779 bp to BRA. But
// "attributed" is P-line order, not carriage: the published graphs record no
// SR, so rank is the order the 12 paths appear in and `firstSeenIn` means "the
// first of that fixed order carrying this segment". Nothing in the BED files
// can say who else has it.
//
// The variant route can. `vg deconstruct` over the same graph gives 26 records
// in this window, and the site at chr23:25,864,769 is NINE-allelic with a
// reference span of 84 kb and a longest alternate of 362 kb; its GT row reads
// 1 2 3 4 1 5 6 7 8 9 1, i.e. ANG, GAU and YAK share one allele and the other
// eight assemblies each carry their own. That is a cattle MHC behaving exactly
// like the human one, and it is invisible in the graph lanes.
const BOLA_LOC = 'chr23:25,844,769-25,968,809'

export const mouseCattleGraphSpecs: ScreenshotSpec[] = [
  dock2Spec,
  {
    mode: 'url',
    name: 'pangenome/bovine_bola',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          id: 'bovine-bola-lgv',
          assembly: 'bosTau9',
          loc: BOLA_LOC,
          // Sized for the same reason the mouse figure's lanes are, and this is
          // the one where it bit hardest: the allele inventory plus an
          // eleven-row genotype lane at default heights took the whole viewport
          // and the graph pane never drew.
          tracks: [
            {
              trackId: 'bosTau9_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              height: 90,
            },
            {
              trackId: 'bovine_minigraph_bubbles',
              type: 'LinearBasicDisplay',
              height: 90,
            },
            // One row per assembly, so the nine-allelic site at 25,864,769
            // reads across eleven rows rather than as one wide box. 11 rows at
            // ~17 px is the floor that keeps the row labels legible.
            {
              trackId: 'bovine_pangenome_vcf',
              type: 'LinearMultiSampleVariantDisplay',
              height: 190,
            },
            {
              trackId: 'bovine_minigraph_alleles',
              type: 'LinearPileupDisplay',
              height: 90,
            },
          ],
        },
      ],
    }),
    readyTimeout: 300000,
    settleMs: 15000,
    viewportWidth: 1400,
    // No graph pane and no segments lane (review: "unclear what i'm looking
    // at"): the anchored drawing's rank rows restated the lanes, and what the
    // figure compares is the graph's lanes against the callset.
    viewportHeight: 800,
    hideTooltip: true,
    annotations: [
      {
        type: 'text',
        text: 'each red row is a different allele',
        fontSize: 18,
        leader: true,
        anchor: {
          track: 'bovine_pangenome_vcf',
          locus: 'chr23:25,905,000',
          fracY: 0.2,
        },
        dx: 30,
        dy: -70,
      },
      {
        type: 'text',
        text: 'the graph names no carrier',
        fontSize: 18,
        leader: true,
        anchor: {
          track: 'bovine_minigraph_alleles',
          locus: 'chr23:25,935,000',
          fracY: 0.45,
        },
        dx: -60,
        dy: 30,
      },
    ],
  },
  {
    mode: 'url',
    name: 'pangenome/bovine_whole_chromosome',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          id: 'bovine-chr23-lgv',
          assembly: 'bosTau9',
          loc: 'chr23',
          tracks: [
            'bosTau9_ncbiRefSeq_ucsc',
            'bovine_bubble_score',
            {
              trackId: 'bovine_minigraph_tier',
              type: 'LinearBasicDisplay',
              showLabels: 'none',
              height: 60,
            },
          ],
        },
      ],
    }),
    readyTimeout: 300000,
    settleMs: 15000,
    viewportWidth: 1400,
    viewportHeight: 550,
    hideTooltip: true,
    annotations: [
      {
        type: 'text',
        text: 'BoLA',
        fontSize: 18,
        leader: true,
        anchor: {
          track: 'bovine_bubble_score',
          locus: 'chr23:25,900,000',
          fracY: 0.15,
        },
        dx: -100,
        dy: -10,
      },
    ],
  },
]
