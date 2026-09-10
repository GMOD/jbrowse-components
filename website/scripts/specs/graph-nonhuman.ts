// The two non-human pangenome graphs, for the pangenome_nonhuman tutorial:
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
import {
  TOOLBAR_READY,
  local,
  referencePositionColor,
} from './graph-fixtures.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const CONFIG = local('test_data/graphgenomeview/pangenome_nonhuman.json')

// ---------------------------------------------------------------------------
// Mouse
// ---------------------------------------------------------------------------

// Nnt, and the reason this is the page's first figure rather than the H2 locus
// a mouse geneticist would expect: it is the clearest demonstration in either
// graph that a reference-anchored pangenome states variation RELATIVE to its
// backbone, not absolutely.
//
// C57BL/6J carries a well-known five-exon deletion in Nnt (exons 7-11,
// published as ~17.8 kb) which abolishes the protein and is why B6J is glucose
// intolerant. mm39 IS C57BL/6J. So the graph's backbone is the strain with the
// deletion, and the deletion appears as an INSERTION the other strains carry --
// the opposite sign from every description in the literature.
//
// Measured off the hosted allele inventory rather than assumed:
//   tabix …alleles.bed.gz chr13:119440000-119600000
// gives exactly one allele over 10 kb in the window, `ins` 16,458 bp at
// chr13:119,511,984-119,511,997 with CIGAR 13M16458I, inside Nnt
// (chr13:119,472,063-119,566,380 per the mm39 RefSeq annotation). Three smaller
// insertions sit beside it: 7,101 bp, 4,313 bp and 1,290 bp.
//
// 16,458 is NOT 17,800, and the caption does not claim it is. minigraph's
// insertion is the non-reference sequence the other strains carry at that
// point, which is a different measurement from a deletion's breakpoint span on
// the B6 side; the two agree in scale and in position and that is all this
// figure asserts.
const NNT_REGION = {
  refName: 'chr13',
  assemblyName: 'mm39',
  start: 119_440_000,
  end: 119_600_000,
}
const NNT_LOC = 'chr13:119,440,000-119,600,000'

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
  viewportHeight: 1320,
  hideTooltip: true,
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
const BOLA_REGION = {
  refName: 'chr23',
  assemblyName: 'bosTau9',
  start: 25_844_769,
  end: 25_968_809,
}
const BOLA_LOC = 'chr23:25,844,769-25,968,809'

// Whole bosTau9 chr23 off the coarse tier. The scale claim, and the cheapest
// possible check that the tier is not a human-only trick: 52.5 Mb of cattle
// chromosome in a few hundred nodes, where the FINE segments track over the
// same span refuses with "Too many features".
//
// maxRegionBp is what makes it drawable: the view's 5 Mb ceiling is a proxy for
// node count and a good one only at segment granularity, so a session pointed
// at a tier says otherwise. maxGraphNodes is untouched and still counts what
// came back.
const CHR23_LENGTH = 52_498_615
const CHR23_REGION = {
  refName: 'chr23',
  assemblyName: 'bosTau9',
  start: 0,
  end: CHR23_LENGTH,
}

export const nonHumanGraphSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'pangenome/mouse_nnt',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          id: 'mouse-nnt-lgv',
          assembly: 'mm39',
          loc: NNT_LOC,
          // EVERY LANE IS SIZED, and the first version of this spec passed bare
          // trackIds instead. That is not a cosmetic difference here: an
          // AlignmentsTrack defaults to LinearAlignmentsDisplay, which stacks a
          // coverage band over the pileup and claims ~350 px, so the four lanes
          // filled the viewport, pushed the GraphGenomeView entirely below the
          // fold, and the graph never drew. The run then failed on TOOLBAR_READY
          // — a five-minute timeout whose message is about a selector and says
          // nothing about height.
          tracks: [
            {
              trackId: 'mm39_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              height: 80,
            },
            // 70 CLIPPED IT, and the clip was through the middle of a
            // label rather than at a row boundary, which reads as a broken
            // render. 29 bubbles over this window pack into three rows of
            // (tick, span, "N segments, up to M paths") at ~39 CSS px each, so
            // anything under ~120 cuts the third row's second line. Same
            // arithmetic for the segments lane below: 56 segments, four rows at
            // ~31 px. The run's own SLACK_WARN_PX check reports the other
            // direction, so an over-tall viewport does not go unnoticed.
            {
              trackId: 'mouse_minigraph_bubbles',
              type: 'LinearBasicDisplay',
              height: 125,
            },
            // The lane that carries the 16 kb claim, and PILEUP rather than the
            // default: the allele inventory's rows are the alleles themselves,
            // each drawn at its real magnitude off its CIGAR, so the coverage
            // band above them is counting rows rather than measuring anything.
            // A plain feature track would put the 16 kb insertion and a 50 bp
            // one on the same 2 px floor, which is the whole reason this file
            // is read as alignments at all.
            {
              trackId: 'mouse_minigraph_alleles',
              type: 'LinearPileupDisplay',
              height: 100,
            },
            {
              trackId: 'mouse_minigraph_segments',
              type: 'LinearBasicDisplay',
              height: 130,
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          displayName: 'Nnt graph',
          loadedTrackId: 'mouse_minigraph_segments',
          loadedRegion: NNT_REGION,
          connectedViewId: 'mouse-nnt-lgv',
          colorScheme: 'reference-position',
          // Anchored, for the reason spelled out on the H2 figure below: 29
          // bubbles over 160 kb is a chain, and a force layout of a chain is an
          // arc. Anchored also puts the 16 kb insertion directly under the
          // point in Nnt where it attaches, which is the figure's whole subject.
          layoutMode: 'auto',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 300000,
    settleMs: 12000,
    viewportWidth: 1400,
    viewportHeight: 1105,
    hideTooltip: true,
  },
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
              height: 70,
            },
            {
              trackId: 'bovine_minigraph_alleles',
              type: 'LinearPileupDisplay',
              height: 90,
            },
            // The lane the graph cannot replace. One row per assembly, so the
            // nine-allelic site at 25,864,769 reads as nine different colors
            // across eleven rows rather than as one wide box. 11 rows at ~17 px
            // is the floor that keeps the row labels legible.
            {
              trackId: 'bovine_pangenome_vcf',
              type: 'LinearMultiSampleVariantDisplay',
              height: 190,
            },
            {
              trackId: 'bovine_minigraph_segments',
              type: 'LinearBasicDisplay',
              height: 80,
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          displayName: 'BoLA graph',
          loadedTrackId: 'bovine_minigraph_segments',
          loadedRegion: BOLA_REGION,
          connectedViewId: 'bovine-bola-lgv',
          colorScheme: 'reference-position',
          // Anchored, same finding as both mouse figures: 90 nodes and 118
          // edges is a chain with two loops in it, and the force layout drew it
          // as one loop plus a disconnected 22.6 kb stub running off the frame.
          // Anchored puts the two big insertions under the reference span they
          // replace, which is where the callset lane above says they are.
          layoutMode: 'auto',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 300000,
    settleMs: 15000,
    viewportWidth: 1400,
    viewportHeight: 1180,
    hideTooltip: true,
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
              // The graph pane's own ramp over the same span, so a block up
              // here and the node it is are the same color.
              color: referencePositionColor(CHR23_REGION),
              height: 60,
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          displayName: 'chr23 graph (bubble tier)',
          loadedTrackId: 'bovine_minigraph_tier',
          loadedRegion: CHR23_REGION,
          maxRegionBp: CHR23_LENGTH,
          connectedViewId: 'bovine-chr23-lgv',
          colorScheme: 'reference-position',
          // Anchored: the tier is one node per bubble in reference order with
          // one edge between consecutive bubbles, so it is a PATH, and a force
          // layout of a path is a long wiggly line that says nothing about the
          // chromosome. Same finding as the HPRC chr1 figure.
          layoutMode: 'auto',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 300000,
    settleMs: 15000,
    viewportWidth: 1400,
    viewportHeight: 780,
    hideTooltip: true,
  },
]
