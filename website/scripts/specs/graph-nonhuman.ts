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

// The H2 complex, mouse's MHC and the locus the mouse pangenome literature
// leads with. Window picked by measurement, like the loci on the HPRC page: the
// hosted files report 44 bubbles and 94 segments over this 150 kb, against 503
// segments for the full K-to-D span (chr17:34.2-35.5 Mb), which draws as a
// thread. So this is the widest cut of H2 that stays legible.
//
// It is legible ANCHORED, which is the correction to make if you are reading
// this against the HPRC page's force figures: 94 segments here is not the same
// picture as 94 segments there. See the layoutMode comment on the view below.
const H2_REGION = {
  refName: 'chr17',
  assemblyName: 'mm39',
  start: 34_140_000,
  end: 34_290_000,
}
const H2_LOC = 'chr17:34,140,000-34,290,000'

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
            {
              trackId: 'mouse_minigraph_bubbles',
              type: 'LinearBasicDisplay',
              height: 70,
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
              height: 80,
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
    viewportHeight: 1000,
    hideTooltip: true,
  },
  {
    mode: 'url',
    name: 'pangenome/mouse_h2',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          id: 'mouse-h2-lgv',
          assembly: 'mm39',
          loc: H2_LOC,
          tracks: [
            'mm39_ncbiRefSeq_ucsc',
            'mouse_bubble_score',
            'mouse_minigraph_segments',
          ],
        },
        {
          type: 'GraphGenomeView',
          displayName: 'H2 class I graph',
          loadedTrackId: 'mouse_minigraph_segments',
          loadedRegion: H2_REGION,
          connectedViewId: 'mouse-h2-lgv',
          colorScheme: 'reference-position',
          // ANCHORED, and the force layout was RENDERED here first rather than
          // declined on the HPRC figures' reasoning. It does not work, and the
          // pane's own header says why: the cut is 149 nodes and 206 edges,
          // which on a connected drawing is barely more than the n-1 of a path.
          // An SV-resolution graph over 150 kb of mouse is a chain with a few
          // small loops in it -- 44 bubbles over the window -- so the force
          // layout draws one long arc at 17% zoom that runs off the bottom of
          // the frame with nothing about H2 legible in it.
          //
          // This is the general shape of the two non-human graphs and the main
          // way they differ from HPRC's in practice: the HPRC force figures sit
          // at loci where 90 haplotypes make genuinely tangled bubbles (C4,
          // amylase, MHC class II), and neither of these panels has that
          // density anywhere. Anchored puts every x on a GRCm39 coordinate, so
          // the backbone runs under the linear view's axis and each allele
          // hangs below where it attaches, which is the readable form here.
          layoutMode: 'auto',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 300000,
    settleMs: 12000,
    viewportWidth: 1400,
    viewportHeight: 860,
    hideTooltip: true,
  },
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
