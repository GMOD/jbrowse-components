import { displayPainted, encodeSessionSpec } from '@jbrowse/browser-test-utils'

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
const lctTrack = (name: string, height = 510) => ({
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
      minorAlleleFrequencyFilter: 0.35,
      // Cells sized by genomic distance, so the triangle shares the x axis of
      // the gene lane and the ruler above it (review: "consider also using
      // useGenomicPositions:true"). Off, x is SNP INDEX, and index density is
      // not uniform across this window — the block occupied about two thirds of
      // the frame while spanning about a quarter of the bp, which is why it
      // read as running off the left edge no matter how far the window zoomed
      // out. On, its edges land under the coordinates they are at.
      useGenomicPositions: true,
      // The triangle is the whole figure here. The haploblock figure stacks it
      // over an 800px matrix and passes less.
      height,
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

// The deCODE sex-averaged genetic map, as published by UCSC. See the note on
// this track's entry in the LCT figure's track list for why it is deCODE and
// not one of the HapMap maps beside it in the same hub.
const DECODE_RECOMB_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'decode_recomb',
  name: 'deCODE recombination rate (cM/Mb)',
  assemblyNames: ['hg19'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://hgdownload.soe.ucsc.edu/gbdb/hg19/decode/SexAveraged.bw',
  },
}

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
// THAT BLOCK IS THE FIGURE'S SECOND SHAPE AND THE PAGE NOW READS IT. Both
// panels have it, and it is a decaying triangle where 2La is a solid one, which
// is the difference the prose calls the diagnostic. Measured off the capture,
// mean cell intensity against depth: the low-coordinate block runs 42 / 19 / 9 /
// 3.5 over the first four samples and is at background thereafter, while 2La
// runs 15 / 18 / 41 / 37 and is still at 25 near the bottom of its triangle. So
// don't reframe or crop this figure to the inversion: the second block is the
// negative control for the block-shape claim, in the same frame.
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
      // 340, NOT 300, AND THAT IS A CORRECTION rather than a preference. An
      // unsquashed LD panel draws its triangle at natural aspect -- apex depth
      // is half the drawn width (`canvasHeight` = `canvasWidth / 2` in
      // LDDisplay/shared.ts) -- and the lane's own height then clips whatever
      // does not fit. Clipping the whole-arm triangle is right and unavoidable:
      // at 49.4 Mb across ~1490 css px it would be 745 px deep, and the deep
      // half is pairs 20 Mb apart. But 2La is 20,524,058-42,165,532, which
      // draws 653 px wide, so ITS apex is 327 px down -- and at 300 the block
      // this figure exists to show was cut flat at the lane boundary, ~27 px
      // short of closing. A truncated block reads as one that continues past
      // the frame, which is the opposite of "this span is inherited as one
      // piece". `squashToHeight` is not the fix and was reasoned out rather
      // than tried: it fits the NATURAL triangle (745 px) into the lane, so at
      // 300 it would scale 2La's apex to 131 px and spend the other 169 px on
      // the empty long-range corner.
      //
      // Both panels take the same number. They are read against each other --
      // block versus no block -- and two lanes of different heights make a
      // reader wonder whether the empty one was drawn differently.
      height: 340,
    },
  ],
})

// The arrangement itself, one <INV> call per mosquito, as the per-sample
// counterpart to the two LD panels. The LD figure shows a CONSEQUENCE of the
// inversion (heterozygotes cannot recombine across it, so the span travels as
// one block); this shows the structural variant those panels are about, and who
// carries it.
//
// WHAT IS INFERRED AND WHAT IS NOT. 2La is not a call this pipeline makes. It is
// a cytologically defined arrangement whose breakpoints were cloned and
// sequenced (Sharakhov et al. 2006, PNAS 103:6258-6262) and which has a
// diagnostic PCR across the junctions, validated against polytene cytology on
// 765 field specimens (White et al. 2007, Am J Trop Med Hyg 76:334-339). Only
// each sample's karyotype is inferred, by scoring the published tag SNPs of Love
// et al. 2019 (G3 9:3249-3262) - the in-silico method MalariaGEN ships for Ag3,
// which that paper reports disagreeing with cytology on 5 of 345 Ag1000G
// specimens. build_ag1000g_ld.sh prints the score histogram; the calls are only
// worth drawing because it comes out trimodal with empty space between the
// peaks, which is a property of the data rather than of the threshold.
//
// The per-population table the same script prints is the independent check on
// the LD figure above: Cameroon segregates both arrangements and Gabon is
// near-fixed for the standard one, which is what makes one panel a block and the
// other a control. Neither number is restated in the prose - the script prints
// them, and this figure shows them.
const AG_POPGEN = 'https://jbrowse.org/demos/popgen'

// What the two blocks in the heatmaps are over, as two features in one lane, so
// each block has a labelled extent above it drawn from published coordinates
// rather than from the LD. The same FromConfigAdapter shape the In(2L)t figure
// uses in popgen.ts: two features need no file.
//
// This is NOT the highlight band review asked to remove. That was a tint across
// both LD lanes saying "look here" while leaving the reader to work out that the
// span filling in one panel and not the other was the result; this is a named
// annotation on its own row, and it is here because the page now reads BOTH
// blocks and only one of them had anything to check its position against.
//
// 2La: White et al. 2007, the published extent the karyotype calls are drawn at.
// Vgsc: AGAP004707, 2L:2,358,158-2,431,617 on AgamP4 (Ensembl Metazoa). The
// low-coordinate block is centred on it, and unlike 2La it is a decaying
// triangle, which is the distinction the tutorial's prose turns on.
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

// One track per population, not one track holding both. The display draws one
// row per sample in the VCF and has no sample filter, so the file is the row set
// — and at a 1px row the sidebar cannot render a text label, which leaves the
// track header as the only place a population name can go. It also lets each
// karyotype lane sit directly under its own LD panel in the combined figure.
const agKaryotypeTrack = (pop: string, name: string, height: number) => ({
  type: 'VariantTrack',
  trackId: `ag1000g_2la_karyotype_${pop.toLowerCase()}`,
  name,
  assemblyNames: ['anoGam3'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: `${AG_POPGEN}/ag1000g_2La_${pop}.vcf.gz`,
    samplesTsvLocation: { uri: `${AG_POPGEN}/ag1000g_2La_${pop}_samples.tsv` },
  },
  displays: [
    {
      // The regular multi-sample display, NOT the matrix. Matrix mode spaces one
      // evenly sized column per variant, which discards the only spatial thing a
      // single SV call has: its extent. Here each genotype draws at the call's
      // true span, so the cells begin and end at the breakpoints.
      type: 'LinearMultiSampleVariantDisplay',
      // Within one population the karyotype is the only useful key, and it sorts
      // standard, het, inverted on its own, so the three classes come out as
      // contiguous blocks in dosage order.
      groupBy: 'karyotype',
      colorBy: 'karyotype',
      // 'skip', the default: the display fills the whole lane with
      // REFERENCE_COLOR in CSS and paints only ALT cells on top, so the lane is
      // a solid grey field with the carriers' blocks on it (review: "it should
      // use 'drawreferencealleles' as solid grey background"). 'draw' instead
      // paints a grey cell per row at the call's span, and at these row heights
      // the per-row gaps broke that field into a striped rectangle that read as
      // a texture rather than as background.
      referenceDrawingMode: 'skip',
      // No featureColor. The default alt shade is keyed to allele dosage
      // (`getAltColorForDosage`), so a heterozygote paints lighter than a
      // homozygote and the three classes read apart; an override flattens het and
      // hom-alt to one flat color, which is what the first cut of this figure did
      // and it threw the distinction away.
      //
      // No rowHeight here. It is a display *model* prop, not a config slot, so a
      // track config carries it nowhere — the previous 891/207 lanes read as
      // "297 x 3px" only because `height / nrow` happens to land on the same
      // number. The lane height IS the row height: rows auto-fit
      // `availableHeight / nrow`, so this is the one knob, and at 297px the
      // Cameroon panel's 297 mosquitoes get a pixel each. The class boundaries
      // survive that because rows are grouped — a 1px row is not readable on its
      // own, but a contiguous run of one karyotype is a band tens of px deep.
      height,
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
// Weir and Cockerham Fst per variant, the European panel against the other 2001
// samples of the same release, over the same window the LD lanes draw. Computed
// by vcftools from the 1000 Genomes phase 3 chr2 callset (scripts/build_lct_ld.sh),
// so the estimator is a published one and the panels are the release's own.
//
// Per site, not windowed, and that is the finding: rs4988235 is the single most
// differentiated variant of the 93,876 in the frame, and the sites just below it
// are its neighbours inside the block. A 10 kb windowed version was built first
// and says much less -- the block's windows average barely above the flanks,
// because a window mixes the swept haplotype with every rare variant sharing it.
//
// The contrast is one panel against the pooled remainder rather than against a
// named second population: the figure's own subject is panel-versus-pooled, and
// naming a second population here would make a comparison the figure is not
// about.
const LCT_FST_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'kgp_lct_fst',
  name: 'Fst, this panel vs the other 1000 Genomes samples (Weir & Cockerham)',
  assemblyNames: ['hg19'],
  adapter: {
    type: 'BigWigAdapter',
    bigWigLocation: {
      uri: 'https://jbrowse.org/demos/popgen/lct_1kg_chr2_fst_eur_vs_rest.bw',
      locationType: 'UriLocation',
    },
    // raw per-site values out to well past this window's 3.1 kb/px: a bigWig
    // zoom bin carries min/avg/max, and the average of ninety variants is the
    // background, so the summarized lane draws the haze and drops the peak that
    // is the whole point. Same reason the C-GIAB BAF track takes one.
    resolutionMultiplier: 0.001,
  },
}

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
        LCT_FST_TRACK,
        DECODE_RECOMB_TRACK,
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
            // The lane an LD triangle cannot draw (reviewer: "would a 'fst'
            // track make sense"): the block is not only long, its variants are
            // the most frequency-differentiated in the frame, which is the other
            // half of a sweep. Scatter over a fixed 0..0.5, because the value is
            // one point per variant and the spread IS the signal.
            // THE AXIS STARTS AT 0.1, NOT 0 (reviewer: "i can't see the Fst
            // pattern. need to zoom out way more if we want to see this i
            // think? either that or the Fst data is bad"). Zooming out is the
            // wrong lever and would make it worse: 93,876 variants across
            // 1400 px is 67 a pixel, and almost all of them sit under 0.05, so
            // a 0-0.5 axis spent its bottom fifth on a saturated blue bar and
            // drew the one differentiated variant as an indistinguishable speck
            // above it. Nothing about the data changed -- the floor is a
            // display window, and every point that survives it is a variant
            // more differentiated than 95% of the frame. rs4988235 at 0.472 is
            // then a point near the top of an otherwise sparse lane.
            //
            // Taller too (110 -> 170): with the haze gone the lane has to
            // resolve the spread between 0.1 and 0.5 rather than just show that
            // something is there.
            {
              trackId: 'kgp_lct_fst',
              type: 'LinearWiggleDisplay',
              defaultRendering: 'scatter',
              useBicolor: false,
              scatterPointSize: 2,
              summaryScoreMode: 'max',
              minScore: 0.1,
              maxScore: 0.5,
              height: 170,
            },
            // A REAL genetic map, so the block's edges are read against
            // something that is not made of LD. The page's own recombination
            // curve is 1 - r² between adjacent variants, which comes off the
            // same genotypes as the triangle, so it can suggest where the block
            // ends but cannot independently confirm it.
            //
            // deCODE, NOT the hub's HapMap maps sitting beside it, and the
            // distinction is the whole point: HapMap Release 24 is estimated
            // FROM LD (LDhat), so drawing it here would be circular. deCODE is
            // pedigree-based, counted off crossovers in families, and knows
            // nothing about haplotype correlation. Measured across this window
            // in 50 kb bins, cM/Mb: 16.0 at 135.75 Mb, then 0.0 for a solid
            // megabase (peak 0.6 over 135.80-136.70), then 2.3 / 5.2 climbing
            // from 136.75 and 9.8 at 136.95. The block build_lct_ld.sh resolves
            // at 135.75-136.75 is therefore a recombination desert with a
            // hotspot on each shoulder. The HapMap CEU map also puts a 14.5
            // spike INSIDE the block at 136.35, where deCODE reads 0.1.
            //
            // Spelled out rather than referenced by trackId out of the hg19 hub
            // that carries it, only for the NAME: the hub's own shortLabel is
            // "Sex Avg", which over an LD figure reads as a setting rather than
            // as a genetic map. Same bigWig either way, and hgdownload is on
            // third-party-hosts.txt already -- naming a hub track pulls from
            // there regardless, which is what that file's own note says.
            {
              trackId: 'decode_recomb',
              type: 'LinearWiggleDisplay',
              height: 100,
            },
            { trackId: 'kgp_lct_pooled', type: 'LDDisplay', height: 250 },
            { trackId: 'kgp_lct_panel', type: 'LDDisplay', height: 250 },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    // same real signal as the Anopheles figure: an LD panel exists to settle on,
    // and the generator's settle takes it from there
    readySelector: displayPainted('ld-display'),
    // 21 MB of genotypes across the two lanes, the pooled one on 2504 samples
    readyTimeout: 600000,
    // the gene lane, the Fst scatter, then two LD tracks (250 triangle + 50
    // recombination zone each) + headers + ruler/overview. The triangles came
    // down from 330 (reviewer: "reduce heights of the linkage tracks"), which
    // costs nothing legible: the block is a shape, not a height, and the room
    // it frees is what the Fst lane takes. +60 for that lane's second growth,
    // +100 and a header for the deCODE map.
    viewportHeight: 1190,
    settleMs: 8000,
    // The one variant the lane exists for, named on it. With the floor raised
    // the lane is legible, but it is still ~4,000 surviving points and nothing
    // in it says which one is the lactase-persistence allele; a reader would
    // have to take the caption's word and count pixels off the highlight band.
    // rs4988235 is chr2:136,608,646 in hg19, so the pill anchors to the
    // coordinate rather than to a measured x.
    annotations: [
      {
        type: 'text',
        text: 'rs4988235',
        fontSize: 16,
        anchor: {
          track: 'kgp_lct_fst',
          locus: 'chr2:136,608,646',
          fracY: 0.42,
          alignX: 'left',
          dx: -150,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          track: 'kgp_lct_fst',
          locus: 'chr2:136,608,646',
          fracY: 0.38,
          alignX: 'left',
          dx: -80,
        },
        anchor: {
          track: 'kgp_lct_fst',
          locus: 'chr2:136,608,646',
          fracY: 0.09,
        },
      },
    ],
  },
  {
    mode: 'url',
    // ONE FIGURE, four lanes: each population's LD panel with its own karyotype
    // lane under it (review: "this should be combined with the linkage tracks").
    // The karyotype lanes were a second figure until this round, which made the
    // reader carry the population names between two pictures to pair a block
    // with the mosquitoes that produce it. Stacked, the pairing is vertical: the
    // Cameroon block sits directly above the carriers it comes from, and the
    // empty Gabon panel above a lane with nothing to carry.
    name: 'ld/anopheles_2la',
    url: `${ANOGAM3_HUB}&session=${encodeSessionSpec({
      sessionTracks: [
        AG_LOCI_TRACK,
        agLdTrack(
          'ag1000g_2l_cmgam',
          'Cameroon, both arrangements segregating (r²)',
          'ag1000g_2L_CMgam.ld.gz',
        ),
        // 297 and 69 mosquitoes (the script prints both), and neither lane is
        // sized off its row count any more (review: "if there is anyway to
        // improve y-screen-real estate might be worth it"). This lane used to
        // be 297 px so that one mosquito was one pixel, which is a pleasing
        // property and not one the figure is read for: the rows are GROUPED by
        // karyotype, so what a reader takes from the lane is three contiguous
        // bands and where their edges fall, and 200 px still draws them well
        // clear of each other. Per-row resolution would matter if the readout
        // were density -- it is the trap the Dog10K cohort lane documents --
        // but inside a solid band aliasing has nothing to alias.
        //
        // 140 -> 200, AND THE FLOOR IS THE LEGEND, not the bands. The floating
        // legend is clipped to its own display's bounds, and this is the only
        // lane of the four with all three karyotype classes in it, so at 140 it
        // rendered 2L+a/2L+a and 2La/2L+a and cut 2La/2La off the bottom --
        // while the prose says the legend names three. The Gabon lane is
        // already at 200 for the same reason and legitimately shows two, since
        // that population has no inverted homozygote.
        agKaryotypeTrack('CMgam', 'Cameroon, one row per mosquito', 200),
        // "almost every mosquito", not "fixed": 5 of the 69 are heterozygous
        // for the inverted arrangement, and they are visible two lanes down
        agLdTrack(
          'ag1000g_2l_gagam',
          'Gabon, one arrangement in almost every mosquito (r²)',
          'ag1000g_2L_GAgam.ld.gz',
        ),
        // 200, and this one is bounded from BELOW rather than chosen. Gabon's
        // five heterozygotes are the last five of its 69 rows (the lane is
        // grouped in dosage order), so their band is 5/69 of whatever the lane
        // is: 14 px at 200, and the 11 px that 150 gave was rejected once
        // already as close to invisible for the one thing in the figure a
        // reader has to be able to find. It is also floored at the ~150 px its
        // floating legend needs, since that legend is clipped to the display's
        // own bounds. So this lane gave back 40 px where the Cameroon one gave
        // back 157.
        agKaryotypeTrack('GAgam', 'Gabon, one row per mosquito', 200),
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
            // On top, so both blocks below have their extent over them.
            {
              trackId: 'ag1000g_2l_loci',
              type: 'LinearBasicDisplay',
              height: 40,
            },
            { trackId: 'ag1000g_2l_cmgam', type: 'LDTrackDisplay' },
            {
              trackId: 'ag1000g_2la_karyotype_cmgam',
              type: 'LinearMultiSampleVariantDisplay',
            },
            { trackId: 'ag1000g_2l_gagam', type: 'LDTrackDisplay' },
            {
              trackId: 'ag1000g_2la_karyotype_gagam',
              type: 'LinearMultiSampleVariantDisplay',
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    // One testid, not a selector enumerating the four lanes: the generator's
    // own settle already waits for every DisplayChrome-wrapped display to leave
    // `loading` and then to paint (see settlePass in generate-screenshots.ts),
    // which is what "all four are done" means. This only has to hold until the
    // first LD panel exists to settle on.
    readySelector: displayPainted('ld-display'),
    // 180s. The data is small; what takes the time is the anoGam3 hub's
    // chrom.sizes off hgdownload.soe.ucsc.edu, which times out and refetches
    // often enough to blow through 120s on a bad day.
    readyTimeout: 180000,
    // two LD tracks (340 each) + the two 200 px karyotype lanes + 4 headers +
    // ruler/overview. Undersize this and the rows past the fold are cropped away
    // silently: first paint still fires, so the capture succeeds with the
    // informative rows missing.
    //
    // 1472 -> 1355: 197 px off the two karyotype lanes, 80 back to the LD
    // panels so the 2La block closes. The measurement behind the trade is in
    // the two comments above; what it does NOT include is any slack, because
    // there was none -- the run reported nothing blank below the content at
    // 1472, and an ink scan of the capture found both LD panels drawing to
    // their own bottom edge. So the 60 px the Cameroon lane took back for its
    // legend is added here rather than found somewhere in the frame, and 70
    // more for the 2L loci lane and its header.
    viewportHeight: 1485,
    settleMs: 8000,
    // One callout per lane, saying what each lane shows rather than only naming
    // the span (review: "a red text annotation on both cameroon and gabon
    // tracks that says why this is interesting"). Both anchor to the same
    // published locus in their own track, so they sit over the span they
    // describe and move with the layout. chr2L, not 2L: the anchor locus is
    // resolved against the assembly's canonical names (the .ld.gz's own 2L is
    // the adapter's business), so a bare name here resolves to nothing and
    // fails the spec outright.
    //
    // Plain words for everything except the mechanism itself: arrangement is
    // "version", but recombination is named ("recombine"), which is the term
    // the tutorial prose and every source on 2La uses and the one word a reader
    // can look up (review: "the term 'shuffle' should use biological language
    // e.g. 'recombine'"). The mechanism — two versions that cannot recombine
    // with each other — is stated rather than implied, because it is the whole
    // reason one panel is red and the other is not.
    //
    // Flat statements, no counts and no emphasis (review: "very 'strong'
    // language ... prefer to be a little more dry ... avoid referring to exact
    // numbers, just general concepts"). The numbers behind them are in the
    // caption and the tutorial prose, where they can be attributed: Gabon is 64
    // standard homozygotes and 5 heterozygotes of 69, Cameroon 168/79/50 of 297
    // (build_ag1000g_ld.sh prints these, and the sample TSVs this figure
    // colours its rows from carry them). Gabon is therefore "nearly every",
    // never "fixed", and the label points at the carriers in the lane below
    // rather than denying they exist (review: "there are inversions in the
    // gabon population, so unclear if that is considered here").
    //
    // "Recombines freely" is a claim about the COMMON variation only, which is
    // all these panels contain: both are built at --maf 0.2, and Gabon's
    // inverted version sits at 5 of 138 haplotypes, so the variants that tag it
    // are below that floor and absent from the file. A label reading "nothing
    // stays linked" would claim more — unfiltered, those five carriers' own
    // rare tag SNPs would still correlate with each other.
    annotations: [
      {
        type: 'text',
        anchor: {
          track: 'ag1000g_2l_cmgam',
          locus: TWO_LA_LOCUS,
          fracY: 0,
          dy: 20,
        },
        text: 'Both versions are common here, and they do not\nrecombine with each other, so this span is\ninherited as one piece.',
        // 16, not the 18 the one-line labels used: these say more, and at 18 a
        // ~50 character line runs past maxWidth 430, which is where the r²
        // legend sits in the top right corner of both panels.
        fontSize: 16,
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
        text: 'Nearly every mosquito here carries the same\nversion (the few that do not are the blue rows\nbelow), so this span recombines freely.',
        fontSize: 16,
        maxWidth: 430,
      },
    ],
  },
  // ld/anopheles_r2_vs_dprime was here and is DELETED (review: "i dont need a
  // 'live regression guard' i need interesting figures ... we cant even see the
  // inversion multisamplesv track so it is not a good figure. delete i think").
  // It drew the same Cameroon file twice, r2 over D', with no karyotype lane, so
  // the span the two labels talked about was not in the frame. ld/anopheles_2la
  // above is the same locus with the carriers under each panel, and the metric
  // difference is prose plus the ratios build_ag1000g_ld.sh prints per panel.
  //
  // The regression this figure used to guard is already covered where it should
  // be: tabix hands back no header for a `-S 1`-indexed plink file, the column
  // layout lost its DP column, and a 'dprime' request silently resolved to r2
  // while the legend still said D'. PlinkLDTabixAdapter.test.ts asserts
  // `dprimeIdx` on exactly that file, so nothing is lost by deleting the
  // picture.
  // ld/lct_lactase was here and is DELETED (reviewer: "please combine this with
  // linkage disequilibrium track in same view. then consider deleting the
  // linkage disequilibrium track standalone since combined will be better"). It
  // was the same locus, the same gene and ClinVar lanes and the same European
  // panel as the figure below, with the triangle as the only data lane — so a
  // reader met the statistic and the thing it summarises as two pictures and
  // had to carry the locus between them. The triangle is now the top lane of
  // ld/lct_haploblock, over the haplotypes it is computed from.
  //
  // THE HAPLOBLOCK FIGURE, and the reason it exists: an LD triangle is a
  // pairwise matrix rotated 45 degrees, so its VERTICAL axis is the distance
  // between the two variants being compared rather than any value. Nothing on
  // screen says that, no other track in the browser works that way, and the
  // review that retired ld/anopheles_r2_vs_dprime landed on the same thing here
  // ("ld is really the only thing that really makes me ask 'wtf'").
  //
  // r² is the statistic; the haplotype block is the THING. So this draws the
  // thing, on the same locus as the triangle above: one row per haplotype, one
  // column per variant.
  //
  // ORDERING IS WHAT MAKES THE BLOCK APPEAR, not colour and not row count. A
  // block is a set of alleles travelling together, and which of them is the ALT
  // allele varies site to site, so a matrix of common variants in adapter order
  // is a plaid at ANY row count — measured, and the real reason the first
  // attempt (removed in 7dd1e36ece) had no block in it, with the 5008-row
  // sub-pixel problem sitting on top of it. Clustering fixes it: near-identical
  // haplotypes become adjacent, and the lactase-persistence haplotype is young
  // enough to be internally uniform, so it lands as one solid slab against the
  // mosaic of everything else.
  //
  // CLUSTERED, NOT GROUPED, which is the reverse of what the first attempt tried
  // and is the whole design. Grouping by population puts labelled bands down the
  // sidebar but leaves each band in adapter order, so the slab never forms. The
  // population information is not lost — `colorBy` puts it in the sidebar stripe
  // — and it now arrives as a RESULT: the clustering is given no knowledge of
  // rs4988235, and the clade it finds is the one whose stripe is CEU and FIN.
  //
  // rs4988235 itself is MAF 0.30 across these samples and so sits below the 0.35
  // filter — it is not one of the columns drawn. The ClinVar tick above the
  // matrix is therefore an independent marker of where the causal variant is,
  // not a column the clustering was steered by.
  //
  // 150 SAMPLES, NOT 2504, from scripts/build_lct_haploblock.sh: six populations
  // at 25 each, spanning rs4988235-A from 73.7% (CEU) to 0% (YRI, CHB). The full
  // release is 5008 haplotype rows, which is 0.18 px a row in this lane and
  // averages to a flat wash; 300 rows is 2.7 px. That script prints the
  // arithmetic and the per-population frequencies rather than asserting them.
  {
    mode: 'url',
    name: 'ld/lct_haploblock',
    url: `${HG19_HUB}&session=${encodeSessionSpec({
      sessionTracks: [
        // The statistic, over the haplotypes it is computed from. 360 rather
        // than the standalone figure's 510: the triangle's subject is the shape
        // of the block and its two edges, both of which survive a shorter
        // band, and the matrix under it is what the figure is for.
        lctTrack('LCT lactase-persistence LD, 1000G European panel (r²)', 360),
        {
          type: 'VariantTrack',
          trackId: 'kgp_lct_haplotypes',
          name: '1000 Genomes haplotypes across LCT (one row per haplotype)',
          assemblyNames: ['hg19'],
          adapter: {
            type: 'VcfTabixAdapter',
            uri: `${AG_POPGEN}/lct_1kg_chr2_6pop.vcf.gz`,
            // the release's own sample table, already hosted for the
            // config_demo chr1 track. Sample ids are the same across
            // chromosomes, so it applies to this chr2 slice unchanged.
            samplesTsvLocation: {
              uri: 'https://jbrowse.org/genomes/hg19/1000g.sorted.csv.gz',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          // 2.4 Mb: the block plus enough flank on both sides that the slab has
          // somewhere to stop, AND that the triangle now stacked over it has
          // two visible edges. At the matrix's own 1.5 Mb the triangle filled
          // the frame corner to corner — the exact failure the tutorial warns
          // about one section up, since r² against rs4988235 is still 0.72 at
          // 135.8 Mb and 0.37 at 136.8 Mb (build_lct_ld.sh) and only reaches
          // 0.06 / 0.02 at 135.0 / 137.4 Mb. Matrix mode gives every variant an
          // equal-width column regardless of how the variants bunch
          // genomically, so the cost is columns: ~1140 here against ~710, still
          // about a pixel apiece and the slab is a horizontal band either way.
          loc: 'chr2:135,000,000-137,400,000',
          highlight: LCT_HIGHLIGHT,
          tracks: [
            {
              trackId: 'hg19-ncbiRefSeqCurated',
              type: 'LinearBasicDisplay',
              height: 60,
              showOnlyGenes: true,
            },
            // Same filtered ClinVar lane as ld/lct_lactase above, so a reader
            // moving between the two figures sees the causal variant marked the
            // same way in both.
            {
              trackId: 'hg19-clinvarMain',
              type: 'LinearBasicDisplay',
              height: 70,
              jexlFiltersSetting: [
                "jexl:get(feature,'phenotypeList')=='LACTASE PERSISTENCE'",
              ],
            },
            // The triangle directly above the matrix, on one x axis: a column
            // of the matrix and a corner of the triangle are the same variant,
            // and the block's edges land at the same coordinates in both.
            { trackId: 'kgp_lct_ld', type: 'LDDisplay' },
            {
              trackId: 'kgp_lct_haplotypes',
              type: 'LinearMultiSampleVariantMatrixDisplay',
              height: 700,
              lineZoneHeight: 34,
              // one row per haplotype rather than per sample. Phased is the
              // point: a haplotype is what travels as one piece, and a diploid
              // row would average a carrier chromosome with a non-carrier one.
              renderingMode: 'phased',
              runClustering: true,
              // 135.5-137.0, the window this figure used to draw as well as
              // cluster on, kept as the clustering core when the drawn window
              // widened to 2.4 Mb: it is the region the 100%-of-carriers-in-one-
              // clade result was measured on. Clustering on a narrower core than
              // is drawn is the dog10k-igf1-haplotype pattern; what does not
              // work here is going narrower still — the 135.7-136.15 Mb
              // sub-window where per-site agreement separates carriers best puts
              // only 48% of carriers in the top clade.
              clusterRegion: 'chr2:135,500,000-137,000,000',
              colorBy: 'population',
              // the common, block-tagging variants. Unfiltered, this window is
              // mostly rare variation and the slab is buried in speckle.
              minorAlleleFrequencyFilter: 0.35,
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    // the dendrogram only renders once the clustering RPC lands, so this waits
    // on real completion rather than on a duration guess
    readySelector: '[data-testid="tree_sidebar_dendrogram"]',
    // the r² is computed live off 1.5 Mb of the European panel, which is the
    // slow half now — the standalone triangle figure allowed 300 s for a wider
    // window
    readyTimeout: 300000,
    settleMs: 8000,
    // gene(60) + clinvar(70) + the 360px LD band + the 700px matrix, their
    // headers and the ruler. Sized from the run's own clipped/blank report;
    // +20 for the 4 px of extra clearance every offset track label now takes.
    viewportHeight: 1518,
    // WHAT THE CLUSTERING PRODUCED, marked (reviewer: "does this figure
    // somewhat 'clearly' show the clustering? please analyze. if needed add red
    // text annotation to figure showing groupings in the multi-sample variant
    // view").
    //
    // It does, and the thing to look at is a shape rather than the dendrogram:
    // the clustered rows resolve into one band that is uniform straight across
    // the block while every row outside it is speckled, which is what a
    // haplotype that travelled as one piece looks like on a matrix. The
    // dendrogram beside it is 550 rows deep in ~40 px of gutter and can only
    // ever be a texture at this height, so it is not what the pill points at.
    //
    // The pills carry NUMBERS, not adjectives (reviewer: "the text 'one
    // clustered haplotype' is too vague ... i need more detail"). Both come
    // from the file this figure reads: at rs4988235 (2:136,608,646) the slice
    // carries AC=90 / AN=300, i.e. 150 samples, 300 haplotype rows, 90 of them
    // carrying the persistence allele -- checkable with
    // `bcftools view -H -r 2:136608646-136608646` on the hosted VCF. That the
    // clustering puts all 90 in one clade is the measurement recorded on
    // clusterRegion above, and the render agrees with it: the uniform band the
    // first pill sits beside is ~31% of the matrix's height, i.e. ~92 of 300
    // rows, which is the carrier count and not a coincidence.
    annotations: [
      {
        type: 'text',
        text: 'One clade: the 90 of 300 haplotypes carrying rs4988235-A, unbroken across the block',
        fontSize: 17,
        maxWidth: 330,
        anchor: {
          track: 'kgp_lct_haplotypes',
          locus: 'chr2:135,120,000',
          fracY: 0.3,
          alignX: 'left',
        },
      },
      {
        type: 'text',
        text: 'The other 210: no block shared across the window',
        fontSize: 17,
        maxWidth: 300,
        anchor: {
          track: 'kgp_lct_haplotypes',
          locus: 'chr2:135,120,000',
          fracY: 0.72,
          alignX: 'left',
        },
      },
    ],
  },
]
