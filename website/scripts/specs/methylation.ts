import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  DEMO_CONFIG,
  HG38_GENCODE_PROMOTER_TRACK,
  cascadeBoxes,
  lgvSession,
  menuCascade,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'
import { pageTrack } from './pageTrack.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const HG38_GENE_LANE = {
  trackId: 'ncbi_refseq_109_hg38_latest',
  geneGlyphMode: 'longestCoding',
  displayMode: 'compact',
  height: 90,
}

const ARABIDOPSIS_WGBS_CONFIG =
  'test_data/arabidopsis_methylation/config_emseq_bisulfite.json'
const TAIR10 = 'GCF_000001735.4'
const TAIR10_GENES = `${TAIR10}-ncbiRefSeq`

const WGBS_CRAM_ADAPTER = {
  type: 'CramAdapter',
  uri: 'https://jbrowse.org/demos/bisulfite/arabidopsis_wgbs_bisulfite.cram',
}
function wgbsContextTrack(
  context: 'CG' | 'CHG' | 'CHH',
  displayOverrides: Record<string, unknown> = {},
) {
  const label = context === 'CG' ? 'CpG' : context
  return {
    track: {
      type: 'AlignmentsTrack',
      trackId: `arabidopsis_wgbs_${context.toLowerCase()}`,
      name: `Per-read WGBS — ${label} context`,
      assemblyNames: [TAIR10],
      adapter: WGBS_CRAM_ADAPTER,
    },
    display: {
      trackId: `arabidopsis_wgbs_${context.toLowerCase()}`,
      modifications: { cytosineContext: context },
      coverage: {
        show: false,
      },
      pileup: {
        readHeight: 3,
        bases: { show: true, encoding: { color: 'bisulfite' } },
      },
      heightMode: 'fixed',
      height: 90,
      ...displayOverrides,
    },
  }
}
const WGBS_CONTEXT_COPIES = (['CG', 'CHG', 'CHH'] as const).map(c =>
  wgbsContextTrack(c),
)

// HP1's red and HP2's blue match the read lanes at this locus only.
const SNRPN_MODKIT_MULTI_TRACK = pageTrack(
  'tutorials/methylation.md',
  'HG002_snrpn_modkit_multi',
)

const IMPRINTED_SMOOTHED_TRACK = pageTrack(
  'tutorials/methylation.md',
  'HG002_imprinted_5mC_smoothed',
)

function imprintedMarksWithFrame(rows: number) {
  const [display] = IMPRINTED_SMOOTHED_TRACK.displays as {
    marks: { transform?: { type: string; frame?: unknown }[] }[]
  }[]
  return display!.marks.map(mark => ({
    ...mark,
    ...(mark.transform
      ? {
          transform: mark.transform.map(step =>
            step.type === 'window' ? { ...step, frame: [-rows, rows] } : step,
          ),
        }
      : {}),
  }))
}

function imprintedPanel(loc: string, marks?: unknown[]) {
  return sessionSpec(DEMO_CONFIG, {
    sessionTracks: [IMPRINTED_SMOOTHED_TRACK],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc,
        tracks: [
          {
            trackId: 'cpgisland_ucsc_hg38',
            type: 'LinearBasicDisplay',
            height: 40,
          },
          HG38_GENE_LANE,
          {
            trackId: 'HG002_imprinted_5mC_smoothed',
            height: 300,
            forceLoad: true,
            ...(marks ? { marks } : {}),
          },
        ],
      },
    ],
  })
}

// Shared by the contexts figure and the epigenomics tour, so both show the
// same lanes.
const ARABIDOPSIS_CONTEXT_LANES = [
  { trackId: TAIR10_GENES },
  // The RefSeq genes carry nothing over the transposon, so this lane is the
  // callout's evidence. A `rows` partition by repeat class drops the
  // per-feature label the callout points at. The 1 kb filter drops four short
  // repeats and keeps the 5.1 kb element.
  {
    trackId: `${TAIR10}-repeatMasker`,
    filter: ['jexl:feature.end-feature.start>1000'],
    height: 50,
  },
  {
    trackId: 'arabidopsis_methyldackel',
    mark: 'bar',
    encoding: {
      y: {
        scale: { domainMin: 0, domainMax: 100 },
        axis: { title: '% methylated' },
      },
    },
    height: 170,
  },
]

// videos/methylation.ts films the route between these two states, starting
// from `grouped: false`.
const snrpnReadsPanel = ({ grouped = false, unmarked = true } = {}) =>
  lgvSession(DEMO_CONFIG, {
    assembly: 'hg38',
    loc: 'chr15:24,948,000-24,962,000',
    tracks: [
      {
        trackId: 'cpgisland_ucsc_hg38',
        type: 'LinearBasicDisplay',
        height: 40,
      },
      HG38_GENE_LANE,
      {
        trackId: 'HG002_snrpn_5mC_reads',
        height: 320,
        forceLoad: true,
        ...(grouped ? { facet: 'tags.HP' } : {}),
        pileup: { bases: { show: true, encoding: { color: 'modifications' } } },
        modifications: { unmodified: unmarked ? 'all' : 'hidden' },
      },
    ],
  })

export const methylationVideoFixtures = {
  ungrouped: snrpnReadsPanel(),
  readsTrackId: 'HG002_snrpn_5mC_reads',
  bamUrl:
    'https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam',
  readsAbsent: lgvSession(DEMO_CONFIG, {
    assembly: 'hg38',
    loc: 'chr15:24,953,500-24,957,500',
    tracks: [
      {
        trackId: 'cpgisland_ucsc_hg38',
        type: 'LinearBasicDisplay',
        height: 40,
      },
      HG38_GENE_LANE,
    ],
  }),
}

// Taller lane and reads than the figure's copies: a video plays at
// deviceScaleFactor 1, where a 3px read is three screen pixels.
export const bisulfiteVideoFixtures = {
  wgbsTrackId: 'arabidopsis_wgbs',
  cpgPileup: lgvSession(ARABIDOPSIS_WGBS_CONFIG, {
    assembly: TAIR10,
    loc: 'chr1:4,398,000-4,412,000',
    tracks: [
      ...ARABIDOPSIS_CONTEXT_LANES,
      {
        trackId: 'arabidopsis_wgbs',
        modifications: { cytosineContext: 'CG' },
        coverage: { show: false },
        pileup: {
          readHeight: 5,
          bases: { show: true, encoding: { color: 'bisulfite' } },
        },
        heightMode: 'fixed',
        height: 200,
      },
    ],
  }),
}

export const methylationSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'methylation/arabidopsis_wgbs_contexts',
    url: sessionSpec(ARABIDOPSIS_WGBS_CONFIG, {
      sessionTracks: WGBS_CONTEXT_COPIES.map(c => c.track),
      views: [
        {
          type: 'LinearGenomeView',
          assembly: TAIR10,
          loc: 'chr1:4,398,000-4,412,000',
          tracks: [
            ...ARABIDOPSIS_CONTEXT_LANES,
            ...WGBS_CONTEXT_COPIES.map(c => c.display),
          ],
        },
      ],
    }),
    readyText: 'MethylDackel',
    readyTimeout: 90000,
    viewportHeight: 995,
    // The aggregate lane's three rows sit ~57px apart in its 170px container;
    // dx -690 puts each pill near the data area's left edge.
    annotations: [
      // TAIR10_Transposable_Elements.txt names the element AT1TE14315
      // (META1, LTR/Copia). Ensembl Plants' AT4TE22180 is a chr4 id, so take
      // names from TAIR. The left label stops at "CpG only" because what
      // gene-body methylation does is contested.
      {
        type: 'text' as const,
        text: 'expressed gene body: CpG only',
        fontSize: 20,
        anchor: {
          trackId: TAIR10_GENES,
          // AT1G12930's span, from NM_101164.5
          loc: 'chr1:4,398,322-4,405,669',
          fracY: 1,
          dy: -16,
        },
      },
      {
        type: 'text' as const,
        text: 'LTR/Copia transposon, silenced: all three contexts',
        fontSize: 20,
        maxWidth: 300,
        anchor: {
          trackId: TAIR10_GENES,
          loc: 'chr1:4,405,996-4,411,119',
          fracY: 1,
          dy: -16,
        },
      },
      ...(['CpG', 'CHG', 'CHH'] as const).map((text, i) => ({
        type: 'text' as const,
        anchor: {
          selector:
            '[data-testid^="trackRenderingContainer-"][data-testid$="-arabidopsis_methyldackel"]',
        },
        dx: -690,
        dy: (i - 1) * 57,
        fontSize: 22,
        text,
      })),
      ...(
        [
          ['cg', 'CpG'],
          ['chg', 'CHG'],
          ['chh', 'CHH'],
        ] as const
      ).map(([ctx, text]) => ({
        type: 'text' as const,
        anchor: {
          selector: `[data-testid^="trackRenderingContainer-"][data-testid$="-arabidopsis_wgbs_${ctx}"]`,
        },
        dx: -690,
        fontSize: 22,
        text,
      })),
    ],
  },
  // PAY22766 is the Hia5-treated sample, PBA15131 the no-enzyme control.
  // Data: https://epi2me.nanoporetech.com/chromatin-acc-hg002/
  {
    mode: 'url',
    name: 'methylation/chromatin_accessibility_6ma',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG38_GENCODE_PROMOTER_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          // The 6mA peak needs flanking background to read as significant.
          loc: 'chr12:6,528,000-6,543,000',
          tracks: [
            // The hub gene track has unlabeled pseudogene entries upstream of
            // GAPDH here.
            {
              trackId: 'ncbi_refseq_109_hg38_latest',
              geneGlyphMode: 'longestCoding',
            },
            'gencode_promoter_hg38_ucsc',
            {
              trackId: 'PAY22766-nanopore',
              // Past the BAM byte budget; without forceLoad both lanes banner.
              forceLoad: true,
              // The basecaller also emits 5mC/5hmC; the allow-list keeps 6mA.
              modifications: { shownModifications: ['a'] },
              // displayMode is not a slot on this display; fixed height and
              // readHeight make the rows compact.
              heightMode: 'fixed',
              pileup: {
                readHeight: 3,
                bases: { show: true, encoding: { color: 'modifications' } },
              },
              legend: { show: true },
            },
            {
              trackId: 'PBA15131-nanopore',
              forceLoad: true,
              modifications: { shownModifications: ['a'] },
              heightMode: 'fixed',
              pileup: {
                readHeight: 3,
                bases: { show: true, encoding: { color: 'modifications' } },
              },
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    // Below 1030 the bottom lane clips.
    viewportHeight: 1030,
    // The pills sit over the left flank, where 6mA density is lowest, clear of
    // the promoter peak.
    annotations: [
      {
        type: 'text' as const,
        text: 'Hia5-treated',
        fontSize: 22,
        anchor: {
          trackId: 'PAY22766-nanopore',
          loc: 'chr12:6,530,200',
          fracY: 0.28,
        },
      },
      {
        type: 'text' as const,
        text: 'No-enzyme control',
        fontSize: 22,
        anchor: {
          trackId: 'PBA15131-nanopore',
          loc: 'chr12:6,530,200',
          fracY: 0.28,
        },
      },
    ],
  },

  {
    mode: 'url',
    name: 'methylation/hg002_snrpn_ungrouped',
    url: snrpnReadsPanel(),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 90000,
    viewportHeight: 730,
    // The track menu tooltip persists after the click, and the parked cursor
    // raises a read tooltip.
    hideSelectors: ['.MuiTooltip-popper'],
    tooltip: 'hide',
    actions: [
      trackMenuIcon('HG002_snrpn_5mC_reads'),
      ...menuCascade(['Group by...', 'Tag...']),
    ],
    annotations: cascadeBoxes(['Group by...', 'Tag...']),
  },

  {
    mode: 'url',
    name: 'methylation/hg002_snrpn_grouped',
    url: snrpnReadsPanel({ grouped: true }),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 90000,
    viewportHeight: 730,
    // HP: 1 is the first group, so `dy` drops its pill off the track header.
    annotations: [
      {
        type: 'text',
        text: 'HP1',
        anchor: { text: 'HP: 1', alignX: 'right', dx: 90, dy: 18 },
      },
      {
        type: 'text',
        text: 'HP2',
        anchor: { text: 'HP: 2', alignX: 'right', dx: 90 },
      },
      {
        type: 'text',
        text: 'HP unknown',
        anchor: { text: 'HP: none', alignX: 'right', dx: 90 },
      },
    ],
  },

  {
    mode: 'compose',
    name: 'methylation/hg002_snrpn_group_by_hp',
    parts: [
      'methylation/hg002_snrpn_ungrouped',
      'methylation/hg002_snrpn_grouped',
    ],
  },

  {
    mode: 'url',
    name: 'methylation/hg002_snrpn_marked_only',
    url: snrpnReadsPanel({ unmarked: false }),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 90000,
    // Below 742 the bottom lane clips.
    viewportHeight: 742,
    hideSelectors: ['.MuiTooltip-popper'],
    tooltip: 'hide',
    annotations: [
      {
        type: 'text',
        text: 'Modified positions only',
        anchor: { text: 'HG002 ONT reads', alignX: 'right', dx: 90 },
      },
    ],
  },

  {
    mode: 'url',
    name: 'methylation/hg002_snrpn_fill_unmarked',
    url: snrpnReadsPanel(),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 90000,
    // Below 742 the bottom lane clips.
    viewportHeight: 742,
    hideSelectors: ['.MuiTooltip-popper'],
    tooltip: 'hide',
    annotations: [
      {
        type: 'text',
        text: 'Every CpG filled in',
        anchor: { text: 'HG002 ONT reads', alignX: 'right', dx: 90 },
      },
    ],
  },

  {
    mode: 'compose',
    name: 'methylation/hg002_snrpn_mod_modes',
    parts: [
      'methylation/hg002_snrpn_marked_only',
      'methylation/hg002_snrpn_fill_unmarked',
    ],
  },

  {
    mode: 'url',
    name: 'methylation/hg002_snrpn_combined',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [SNRPN_MODKIT_MULTI_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr15:24,948,000-24,962,000',
          tracks: [
            {
              trackId: 'cpgisland_ucsc_hg38',
              type: 'LinearBasicDisplay',
              height: 40,
            },
            HG38_GENE_LANE,
            {
              trackId: 'HG002_snrpn_modkit_multi',
              height: 170,
            },
            {
              trackId: 'HG002_snrpn_5mC_reads',
              height: 460,
              forceLoad: true,
              facet: 'tags.HP',
              pileup: {
                bases: { show: true, encoding: { color: 'modifications' } },
              },
              modifications: { unmodified: 'all' },
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 90000,
    viewportHeight: 1085,
    // The HP tags are arbitrary: read which haplotype is methylated off the
    // render.
    annotations: [
      {
        type: 'text',
        text: 'HP1',
        // HP: 1 is the first group; without dy its pill overhangs the header.
        anchor: { text: 'HP: 1', alignX: 'right', dx: 90, dy: 18 },
      },
      {
        type: 'text',
        text: 'HP2',
        anchor: { text: 'HP: 2', alignX: 'right', dx: 90 },
      },
      {
        type: 'text',
        text: 'HP unknown',
        anchor: { text: 'HP: none', alignX: 'right', dx: 90 },
      },
    ],
  },

  {
    mode: 'url',
    name: 'methylation/hg002_imprinted_smoothed',
    url: imprintedPanel('chr15:24,800,000-25,200,000'),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 90000,
    viewportHeight: 725,
  },

  {
    mode: 'url',
    name: 'methylation/hg002_imprinted_domain',
    url: imprintedPanel(
      'chr15:22,200,000-26,900,000',
      imprintedMarksWithFrame(500),
    ),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 90000,
    viewportHeight: 725,
  },
]
