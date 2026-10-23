import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { pageTrack } from './pageTrack.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'
import type { PageTrackConfig } from './pageTrack.ts'

// LD heatmap figures: the LCT/MCM6 lactase sweep from PLINK r² tables over the
// 1000 Genomes 30x release on hg38, and the Anopheles 2La inversion.
//
// The hosted LCT files carry `1kg38` in their names. Never reuse or delete the
// old hg19 `1kg` names: the bucket has no versioning and released docs link
// them. Slices come from scripts/build_lct_ld.sh over the 2504 unrelated
// samples; relatives inflate LD.
//
// Don't stack two human population panels: this page contrasts pooled against
// one panel, an analysis choice. Add no inversion figure without per-sample
// genotypes behind it.
const HG38_HUB = 'https://jbrowse.org/ucsc/hg38/config.json'
const LD_HUMAN_DOC = 'tutorials/ld_human.md'

// build_lct_ld.sh prints mean r² against rs4988235 in 100 kb bins: the block
// runs about 135.0-136.25 Mb and both edges of this frame sit in the noise.
const LCT_LOC = 'chr2:134,000,000-137,150,000'

// If this render seems to hang, look for a second `generate-screenshots`
// process before shrinking the window.
const LCT_WIDE_LOC = LCT_LOC

const DECODE_RECOMB_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'decode_recomb',
  name: 'deCODE recombination rate (cM/Mb, pedigree)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://hgdownload.soe.ucsc.edu/gbdb/hg38/recombRate/recombAvg.bw',
  },
}

const LCT_HIGHLIGHT = [
  {
    refName: 'chr2',
    start: 135_787_850,
    end: 135_876_467,
    assemblyName: 'hg38',
  },
]

// scripts/build_ag1000g_ld.sh builds the 2L r² from Ag1000G phase 2 AR1 phased
// haplotypes and prints the evidence behind each choice here. Phase 2 because
// Ag3's URLs return 403 to anonymous callers and phase 3 terms still restrict
// first analyses; the tutorial carries the citation phase 2 asks for.
//
// Cameroon segregates both arrangements; Gabon is near-fixed for one, which
// makes it the control. Gabon still has a block near Vgsc, so don't caption it
// as blank, and don't crop to 2La: the decaying Vgsc block is the contrast to
// the solid 2La one.
//
// r², not D': D' also tints the region outside the span.
//
// anoGam3 is AgamP3 and the LD is on AgamP4; the arms are byte-identical
// between the two. The hub's chromAlias maps the file's `2L` to `chr2L`.
const ANOGAM3_HUB = 'https://jbrowse.org/ucsc/anoGam3/config.json'

type AgPopulation = 'CMgam' | 'GAgam'
// The page loads its own AgamP4 assembly; the figure moves its tracks onto the
// anoGam3 hub.
function agPageTrack(
  cameroonTrackId: string,
  pop: AgPopulation,
): PageTrackConfig {
  const cameroon = pageTrack('tutorials/ld_mosquitoes.md', cameroonTrackId)
  const track = JSON.parse(
    JSON.stringify(cameroon)
      .replaceAll('CMgam', pop)
      .replaceAll('cmgam', pop.toLowerCase()),
  ) as typeof cameroon
  return { ...track, assemblyNames: ['anoGam3'] }
}

// An unsquashed LD panel puts its apex half the drawn width down. 2La draws
// 653 px wide, so a lane under 327 px cuts the block flat at its boundary.
// `heightMode: 'fit'` turned the block into a pale hatched wedge.
const agLdTrack = (pop: AgPopulation, name: string, height: number) => {
  const track = agPageTrack('ag1000g_2l_cmgam', pop)
  const [display] = track.displays as Record<string, unknown>[]
  return { ...track, name, displays: [{ ...display, height }] }
}

// Published extents, independent of the LD: 2La from White et al. 2007, Vgsc
// (AGAP004707) from Ensembl Metazoa on AgamP4.
const AG_LOCI_TRACK = {
  type: 'FeatureTrack',
  trackId: 'ag1000g_2l_loci',
  name: '2L loci',
  assemblyNames: ['anoGam3'],
  adapter: {
    type: 'FromConfigAdapter',
    adapterId: 'ag1000g_2l_loci',
    features: [
      {
        uniqueId: 'vgsc',
        refName: 'chr2L',
        start: 2358158,
        end: 2431617,
        name: 'Vgsc',
        type: 'gene',
      },
      {
        uniqueId: 'two_la',
        refName: 'chr2L',
        start: 20524058,
        end: 42165532,
        name: '2La',
        type: 'inversion',
      },
    ],
  },
}

// build_ag1000g_ld.sh infers each karyotype from the Love et al. 2019 tag SNPs
// and prints the score histogram. One track per population: the display has no
// sample filter, and a 1px row has no room for a label, so the track header
// names the population.
//
// The legend is clipped to its display and is about 192 css px tall, so it
// sets a height floor.
const agKaryotypeTrack = (
  pop: AgPopulation,
  name: string,
  height: number,
  showLegend: boolean,
) => {
  const track = agPageTrack('ag1000g_2la_karyotype_cmgam', pop)
  const [display] = track.displays as Record<string, unknown>[]
  return {
    ...track,
    name,
    displays: [{ ...display, legend: { show: showLegend }, height }],
  }
}

// Per-site Weir & Cockerham Fst, the European panel against the other 2001
// unrelated samples, from build_lct_ld.sh, which prints rs4988235's rank. Keep
// it per site: 10 kb windows average the swept haplotype into the flanks.
const LCT_FST_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'kgp_lct_fst',
  name: 'Fst, European panel vs the other 1000 Genomes samples (Weir & Cockerham)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigWigAdapter',
    bigWigLocation: {
      uri: 'https://jbrowse.org/demos/popgen/lct_1kg38_chr2_fst_eur_vs_rest.bw',
      locationType: 'UriLocation',
    },
    // A zoom bin averages ninety variants into background and drops the peak.
    resolutionMultiplier: 0.001,
  },
}

const lctPanelTrack = (trackId: string, name: string, file: string) => ({
  type: 'LDTrack',
  trackId,
  name,
  assemblyNames: ['hg38'],
  adapter: {
    type: 'PlinkLDTabixAdapter',
    uri: `https://jbrowse.org/demos/popgen/${file}`,
  },
  displays: [
    {
      type: 'LDTrackDisplay',
      legend: { show: true },
      height: 330,
      variantLayout: 'genomic',
    },
  ],
})

export const ldSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'ld/lct_pooled_vs_panel',
    url: sessionSpec(HG38_HUB, {
      sessionTracks: [
        lctPanelTrack(
          'kgp_lct_pooled',
          'All 1000 Genomes populations pooled (r²)',
          'lct_1kg38_chr2_pooled.ld.gz',
        ),
        lctPanelTrack(
          'kgp_lct_panel',
          'European panel only, where the sweep happened (r²)',
          'lct_1kg38_chr2_eur.ld.gz',
        ),
        LCT_FST_TRACK,
        DECODE_RECOMB_TRACK,
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: LCT_WIDE_LOC,
          highlight: LCT_HIGHLIGHT,
          tracks: [
            {
              trackId: 'hg38-ncbiRefSeqCurated',
              height: 60,
              filter: ['geneLike'],
            },
            // The axis starts at 0.1: almost all of the ~81,000 sites sit under
            // 0.05, and a 0 floor buries rs4988235 in a saturated bar. The
            // scores cover only chr2:133.8-137.2 Mb, so a wider window draws
            // blank lane; ld/lct_fst_scan is the wide view.
            {
              trackId: 'kgp_lct_fst',
              mark: 'point',
              encoding: {
                y: {
                  field: 'maxScore',
                  scale: { domainMin: 0.1, domainMax: 0.5 },
                },
                color: { value: '#0068d1' },
              },
              size: 2,
              extent: 'none',
              height: 140,
            },
            // The 2019 deCODE map, counted off crossovers. HapMap and hg38's
            // `recomb1000GAvg` are estimated from LD and would confirm the
            // triangle with itself. The 100 ceiling clips two hotspots on
            // purpose: autoscaled, the desert matches the quiet flanks. The
            // map matches the block's right edge only; the left one decays.
            // DECODE_RECOMB_TRACK exists for its name: the hub's label
            // "Recomb. deCODE Avg" reads as a setting.
            {
              trackId: 'decode_recomb',
              encoding: { y: { scale: { domainMin: 0, domainMax: 100 } } },
              height: 80,
            },
            // 200 cuts the panel block's apex and keeps both of its edges.
            { trackId: 'kgp_lct_pooled', height: 200 },
            { trackId: 'kgp_lct_panel', height: 200 },
          ],
        },
      ],
    }),
    readySelector: displayPainted('ld-display'),
    readyTimeout: 600000,
    viewportHeight: 1070,
    annotations: [
      {
        type: 'text',
        text: 'rs4988235',
        fontSize: 16,
        leader: true,
        anchor: {
          trackId: 'kgp_lct_fst',
          loc: 'chr2:135,851,076',
          fracY: 0.09,
        },
        dx: -90,
        dy: 30,
      },
    ],
  },

  // Fst over 40 Mb of chr2 from scripts/build_lct_fst_scan.sh. Keep it per
  // site: in 100 kb windows the block ranks 58th of 400.
  {
    mode: 'url',
    name: 'ld/lct_fst_scan',
    url: sessionSpec(HG38_HUB, {
      sessionTracks: [
        {
          type: 'QuantitativeTrack',
          trackId: 'kgp_lct_fst_scan',
          name: 'Fst, European panel vs the other 1000 Genomes samples, across 40 Mb of chr2',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/popgen/lct_1kg38_chr2_fst_eur_vs_rest_scan.bw',
              locationType: 'UriLocation',
            },
            // At ~27 kb/px the 40,960 bp zoom bin's max lifts the background
            // to within 0.14 of the peak.
            resolutionMultiplier: 0.001,
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr2:116,000,000-156,000,000',
          tracks: [
            {
              trackId: 'hg38-ncbiRefSeqCurated',
              displayMode: 'collapsed',
              height: 40,
              filter: ['geneLike'],
            },
            {
              trackId: 'kgp_lct_fst_scan',
              mark: 'point',
              encoding: {
                y: {
                  field: 'maxScore',
                  scale: { domainMin: 0.1, domainMax: 0.5 },
                },
                color: { value: '#0068d1' },
              },
              size: 2,
              extent: 'none',
              // Matches ld/lct_pooled_vs_panel's Fst axis, so the peak sits at
              // the same height in both.
              height: 230,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('wiggle-display'),
    readyTimeout: 120000,
    // Below about 450 the viewport cuts the axis under 0.2, and no clip report
    // notices.
    viewportHeight: 520,
    annotations: [
      {
        type: 'text',
        text: 'LCT',
        fontSize: 20,
        leader: true,
        anchor: {
          trackId: 'kgp_lct_fst_scan',
          loc: 'chr2:135,851,076',
          fracY: 0,
          dy: 25,
        },
        dx: 150,
      },
    ],
  },

  // fracX is the lower frame's 134.0-137.15 Mb inside the upper frame's data
  // area, which the app's margins inset from the image (L = 12.4, W = 2976.0 of
  // 3000 px).
  {
    mode: 'compose',
    name: 'ld/lct_sweep_two_scales',
    parts: ['ld/lct_fst_scan', 'ld/lct_pooled_vs_panel'],
    gutter: 70,
    annotations: [
      {
        type: 'trapezoid',
        fromAnchor: {
          selector: '[data-part="0"]',
          fracX: [0.45053, 0.52867],
        },
        anchor: { selector: '[data-part="1"]' },
      },
    ],
  },
  {
    mode: 'url',
    name: 'ld/anopheles_2la',
    url: sessionSpec(ANOGAM3_HUB, {
      sessionTracks: [
        AG_LOCI_TRACK,
        // 340 and unsquashed: 2La's apex is 327 px down; see agLdTrack.
        agLdTrack('CMgam', 'Cameroon, both arrangements segregating (r²)', 340),
        // The legend sets this floor: only this lane has all three karyotype
        // classes, and at 140 it cut 2La/2La off.
        agKaryotypeTrack('CMgam', 'Cameroon, one row per mosquito', 200, true),
        // Both panels share one px-per-bp scale, so the shorter Gabon lane
        // loses only white. The Cameroon panel cannot shrink: its deep half
        // holds the block's apex.
        agLdTrack(
          'GAgam',
          'Gabon, one arrangement in almost every mosquito (r²)',
          250,
        ),
        // Gabon's five heterozygotes are the lane's last 5 of 69 rows; 170
        // keeps their band at 12 px, and 11 px was too faint to find.
        agKaryotypeTrack('GAgam', 'Gabon, one row per mosquito', 170, false),
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'anoGam3',
          loc: 'chr2L',
          // No gene track: at ~38 kb/px it draws only a "Too many features"
          // banner.
          tracks: [
            {
              trackId: 'ag1000g_2l_loci',
              height: 40,
            },
            { trackId: 'ag1000g_2l_cmgam' },
            {
              trackId: 'ag1000g_2la_karyotype_cmgam',
            },
            { trackId: 'ag1000g_2l_gagam' },
            {
              trackId: 'ag1000g_2la_karyotype_gagam',
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('ld-display'),
    // The anoGam3 hub's chrom.sizes off hgdownload often times out and
    // refetches.
    readyTimeout: 180000,
    // Undersized, the lower rows crop silently. The Gabon heterozygotes against
    // the bottom border are the lane's last rows, not a crop.
    viewportHeight: 1395,
    annotations: [
      ...(
        [
          ['cmgam', 'Cameroon: 2La inversion common, LD spans it'],
          ['gagam', 'Gabon: 2La inversion rare, no LD block'],
        ] as const
      ).flatMap(([pop, text]) => [
        {
          type: 'box' as const,
          pad: 0,
          strokeWidth: 3,
          fromAnchor: { trackId: `ag1000g_2l_${pop}`, dy: -28 },
          anchor: { trackId: `ag1000g_2la_karyotype_${pop}` },
        },
        {
          type: 'text' as const,
          text,
          fontSize: 20,
          maxWidth: 600,
          anchor: {
            trackId: `ag1000g_2l_${pop}`,
            loc: 'chr2L:4,500,000',
            fracY: 0.55,
          },
        },
      ]),
    ],
  },
  // One row per haplotype under the r² triangle computed from them.
  //
  // Clustering makes the block: which allele is ALT flips site to site, so
  // adapter order draws plaid at any row count. Don't group by population;
  // grouping leaves each band in adapter order, and `rowColor` already shows
  // population.
  //
  // rs4988235 (MAF 0.30) falls below the 0.35 filter, so the ClinVar lane marks
  // it independently of the columns.
  //
  // scripts/build_lct_haploblock.sh takes 25 samples from each of six
  // populations; the full 5008 rows would be 0.18 px each.
  {
    mode: 'url',
    name: 'ld/lct_haploblock',
    url: sessionSpec(HG38_HUB, {
      sessionTracks: [
        pageTrack(LD_HUMAN_DOC, 'kgp_lct_ld'),
        pageTrack(LD_HUMAN_DOC, 'kgp_lct_haplotypes'),
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          // Wider than the block so the triangle above shows both edges.
          loc: 'chr2:134,400,000-136,900,000',
          highlight: LCT_HIGHLIGHT,
          tracks: [
            {
              trackId: 'hg38-ncbiRefSeqCurated',
              height: 60,
              filter: ['geneLike'],
            },
            {
              trackId: 'hg38-clinvarMain',
              height: 56,
              filter: [
                "jexl:get(feature,'phenotypeList')=='LACTASE PERSISTENCE'",
              ],
            },
            // The apex is 343 px down; 260 cuts it and keeps both edges, which
            // the matrix below has to line up with.
            { trackId: 'kgp_lct_ld', height: 260 },
            {
              trackId: 'kgp_lct_haplotypes',
              // 300 rows at 1.73 px; the swept cluster draws as a ~215 px slab.
              height: 520,
              lineZoneHeight: 34,
              runClustering: true,
              // Clustering over the whole window mixes in unlinked flanks.
              clusterRegion: 'chr2:135,787,850-135,876,467',
            },
          ],
        },
      ],
    }),
    // The dendrogram renders only after the clustering RPC lands.
    readySelector: '[data-testid="tree_sidebar_dendrogram"]',
    readyTimeout: 300000,
    // The app warns, correctly, that the VCF lacks most of the samples table's
    // rows, and the toast covers the matrix.
    hideSelectors: ['.MuiSnackbar-root'],
    viewportHeight: 1224,
    // Matrix columns aren't genomic, so both cluster pills share one x.
    annotations: [
      {
        type: 'text',
        text: 'LCT/MCM6',
        fontSize: 20,
        leader: true,
        anchor: {
          trackId: 'hg38-clinvarMain',
          loc: 'chr2:135,787,850',
          fracY: 0.5,
          alignX: 'left',
        },
        dx: -60,
      },
      {
        type: 'text',
        text: 'Swept haplotype: one uniform cluster',
        fontSize: 22,
        leader: true,
        anchor: {
          trackId: 'kgp_lct_haplotypes',
          loc: 'chr2:135,760,000',
          fracY: 0.27,
        },
        dx: -260,
      },
      {
        type: 'text',
        text: 'Every other haplotype: mosaic',
        fontSize: 22,
        leader: true,
        anchor: {
          trackId: 'kgp_lct_haplotypes',
          loc: 'chr2:135,760,000',
          fracY: 0.75,
        },
        dx: -260,
      },
    ],
  },
  // scripts/build_lct_population_af.sh prints the rs4988235 row the highlighted
  // bars should match.
  {
    mode: 'url',
    name: 'ld/lct_population_af',
    url: sessionSpec(HG38_HUB, {
      sessionTracks: [pageTrack(LD_HUMAN_DOC, 'kgp_lct_population_af')],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr2:135,844,000-135,858,000',
          highlight: [
            {
              refName: 'chr2',
              start: 135_851_075,
              end: 135_851_076,
              assemblyName: 'hg38',
            },
          ],
          tracks: [
            {
              trackId: 'hg38-ncbiRefSeqCurated',
              height: 60,
              filter: ['geneLike'],
            },
            {
              trackId: 'hg38-clinvarMain',
              height: 56,
              filter: [
                "jexl:get(feature,'phenotypeList')=='LACTASE PERSISTENCE'",
              ],
            },
            {
              trackId: 'kgp_lct_population_af',
            },
          ],
        },
      ],
    }),
    viewportHeight: 760,
    annotations: [
      {
        type: 'text',
        text: 'rs4988235',
        fontSize: 18,
        leader: true,
        anchor: {
          trackId: 'kgp_lct_population_af',
          loc: 'chr2:135,851,076',
          fracY: 0.04,
        },
        dx: 150,
        dy: -30,
      },
    ],
  },
]
