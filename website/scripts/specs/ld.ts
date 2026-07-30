import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The LD heatmap display's home-run result: the lactase-persistence sweep at
// LCT/MCM6, computed live from phased 1000 Genomes genotypes (exact haplotypic
// r², not the composite estimate), so no precomputed LD file is needed. hg19
// (the phase3 20130502 release coordinates).
//
// A companion MAPT 17q21.31 inversion figure was dropped in 969c44cc21: no
// accessible callset has usable per-sample genotypes for that inversion, so it
// could only have been shown with a proxy. The inversion case now has a figure
// (`ld/anopheles_2la`, below) that clears that bar with real per-sample phased
// genotypes, in a mosquito rather than a proxy human callset — the standing
// rule is unchanged, don't add an inversion figure without genotypes behind it.
//
// Data is a region slice of the phase3 1000 Genomes VCF (chr2:135.8–137.4 Mb)
// re-hosted on jbrowse.org S3 so the figure and its live "Open in JBrowse" link
// load fast and don't depend on the EBI FTP being up. The VCF names the contig
// "2"; the hosted UCSC hg19 hub's chromAlias reconciles "chr2" at query time.
//
// LD IS PER-POPULATION, SO THE SLICE IS TOO. The figure used to run on the
// pooled 2504-sample file and the block came out pink and fragmented, because
// pooling panels that carry different haplotypes at different frequencies
// averages the correlation away: over chr2:136.4–136.7 Mb the mean pairwise r²
// is 0.83 within the 503-sample European panel and 0.48 pooled, and the
// recombination curve's dip over the block only exists in the former. The
// panel was cut with `bcftools view -S` and uploaded beside the pooled file.
// Don't put two *human* population panels side by side to make this point — a
// figure comparing human groups is not what this page is for, and the point is
// about how r² is computed rather than about the groups. Stacked panels are
// fine where the populations aren't human: the Anopheles figure below is two
// mosquito panels, because there the presence and absence of the arrangement
// *is* the result.
const HG19_HUB = `?config=${encodeURIComponent('https://jbrowse.org/ucsc/hg19/config.json')}`

// LCT / MCM6 lactase-persistence locus. Recent positive selection swept a long
// haplotype to high frequency in dairying populations, so a large block of SNPs
// around LCT is inherited together — a long stretch of high r².
const lctTrack = (name: string) => ({
  type: 'VariantTrack',
  trackId: 'kgp_lct_ld',
  name,
  assemblyNames: ['hg19'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://jbrowse.org/demos/popgen/lct_1kg_chr2_eur.vcf.gz',
    fetchSizeLimit: 500_000_000,
  },
  displays: [
    {
      type: 'LDDisplay',
      showLDTriangle: true,
      showLegend: true,
      showRecombination: true,
      minorAlleleFrequencyFilter: 0.35,
      // 460 for the triangle (unchanged) + 50 for the recombination zone
      // showRecombination adds above it
      height: 510,
    },
  ],
})

// Wider than the block itself so the swept haplotype reads as a bounded block
// against lower-LD flanks — contrast is what makes it legible as a block rather
// than a wall of red. The block's own extent is measured, not guessed: within
// EUR at this MAF floor, r² against rs4988235 stays above 0.5 from 136.49 to
// 136.82 Mb and collapses to ~0.15 immediately past it.
const LCT_LOC = 'chr2:136,200,000-137,000,000'

// Band the LCT/MCM6 locus so the reader sees the high-r² block sits right over
// the lactase gene (the enhancer variant rs4988235 is in an MCM6 intron,
// upstream of LCT).
const LCT_HIGHLIGHT = [
  {
    refName: 'chr2',
    start: 136_545_410,
    end: 136_634_000,
    assemblyName: 'hg19',
  },
]

// The 2La inversion in Anopheles gambiae: ~22 Mb of chromosome arm 2L that does
// not recombine in a heterozygote, so wherever both arrangements segregate the
// whole segment travels as one unit. This is the case precomputed LD exists for
// — 22 Mb is far past what an LDDisplay can compute live from a VCF, so the r²
// comes from `plink --r2` read back through PlinkLDTabixAdapter.
//
// Built by scripts/build_ag1000g_ld.sh from Ag1000G phase 2 AR1 phased
// haplotypes. That script prints the evidence for each choice made here rather
// than asserting it; re-run it to re-derive any claim below.
//
// Phase 2 rather than the current release for two reasons, the second deciding
// it: Ag3's documented download URLs return 403 to anonymous callers, AND phase
// 1/2 terms of use were lifted in March 2022 (fully open access) while phase 3
// still reserves first global analyses to the Consortium. Open access still
// asks that the release be cited, which the tutorial does:
//   Anopheles gambiae 1000 Genomes Consortium. Genome variation and population
//   structure among 1142 mosquitoes of the African malaria vector species
//   Anopheles gambiae and Anopheles coluzzii. Genome Res 2020;30:1533-1548.
//
// WHY THESE TWO PANELS. An inversion can only show a block where both
// arrangements are present, so the panel is not interchangeable. The script's
// probe table ranks every panel by long-range LD inside the span against
// outside it: Cameroon is the strongest with the lowest background, and Gabon
// sits below 1x, meaning it is effectively fixed for one arrangement. That is
// what makes the lower panel a control rather than a second example: the same
// file, the same window, the same settings, and nothing inside the band.
//
// Note the Gabon panel is NOT empty overall, it just has nothing where the
// inversion is. It carries its own block at the low-coordinate end of the arm,
// near Vgsc, because both resistance alleles at codon 995 segregate in that
// population so there is something there to correlate. Don't caption it as a
// blank track.
//
// WHY r² AND NOT D'. D' is brighter inside the span but also tints the region
// outside it, while r² collapses to near zero there, so r² draws much the
// sharper boundary despite dimmer cells. Contrast against background, not cell
// brightness, is what makes a block legible.
//
// ASSEMBLY: the hosted UCSC anoGam3 hub. anoGam3 is AgamP3 and the LD is on
// AgamP4, which sounds wrong but is safe for the arms: 2L/2R/3L/3R are
// byte-identical between the two releases (verified by sequence comparison at
// both 2La breakpoints and at Vgsc; AgamP4's changes were to unplaced
// scaffolds). The hub names the arm chr2L and the .ld.gz names it 2L, which its
// chromAlias reconciles at query time, exactly as the hg19 case above does.
const ANOGAM3_HUB = `?config=${encodeURIComponent('https://jbrowse.org/ucsc/anoGam3/config.json')}`

const agLdTrack = (trackId: string, name: string, file: string) => ({
  type: 'LDTrack',
  trackId,
  name,
  assemblyNames: ['anoGam3'],
  adapter: {
    type: 'PlinkLDTabixAdapter',
    uri: `https://jbrowse.org/demos/popgen/${file}`,
  },
  displays: [
    {
      type: 'LDTrackDisplay',
      ldMetric: 'r2',
      // lay SNPs out at their real coordinates, not evenly spaced, so the
      // block's edges land where the inversion's edges are
      useGenomicPositions: true,
      showLegend: true,
      height: 300,
    },
  ],
})

// Published 2La extent (White et al. 2007, AgamP3 coordinates, which are the
// AgamP4 ones on this arm). It is banded rather than described so the reader can
// check the claim by eye: the block fills the band and the rest of the arm is
// white. The band is drawn by JBrowse from these coordinates, so unlike a
// painted-on callout it cannot drift from the data.
const TWO_LA_HIGHLIGHT = [
  { refName: 'chr2L', start: 20_524_058, end: 42_165_532, assemblyName: 'anoGam3' },
]

export const ldSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'ld/anopheles_2la',
    url: `${ANOGAM3_HUB}&session=${encodeSessionSpec({
      sessionTracks: [
        agLdTrack(
          'ag1000g_2l_cmgam',
          'Cameroon, both arrangements segregating (r²)',
          'ag1000g_2L_CMgam.ld.gz',
        ),
        agLdTrack(
          'ag1000g_2l_gagam',
          'Gabon, fixed for one arrangement (r²)',
          'ag1000g_2L_GAgam.ld.gz',
        ),
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'anoGam3',
          // the whole arm, so the block is bounded by white on both sides
          // rather than cropped to the answer
          loc: 'chr2L',
          highlight: TWO_LA_HIGHLIGHT,
          // No gene track. A whole arm is ~38 kb per pixel, so a gene is well
          // under one pixel and the track contributes nothing but a "Too many
          // features" banner across the top; showOnlyGenes changes which
          // features are admitted, not whether they can be resolved.
          tracks: [
            { trackId: 'ag1000g_2l_cmgam', type: 'LDTrackDisplay' },
            { trackId: 'ag1000g_2l_gagam', type: 'LDTrackDisplay' },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readyTimeout: 180000,
    // two LD tracks(300 each) + 2 headers + ruler/overview
    viewportHeight: 770,
    settleMs: 25000,
  },
  {
    mode: 'url',
    name: 'ld/lct_lactase',
    url: `${HG19_HUB}&session=${encodeSessionSpec({
      sessionTracks: [
        lctTrack('LCT lactase-persistence LD, 1000G European panel (r²)'),
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: LCT_LOC,
          highlight: LCT_HIGHLIGHT,
          tracks: [
            {
              trackId: 'hg19-ncbiRefSeqCurated',
              type: 'LinearBasicDisplay',
              height: 60,
              showOnlyGenes: true,
            },
            // The causal variant, from a source independent of the genotypes
            // the r² is computed from: ClinVar's LACTASE PERSISTENCE records at
            // chr2:136,608,642–136,608,745 — rs4988235, the -13910 C>T enhancer
            // variant in an MCM6 intron that keeps LCT transcribed into
            // adulthood. ClinVar has ~79 records in this window, nearly all
            // unrelated VUS, so filter to the lactase phenotype: one labeled
            // variant anchoring the block rather than a wall of clinical noise.
            {
              trackId: 'hg19-clinvarMain',
              type: 'LinearBasicDisplay',
              height: 70,
              jexlFiltersSetting: [
                "jexl:get(feature,'phenotypeList')=='LACTASE PERSISTENCE'",
              ],
            },
            { trackId: 'kgp_lct_ld', type: 'LDDisplay' },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readyText: 'variants shown',
    readyTimeout: 180000,
    // gene(60) + clinvar(70) + ld(510, incl. the recombination zone) + 3
    // headers + ruler/overview, with room for the triangle to reach its base
    viewportHeight: 950,
    settleMs: 14000,
    annotations: [
      {
        type: 'text',
        // bottom-left, in the triangle's empty long-range corner: clear of the
        // banded LCT/MCM6 locus (highlight starts ~x=650) and, unlike the old
        // y=245, clear of the ClinVar track header it used to cover. Shifted
        // down 50px from the pre-recombination-track value to track the
        // triangle, which the recombination zone now pushes down by that much.
        x: 40,
        y: 750,
        maxWidth: 300,
        fontSize: 16,
        text: 'One block, inherited together',
      },
    ],
  },
]
