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
import { GRAPH_DRAWN, cutNear, graphTrack, local } from './graph-fixtures.ts'

import type {
  ScreenshotSpec,
  SessionUrlSpec,
} from '../screenshot-spec-types.ts'

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
          graphTrack('mouse_minigraph_segments', {
            layoutMode: 'force',
            paneHeight: 600,
            colorScheme: 'reference-position',
            showBubbles: true,
          }),
        ],
      },
    ],
  }),
  readySelector: GRAPH_DRAWN,
  readyTimeout: 300000,
  viewportWidth: 1400,
  // A force layout of this cut needs the room: the panel's point is its
  // topology, and the graph track takes up to 600 px.
  viewportHeight: 1150,
  hideTooltip: true,
  annotations: [
    {
      type: 'text',
      text: 'C57BL/6J, the reference',
      fontSize: 18,
      leader: true,
      anchor: { graphNode: 's110010685+' },
      dx: -60,
      dy: -30,
    },
    {
      type: 'text',
      text: 'sequence C57BL/6J lacks',
      fontSize: 18,
      leader: true,
      anchor: { graphNode: 's110050877+' },
      dx: -80,
      dy: -40,
    },
  ],
}

// ---------------------------------------------------------------------------
// Bovine
// ---------------------------------------------------------------------------

// Each figure below reproduces a published variant off the deconstructed
// callset, and names its carriers from the GT columns:
//
//   POLLED   chr1:2,429,329   7 bp -> 209 bp, ANG only. Medugorac et al. 2012's
//                             Celtic allele; OMIA 000483-9913 states it as
//                             g.[2429327_2429336del;2429109_2429320dupins].
//   KIT      chr6:70,099,508  REF 20,622, ALT 1 / 37,545, SIM alone on the long
//                             allele, whose nested record is one 14,320 bp
//                             unit. Milia et al. 2025, Genome Res 35:1041.
//   TAS2R46  chr5:98,587,383  REF 17,020, GAU alone on the 1 bp allele. Leonard
//                             et al. 2022 Fig 7e: 98,587,384-98,604,401.
//   HSPA1B   chr23:27,520,698 an ~11 kb insertion in every assembly bar YAK.
//                             Leonard et al. 2022 found it in all of theirs,
//                             which had no yak.
const bovineVariantLane = (height: number) => ({
  trackId: 'bovine_pangenome_vcf',
  type: 'LinearMultiSampleVariantDisplay',
  showVariantLane: true,
  height,
})

const bovineGenes = {
  trackId: 'bosTau9_ncbiRefSeq_ucsc',
  type: 'LinearBasicDisplay',
  height: 90,
}

const bovineOmia = {
  trackId: 'omia_cattle_variants',
  type: 'LinearBasicDisplay',
  height: 60,
}

function bovineLocusSpec(
  name: string,
  loc: string,
  tracks: Record<string, unknown>[],
  viewportHeight: number,
  view: Record<string, unknown> = {},
): SessionUrlSpec {
  return {
    mode: 'url',
    name,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          id: `${name.replace('/', '-')}-lgv`,
          assembly: 'bosTau9',
          loc,
          tracks,
          ...view,
        },
      ],
    }),
    readyTimeout: 300000,
    viewportWidth: 1400,
    viewportHeight,
    hideTooltip: true,
  }
}

export const mouseCattleGraphSpecs: ScreenshotSpec[] = [
  dock2Spec,
  // 1 kb, shading the 212 bp OMIA says the allele duplicates
  // (g.2429109_2429320dupins), so the Angus marker sits at the right edge of
  // the sequence it copies. At 12 kb the marker was the only thing in frame
  // and nothing said what it was a copy of. The graph track was tried here: the
  // allele is one 208 bp bump on a straight backbone and said nothing more.
  bovineLocusSpec(
    'pangenome/bovine_polled',
    'chr1:2,428,800-2,429,800',
    [bovineOmia, bovineVariantLane(260)],
    580,
    {
      highlight: [
        {
          refName: 'chr1',
          start: 2429108,
          end: 2429320,
          color: 'rgba(255,193,7,0.30)',
        },
      ],
    },
  ),
  // 300, not the 260 the other loci take: these two windows hold other-alt
  // and no-call cells, so their key runs two rows longer and lost yak off the
  // lane's bottom edge at 260. The graph track under each draws the record's
  // alleles at their own lengths: a deletion as the arc skipping the span, an
  // insertion as a node off the backbone.
  {
    ...bovineLocusSpec(
      'pangenome/bovine_kit',
      'chr6:70,080,000-70,180,000',
      [
        bovineGenes,
        bovineVariantLane(300),
        graphTrack('bovine_minigraph_segments', {
          colorScheme: 'reference-position',
          bubbleSpread: 'compress',
          paneHeight: 180,
          maxRegionBp: cutNear(100_000),
        }),
      ],
      860,
    ),
    readySelector: GRAPH_DRAWN,
  },
  {
    ...bovineLocusSpec(
      'pangenome/bovine_tas2r46',
      'chr5:98,575,000-98,615,000',
      [
        bovineGenes,
        bovineVariantLane(300),
        graphTrack('bovine_minigraph_segments', {
          colorScheme: 'reference-position',
          bubbleSpread: 'compress',
          paneHeight: 180,
          maxRegionBp: cutNear(40_000),
        }),
      ],
      860,
    ),
    readySelector: GRAPH_DRAWN,
    annotations: [
      {
        type: 'text',
        text: 'deleted in gaur',
        fontSize: 18,
        leader: true,
        anchor: {
          track: 'bovine_pangenome_vcf',
          locus: 'chr5:98,600,000',
          fracY: 0.78,
        },
        dx: 60,
        dy: -120,
      },
    ],
  },
  // The graph against the callset at one published insertion: the allele
  // inventory holds the HSPA1B segment as alleles with no carriers, the callset
  // says every assembly bar the yak has one, and the graph track the section
  // cuts draws it as the loop off the backbone.
  {
    ...bovineLocusSpec(
      'pangenome/bovine_bola',
      'chr23:27,508,000-27,536,000',
      [
        bovineGenes,
        bovineVariantLane(260),
        {
          trackId: 'bovine_minigraph_alleles',
          type: 'LinearPileupDisplay',
          height: 90,
        },
        graphTrack('bovine_minigraph_segments', {
          layoutMode: 'force',
          bubbleSpread: 'compress',
          colorScheme: 'reference-position',
          paneHeight: 420,
          maxRegionBp: cutNear(28_000),
        }),
      ],
      1190,
    ),
    readySelector: GRAPH_DRAWN,
    annotations: [
      {
        type: 'text',
        text: 'graph alleles, each sequence once, whichever assemblies have it',
        fontSize: 18,
        leader: true,
        anchor: {
          track: 'bovine_minigraph_alleles',
          locus: 'chr23:27,521,000',
          fracY: 0.45,
        },
        dx: 80,
        dy: -10,
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
