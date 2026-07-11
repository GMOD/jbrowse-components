import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The population_genomics tutorial's figure: the windowed Fst + nucleotide
// diversity (pi) scans from the DGRP2 Drosophila panel, loaded as the exact
// multi-wiggle track the tutorial documents. Data is the real pipeline output
// hosted at jbrowse.org/demos/popgen (Fst of In(2L)t-inverted vs
// standard-arrangement lines, and whole-panel pi, both 10 kb windows).
//
// Loaded against the hosted UCSC dm6 hub config (jbrowse.org/ucsc/dm6) so the
// figure carries a real gene track for context and gene-name search — the setup
// the tutorial tells the reader to build. That assembly names arms chr2L etc.;
// the bigWigs name them 2L etc. (from the VCF header), and the hub assembly's
// RefNameAliasAdapter (chromAlias.txt) reconciles the two at display time, which
// is the aliasing the tutorial calls out.
const DM6_HUB = `?config=${encodeURIComponent('https://jbrowse.org/ucsc/dm6/config.json')}`

// Two independent quantitative tracks rather than one shared-scale
// MultiQuantitativeTrack: Fst tops out near 0.83 and pi near 0.016, a ~50x gap,
// so stacking them into one multi-wiggle (which shares a single y-domain across
// its rows) would crush pi to a flat line. Separate tracks each auto-scale to
// their own data, so both signals read.
const FST_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'fst_in2lt',
  name: 'Fst (In(2L)t vs standard)',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/demos/popgen/fst_In2Lt.bw',
  },
}
const PI_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'pi_all',
  name: 'π (whole panel)',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/demos/popgen/pi_all.bw',
  },
}

// The In(2L)t inversion extent as a single annotation feature (published dm6
// breakpoints 2L:2,225,744–13,154,180), so the reader can see the elevated-Fst
// plateau lines up with the inverted region. An inline FromConfigAdapter rather
// than a hosted BED — one feature needs no file.
const IN2LT_INVERSION_TRACK = {
  type: 'FeatureTrack',
  trackId: 'in2lt_inversion',
  name: 'In(2L)t inversion',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'FromConfigAdapter',
    adapterId: 'in2lt',
    features: [
      {
        uniqueId: 'in2lt',
        refName: 'chr2L',
        start: 2225744,
        end: 13154180,
        name: 'In(2L)t',
        type: 'inversion',
      },
    ],
  },
}

// Genome-wide Tajima's D (10 kb windows, whole panel) from the same pipeline.
// Pairs with π: a hard sweep drives BOTH down — π (fewer segregating sites) and
// Tajima's D (an excess of rare alleles as new mutations accumulate on the swept
// background), so the Cyp6g1 window shows a joint dip.
const TAJD_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'tajd_all',
  name: "Tajima's D (whole panel)",
  assemblyNames: ['dm6'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/demos/popgen/tajimad_all.bw',
  },
}

// The 180 In(2L)t-karyotyped lines (161 standard + 19 inverted) at the
// arrangement-informative SNPs — the ~16k sites whose allele frequency differs
// sharply between the two karyotypes (|Δfreq| > 0.7), i.e. the markers that tag
// the inversion. A samples TSV assigns each line its karyotype so the matrix can
// color by arrangement. Using the informative markers (rather than all genotypes)
// makes the two arrangements read as clean opposing blocks; the full genotype set
// is hosted alongside as dgrp_In2Lt_2L.vcf.gz.
// A single In(2L)t inversion call (<INV>, 2L:2,225,744-13,154,180) genotyped
// across all 180 karyotyped DGRP lines — GTs derived from the karyotype calls
// (1/1 for the 19 In(2L)t lines, 0/0 for the 161 standard). Displayed as a
// multi-sample matrix, one feature spanning the whole inversion resolves the
// ~13 Mb arrangement that the per-SNP matrix couldn't (its columns vanish at
// arm scale): the feature literally starts and ends at the breakpoints, so the
// boundaries are on-screen, with each row a line colored by its genotype.
const KARYOTYPE_VCF_TRACK = {
  type: 'VariantTrack',
  trackId: 'dgrp_In2Lt_matrix',
  name: 'In(2L)t inversion genotyped across DGRP lines',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'VcfTabixAdapter',
    vcfGzLocation: {
      uri: 'https://jbrowse.org/demos/popgen/dgrp_In2Lt_sv.vcf.gz',
    },
    index: {
      location: {
        uri: 'https://jbrowse.org/demos/popgen/dgrp_In2Lt_sv.vcf.gz.tbi',
      },
    },
    samplesTsvLocation: {
      uri: 'https://jbrowse.org/demos/popgen/dgrp_In2Lt_samples.tsv',
    },
  },
  displays: [
    {
      type: 'LinearMultiSampleVariantMatrixDisplay',
      displayId: 'dgrp_In2Lt_matrix-matrix',
      // color the left sidebar strip by the karyotype metadata column
      colorBy: 'karyotype',
    },
  ],
}

// Between-population Fst (African vs cosmopolitan) across the Cyp6g1 region,
// computed from DEST Pool-Seq allele frequencies (dm6). The African group pools
// the sub-Saharan samples (ancestral range); the cosmopolitan group is the North
// American (US) samples (derived range where the insecticide-resistance allele
// swept). Windowed Hudson Fst, hosted as a bigWig — a single QuantitativeTrack so
// it auto-scales to its own domain and the Cyp6g1 peak reads at full height.
const FST_DEST_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'dest_fst_afr_cosmo',
  name: 'Fst (African vs cosmopolitan)',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/demos/popgen/dest_cyp6g1_fst.bw',
  },
}

// The two populations' nucleotide diversity (expected heterozygosity) as a
// two-row multi-wiggle sharing one y-domain, so the sweep reads as a split: the
// cosmopolitan row collapses in the Cyp6g1 window while the African row holds at
// background. Same statistic on both rows, so a shared scale is correct here
// (unlike Fst-vs-π, which differ ~50x).
const DIVERSITY_DEST_TRACK = {
  type: 'MultiQuantitativeTrack',
  trackId: 'dest_diversity_afr_cosmo',
  name: 'Nucleotide diversity (African vs cosmopolitan)',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'MultiWiggleAdapter',
    subadapters: [
      {
        type: 'BigWigAdapter',
        source: 'African (ancestral)',
        color: '#377eb8',
        bigWigLocation: {
          uri: 'https://jbrowse.org/demos/popgen/dest_cyp6g1_div_african.bw',
          locationType: 'UriLocation',
        },
      },
      {
        type: 'BigWigAdapter',
        source: 'Cosmopolitan (derived)',
        color: '#e41a1c',
        bigWigLocation: {
          uri: 'https://jbrowse.org/demos/popgen/dest_cyp6g1_div_cosmopolitan.bw',
          locationType: 'UriLocation',
        },
      },
    ],
  },
}

export const popgenSpecs: ScreenshotSpec[] = [
  // Genome-wide (all six dm6 arms): the In(2L)t Fst track rises into a tall
  // elevated block across the whole left arm of chromosome 2 — the
  // recombination-suppression footprint of the inversion — while every other arm
  // (2R, 3L, 3R, 4, X) sits at low background Fst. Plotting the whole genome (not
  // just 2L in isolation) is what makes the elevation read AS elevated: the
  // reader sees the 2L signal is genuinely anomalous, not a baseline the eye has
  // nothing to compare against (reviewer). The In(2L)t inversion-extent track
  // marks the 2L segment; whole-panel π below stays near-uniform across arms, the
  // expected contrast to the localized Fst spike.
  {
    mode: 'url',
    name: 'popgen/fst_in2lt_2L',
    url: `${DM6_HUB}&session=${encodeSessionSpec({
      sessionTracks: [IN2LT_INVERSION_TRACK, FST_TRACK, PI_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          // all six major arms in order, so 2L's elevated Fst reads against the
          // rest of the genome as background
          displayedRegionNames: [
            'chr2L',
            'chr2R',
            'chr3L',
            'chr3R',
            'chr4',
            'chrX',
          ],
          tracks: [
            // inversion extent on top so the Fst block below reads against it
            {
              trackId: 'in2lt_inversion',
              type: 'LinearBasicDisplay',
              height: 40,
            },
            {
              trackId: 'fst_in2lt',
              type: 'LinearWiggleDisplay',
              height: 200,
            },
            {
              trackId: 'pi_all',
              type: 'LinearWiggleDisplay',
              height: 150,
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readySelector: '[data-testid="wiggle-display-done"]',
    readyText: 'π (whole panel)',
    readyTimeout: 90000,
    // inversion(40) + fst(200) + pi(150) + headers clear the crop
    viewportHeight: 620,
    settleMs: 14000,
  },

  // Zoomed out to a ~3 Mb window on 2R centered on Cyp6g1 (12,185,667–12,188,431)
  // so the diversity valley reads as a sharp, localized dip against the arm-wide
  // background rather than filling the frame. Whole-panel pi collapses across
  // ~12.13–12.20 Mb (the gene's window drops to ~0.0004, under 10% of the 2R
  // average ~0.0049) between high-diversity flanks — the classic hard-sweep
  // signature of the DDT/neonicotinoid-resistance haplotype fixing in this
  // derived population. A genomic highlight band marks Cyp6g1, which is a sliver
  // at this zoom; the gene track underneath is a showOnlyGenes context strip.
  {
    mode: 'url',
    name: 'popgen/pi_cyp6g1',
    url: `${DM6_HUB}&session=${encodeSessionSpec({
      sessionTracks: [PI_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          loc: 'chr2R:10,700,000-13,700,000',
          // stable band over the Cyp6g1 gene body so it stays identifiable even
          // though the gene is only a few pixels wide at this scale (replaces a
          // text-anchored box that landed in blank space once labels stopped
          // rendering at the wider zoom)
          highlight: [
            {
              refName: 'chr2R',
              start: 12_185_000,
              end: 12_189_000,
              assemblyName: 'dm6',
              label: 'Cyp6g1',
            },
          ],
          tracks: [
            {
              trackId: 'pi_all',
              type: 'LinearWiggleDisplay',
              height: 240,
            },
            {
              trackId: 'dm6-ncbiRefSeqCurated',
              type: 'LinearBasicDisplay',
              height: 110,
              showOnlyGenes: true,
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readySelector: '[data-testid="wiggle-display-done"]',
    // the wiggle track name always renders; the old gene-label wait no longer
    // works at this zoom (labels collapse)
    readyText: 'whole panel',
    readyTimeout: 90000,
    viewportHeight: 560,
    settleMs: 12000,
    annotations: [
      {
        type: 'text',
        // sits in the upper-right white space of the wiggle plot, clear of the
        // header/location bar it used to overlap (reviewer: move down + right)
        x: 900,
        y: 205,
        maxWidth: 360,
        fontSize: 15,
        text: 'π collapses to under a tenth of the arm-wide background here — the hard-sweep signature at the Cyp6g1 insecticide-resistance gene',
      },
    ],
  },

  // The In(2L)t arrangement as one SV call genotyped across the panel: the whole
  // ~11 Mb inversion (2L:2.23-13.15 Mb) shown with flanking reference on both
  // sides, so the <INV> feature's start and end sit at the breakpoints on-screen.
  // Each of the 180 rows is a DGRP line colored by its genotype at the inversion;
  // the karyotype sidebar strip and the VCF row order both put the 19 In(2L)t
  // carriers in one block above the 161 standard lines. This resolves the
  // arrangement the per-SNP matrix couldn't (its columns collapse at arm scale).
  {
    mode: 'url',
    name: 'popgen/genotype_matrix_in2lt',
    url: `${DM6_HUB}&session=${encodeSessionSpec({
      sessionTracks: [KARYOTYPE_VCF_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          // ruler set to the inversion extent (breakpoints ~2.23 + ~13.15 Mb) so
          // the full-width matrix band reads as spanning the whole arrangement —
          // the matrix indexes columns by variant, not bp, so flanks add nothing
          loc: 'chr2L:2,000,000-13,400,000',
          tracks: [
            {
              trackId: 'dgrp_In2Lt_matrix',
              type: 'LinearMultiSampleVariantMatrixDisplay',
              height: 520,
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readyText: 'chr2L',
    readyTimeout: 90000,
    viewportHeight: 620,
    settleMs: 8000,
    annotations: [
      {
        type: 'text',
        // over the uniform grey standard-line block, clear of the teal carrier
        // rows at top and the genotype legend at right
        x: 300,
        y: 400,
        maxWidth: 340,
        fontSize: 15,
        text: 'One In(2L)t inversion call genotyped across 180 lines. Each row = one strain; the 19 carriers (orange strip) share the inverted allele, and the call spans the full ~11 Mb between its breakpoints.',
      },
    ],
  },

  // Tajima's D + π at Cyp6g1 (chr2R:12,185,667): the two-part hard-sweep signature
  // read against the gene. Both statistics dip together in the swept window — π
  // collapses (diversity removed by the hitchhiking haplotype) and Tajima's D goes
  // sharply negative (to about -2, an excess of rare alleles on the swept
  // background) — against a genome-wide-neutral Tajima's D baseline near zero.
  // Seeing both drop at the same window is what distinguishes a sweep from a plain
  // low-diversity region.
  {
    mode: 'url',
    name: 'popgen/tajimad_cyp6g1',
    url: `${DM6_HUB}&session=${encodeSessionSpec({
      sessionTracks: [TAJD_TRACK, PI_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          // widened from 550 kb to ~1 Mb so the joint Tajima's D + π dip at
          // Cyp6g1 reads as a sharp, localized trough against more arm-background
          // on both sides (whole-panel bigWigs cover the whole arm, so zooming
          // out just adds context, no empty flanks)
          loc: 'chr2R:11,700,000-12,700,000',
          highlight: [
            {
              refName: 'chr2R',
              start: 12_185_000,
              end: 12_189_000,
              assemblyName: 'dm6',
              label: 'Cyp6g1',
            },
          ],
          tracks: [
            {
              trackId: 'tajd_all',
              type: 'LinearWiggleDisplay',
              height: 200,
            },
            {
              trackId: 'pi_all',
              type: 'LinearWiggleDisplay',
              height: 180,
            },
            {
              trackId: 'dm6-ncbiRefSeqCurated',
              type: 'LinearBasicDisplay',
              // grow so the gene track sizes to its full feature stack (reviewer:
              // taller gene track) instead of a fixed thin strip
              heightMode: 'grow',
              height: 110,
              showOnlyGenes: true,
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readySelector: '[data-testid="wiggle-display-done"]',
    readyText: 'Tajima',
    readyTimeout: 90000,
    // tajd(200) + pi(180) + grow gene track + 3 headers + ruler/overview
    viewportHeight: 960,
    settleMs: 12000,
  },

  // The payoff combined figure: at the Cyp6g1 insecticide-resistance sweep, three
  // inter-related population-genetic signals converge in one window between an
  // ancestral African and a derived cosmopolitan population (DEST Pool-Seq, dm6).
  // Fst (top) spikes to its regional maximum — the resistance haplotype swept in
  // the cosmopolitan population but not in Africa, so the two diverge sharply here.
  // Below, the two diversity rows split: cosmopolitan diversity (red) collapses in
  // the same window (the hitchhiking hard sweep), while African diversity (blue)
  // stays at background (no sweep there). A peak of differentiation sitting exactly
  // on top of a population-specific diversity valley is the textbook signature of
  // local adaptation — and it lands on the gene the tutorial already features.
  {
    mode: 'url',
    name: 'popgen/combined_cyp6g1_dest',
    url: `${DM6_HUB}&session=${encodeSessionSpec({
      sessionTracks: [FST_DEST_TRACK, DIVERSITY_DEST_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          // full extent of the DEST slice (tabix'd 2R:11.7-12.7 Mb) so the Fst
          // peak + cosmopolitan diversity valley read against the widest
          // background the data covers (reviewer: zoom out more)
          loc: 'chr2R:11,700,000-12,700,000',
          highlight: [
            {
              refName: 'chr2R',
              start: 12_130_000,
              end: 12_190_000,
              assemblyName: 'dm6',
              label: 'Cyp6g1',
            },
          ],
          tracks: [
            {
              trackId: 'dest_fst_afr_cosmo',
              type: 'LinearWiggleDisplay',
              height: 180,
            },
            {
              trackId: 'dest_diversity_afr_cosmo',
              type: 'MultiLinearWiggleDisplay',
              height: 200,
              defaultRendering: 'multiline',
            },
            {
              trackId: 'dm6-ncbiRefSeqCurated',
              type: 'LinearBasicDisplay',
              height: 90,
              showOnlyGenes: true,
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readySelector: '[data-testid="wiggle-display-done"]',
    readyText: 'cosmopolitan',
    readyTimeout: 90000,
    // fst(180) + diversity(200) + gene(90) + 3 headers + ruler/overview
    viewportHeight: 720,
    settleMs: 12000,
    annotations: [
      {
        type: 'text',
        x: 300,
        y: 150,
        maxWidth: 300,
        fontSize: 15,
        text: 'Fst peaks at Cyp6g1 while cosmopolitan diversity (red) collapses and African (blue) holds — a population-specific sweep.',
      },
    ],
  },
]
