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
// Data is a region slice of the phase3 1000 Genomes VCF re-hosted on jbrowse.org
// S3 so the figure and its live "Open in JBrowse" link load fast and don't depend
// on the EBI FTP being up. The VCF names the contig "2"; the hosted UCSC hg19
// hub's chromAlias reconciles "chr2" at query time.
//
// BOTH LCT FIGURES READ THE 3.3 Mb SLICES (chr2:134.6-137.9 Mb, built by
// scripts/build_lct_ld.sh: `_eur_wide` 4.5 MB, `_pooled_wide` 16.6 MB). The
// original 1.65 Mb pair began at 135.75 Mb, which is also where the swept block
// begins, so a figure on them was cut at the edge it was claiming and nothing in
// it distinguished "the LD ends here" from "the file ends here" (review: "the
// recombination triangle covers whole screen. what is user supposed to take
// away?"). The pooled-vs-panel figure was left narrow for one round, on the
// grounds that its point is which SAMPLES went in; that made the page teach "cut
// the window wider than the block" above a figure that doesn't, so it moved too.
// The pooled lane's live link now fetches 16.6 MB, which is the cost of the
// wider window on 2504 samples.
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
    uri: 'https://jbrowse.org/demos/popgen/lct_1kg_chr2_eur_wide.vcf.gz',
    fetchSizeLimit: 500_000_000,
  },
  displays: [
    {
      type: 'LDDisplay',
      showLDTriangle: true,
      showLegend: true,
      showRecombination: true,
      minorAlleleFrequencyFilter: 0.35,
      // Cells sized by genomic distance, so the triangle shares the x axis of
      // the gene lane and the ruler above it (review: "consider also using
      // useGenomicPositions:true"). Off, x is SNP INDEX, and index density is
      // not uniform across this window — the block occupied about two thirds of
      // the frame while spanning about a quarter of the bp, which is why it
      // read as running off the left edge no matter how far the window zoomed
      // out. On, its edges land under the coordinates they are at.
      useGenomicPositions: true,
      // 460 for the triangle (unchanged) + 50 for the recombination zone
      // showRecombination adds above it
      height: 510,
    },
  ],
})

// Wider than the block, so it reads as a block rather than a wall of red.
// 800 kb -> 2.2 Mb -> 3.1 Mb, and the last step needed a wider FILE (see above).
// Against rs4988235, scripts/build_lct_ld.sh measures r² of 0.72 at 135.8 Mb and
// 0.06 by 135.0 Mb on the left, 0.37 at 136.8 Mb and 0.02 by 137.4 Mb on the
// right, so this carries the block plus about a megabase either side of it.
const LCT_LOC = 'chr2:134,700,000-137,800,000'

// Both LCT figures take the same window. This one is the expensive render of the
// two: r² is computed live, and the pooled lane correlates 5008 haplotypes
// against the panel's 1006. It still lands in about 100 s, so the readyTimeout
// below is headroom rather than a measured need. Two intermediate windows (1.4
// and 2.1 Mb) were rendered while narrowing this down after the full window
// appeared to hang twice; that turned out to be CPU contention with another
// generator run on the same machine, not the window. If it hangs again, check for
// a second `generate-screenshots` process before shrinking anything.
const LCT_WIDE_LOC = LCT_LOC

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
// AgamP4 ones on this arm). Used to anchor the two callouts, one per population
// lane, so each sits over the span it is about. It was also drawn as a
// `highlight` band across both lanes; review asked for that off, and it was
// doing the callouts' job badly anyway — a tinted rectangle says "look here"
// and the reader still has to be told that the block filling it in one lane and
// not the other is the whole result.
const TWO_LA_LOCUS = 'chr2L:20,524,058-42,165,532'

// The per-population point, shown rather than asserted, WITHOUT making a figure
// out of human population differences. Both lanes are the same locus, window,
// MAF floor and settings; the only difference is which samples went in. Pooled
// above (every panel in the release), one panel below.
//
// This is deliberately a contrast between two ANALYSIS CHOICES, not between two
// groups: the takeaway a reader should leave with is "subset your VCF", which is
// a mistake they will actually make when they point an LDDisplay at a whole
// callset. Stacking two human population panels would teach the same statistics
// while making the subject of the picture a comparison between peoples, which is
// not what this page is for. The population-specific-sweep lesson is carried by
// the Anopheles figure, where the populations are mosquitoes and presence or
// absence of the arrangement is itself the result.
//
// A second panel lane was measured rather than argued about, and the measurement
// does NOT say it would look bad: over the block, mean pairwise r² is 0.826 in
// this panel, 0.508 pooled, and 0.175 in the release's largest other panel, but
// that third number is long-range pairs. Locally (pairs within 100 kb) that panel
// runs 0.06-0.54 against this one's 0.20-0.90, with a short-range peak of its
// own, so the lane would read as fine-grained speckle against one long block
// rather than as a blank. The reason not to draw it is the editorial one above,
// not legibility.
const lctPanelTrack = (trackId: string, name: string, file: string) => ({
  type: 'VariantTrack',
  trackId,
  name,
  assemblyNames: ['hg19'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: `https://jbrowse.org/demos/popgen/${file}`,
    fetchSizeLimit: 500_000_000,
  },
  displays: [
    {
      type: 'LDDisplay',
      showLDTriangle: true,
      showLegend: true,
      // the recombination curve is half the evidence: its dip over the block
      // exists in the panel lane and not in the pooled one
      showRecombination: true,
      minorAlleleFrequencyFilter: 0.35,
      height: 330,
      // Cells sized by genomic distance (review: "potentially use 'proportional
      // sizing' for the ld blocks with useGenomicPositions:true"). This also
      // retires the connector zone the previous round was tuning: the fan of
      // lines existed to say which column each SNP was, which is only a question
      // when x is SNP index. On genomic positions the SNP IS its column, the fan
      // is gone, and the space above the triangle is the recombination curve's
      // (`effectiveLineZoneHeight` switches to `recombinationZoneHeight` here).
      useGenomicPositions: true,
    },
  ],
})

export const ldSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'ld/lct_pooled_vs_panel',
    url: `${HG19_HUB}&session=${encodeSessionSpec({
      sessionTracks: [
        lctPanelTrack(
          'kgp_lct_pooled',
          'All panels pooled (r²)',
          'lct_1kg_chr2_pooled_wide.vcf.gz',
        ),
        lctPanelTrack(
          'kgp_lct_panel',
          'One population panel (r²)',
          'lct_1kg_chr2_eur_wide.vcf.gz',
        ),
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: LCT_WIDE_LOC,
          highlight: LCT_HIGHLIGHT,
          tracks: [
            // The genes, so the band has something to be over (review: "we need
            // to add the gene track ... we need to see why this is important").
            // showOnlyGenes because 2 Mb of hg19 RefSeq is otherwise a wall of
            // transcripts and the point is which gene the block sits on.
            {
              trackId: 'hg19-ncbiRefSeqCurated',
              type: 'LinearBasicDisplay',
              height: 60,
              showOnlyGenes: true,
            },
            { trackId: 'kgp_lct_pooled', type: 'LDDisplay' },
            { trackId: 'kgp_lct_panel', type: 'LDDisplay' },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    // same real signal as the Anopheles figure: both LD panels finished, not a
    // duration guess
    readySelector:
      'body:has([data-testid="ld-display-done"][data-display-phase="ready"]):not(:has([data-testid="ld-display"])):not(:has([data-display-phase="loading"]))',
    // 21 MB of genotypes across the two lanes, the pooled one on 2504 samples
    readyTimeout: 600000,
    // the gene lane, then two LD tracks (330 triangle + 50 recombination zone
    // each) + 2 headers + ruler/overview
    viewportHeight: 995,
    settleMs: 8000,
  },
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
    // Wait on the model's own state, not a duration. DisplayChrome publishes
    // `data-display-phase` for exactly this; note the sibling `-done` testid is
    // canvasDrawn (FIRST PAINT), which flips on an empty canvas while the fetch
    // is still in flight, so it would happily screenshot a blank triangle.
    // Both LD panels must reach `ready`.
    // An LD panel is `ld-display` until first paint and `ld-display-done`
    // after, so "no bare ld-display left" means both panels painted, and "no
    // phase=loading left" means both finished fetching.
    readySelector:
      'body:has([data-testid="ld-display-done"][data-display-phase="ready"]):not(:has([data-testid="ld-display"])):not(:has([data-display-phase="loading"]))',
    readyTimeout: 180000,
    // two LD tracks(300 each) + 2 headers + ruler/overview
    viewportHeight: 770,
    settleMs: 8000,
    // One callout per lane, saying what each lane shows rather than only naming
    // the span (review: "a red text annotation on both cameroon and gabon
    // tracks that says why this is interesting"). Both anchor to the same
    // published locus in their own track, so they sit over the span they
    // describe and move with the layout. chr2L, not 2L: the anchor locus is
    // resolved against the assembly's canonical names (the .ld.gz's own 2L is
    // the adapter's business), so a bare name here resolves to nothing and
    // fails the spec outright.
    annotations: [
      {
        type: 'text',
        anchor: {
          track: 'ag1000g_2l_cmgam',
          locus: TWO_LA_LOCUS,
          fracY: 0,
          dy: 20,
        },
        text: '2La inversion, both arrangements present:\nthe whole span is one block',
        fontSize: 18,
        maxWidth: 430,
      },
      {
        type: 'text',
        anchor: {
          track: 'ag1000g_2l_gagam',
          locus: TWO_LA_LOCUS,
          fracY: 0,
          dy: 20,
        },
        text: 'Same span, one arrangement fixed:\nnothing to link',
        fontSize: 18,
        maxWidth: 430,
      },
    ],
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
    // 3.1 Mb of genotypes rather than 1.65, so the fetch and the r² are both
    // larger; the probe render of this window took well under this.
    readyTimeout: 300000,
    // gene(60) + clinvar(70) + ld(510, incl. the recombination zone) + 3
    // headers + ruler/overview, with room for the triangle to reach its base
    viewportHeight: 950,
    settleMs: 14000,
    // No callout. It carried "One block, inherited together" at a hand-measured
    // x/y, asserting what the old slice could not show. The block now has two
    // visible edges, the highlight names the gene and the ClinVar tick names the
    // causal variant.
  },
]
