import { displayPainted, encodeSessionSpec } from '@jbrowse/browser-test-utils'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The LD heatmap display's home-run result: the lactase-persistence sweep at
// LCT/MCM6, computed live from phased 1000 Genomes genotypes (exact haplotypic
// r², not the composite estimate), so no precomputed LD file is needed.
//
// hg38, on the 1000 Genomes 30x high-coverage release (NYGC), which is called
// natively on GRCh38 rather than lifted. Both halves of that matter: the
// figure's genetic-map lane is deCODE's 2019 sequence-level map, which UCSC
// also built natively on hg38 at 682 bp average resolution, and hg19 carries
// only the 2010 map in 10 kb bins. The pair is the reason this moved.
//
// A companion MAPT 17q21.31 inversion figure was dropped in 969c44cc21: no
// accessible callset has usable per-sample genotypes for that inversion, so it
// could only have been shown with a proxy. The inversion case now has a figure
// (`ld/anopheles_2la`, below) that clears that bar with real per-sample phased
// genotypes, in a mosquito rather than a proxy human callset — the standing
// rule is unchanged, don't add an inversion figure without genotypes behind it.
//
// Data is a region slice re-hosted on jbrowse.org S3 so the figure and its live
// "Open in JBrowse" link load fast and don't depend on the EBI FTP being up.
// Contigs are chr-named on both sides, so nothing depends on a chromAlias here.
//
// THE HOSTED NAMES CARRY `1kg38`, and the hg19/phase 3 files they replace are
// still up under the old `1kg` names. The bucket has no versioning, so reusing
// a name would have been an unrecoverable silent swap of one assembly's
// coordinates for another's. Don't "tidy up" by deleting the old ones either;
// their URLs are in released docs.
//
// BOTH LCT FIGURES READ THE 3.4 Mb SLICES (chr2:133.8-137.2 Mb, built by
// scripts/build_lct_ld.sh: `_eur_wide` 13 MB, `_pooled_wide` 29 MB). An earlier
// hg19 pair began at the swept block's own left edge, so a figure on them was
// cut at the edge it was claiming and nothing in it distinguished "the LD ends
// here" from "the file ends here" (review: "the recombination triangle covers
// whole screen. what is user supposed to take away?").
//
// THE 2504 UNRELATED SAMPLES, not the release's full 3202. Relatives share long
// haplotypes for reasons that have nothing to do with a sweep, so including
// them inflates exactly the quantity these lanes draw.
//
// LD IS PER-POPULATION, SO THE SLICE IS TOO. The figure used to run on the
// pooled file alone and the block came out pink and fragmented, because pooling
// panels that carry different haplotypes at different frequencies averages the
// correlation away. build_lct_ld.sh prints the pair it is chosen on: mean
// pairwise r² over the block, one panel against the pooled release. Don't put
// two *human* population panels side by side to make this point — a figure
// comparing human groups is not what this page is for, and the point is about
// how r² is computed rather than about the groups. Stacked panels are fine
// where the populations aren't human: the Anopheles figure below is two
// mosquito panels, because there the presence and absence of the arrangement
// *is* the result.
const HG38_HUB = `?config=${encodeURIComponent('https://jbrowse.org/ucsc/hg38/config.json')}`

// LCT / MCM6 lactase-persistence locus. Recent positive selection swept a long
// haplotype to high frequency in dairying populations, so a large block of SNPs
// around LCT is inherited together — a long stretch of high r².
const lctTrack = (name: string, height = 510) => ({
  type: 'VariantTrack',
  trackId: 'kgp_lct_ld',
  name,
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://jbrowse.org/demos/popgen/lct_1kg38_chr2_eur_wide.vcf.gz',
  },
  displays: [
    {
      type: 'LDDisplay',
      showLDTriangle: true,
      showLegend: true,
      // r² is computed from the genotypes themselves, so the whole window has
      // to be fetched and the byte gate trips. `forceLoad` is the declarative
      // half of that banner's own FORCE LOAD button, which is what it is for:
      // a view nobody can click. A raised `fetchSizeLimit` would also get the
      // figure drawn, and it is the worse instrument -- it moves a ceiling that
      // protects every OTHER window of the same track, so a reader who opens
      // the live link and pans somewhere dense downloads it with no warning.
      forceLoad: true,
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
// build_lct_ld.sh prints mean r² against rs4988235 in 100 kb bins along the
// slice, and this window is read off it: the block runs about 135.0-136.25 Mb,
// and the bins at both ends of THIS frame are down in the noise, so the frame
// carries the block plus roughly a megabase of unlinked sequence on each side.
const LCT_LOC = 'chr2:134,000,000-137,150,000'

// Both LCT figures take the same window. This one is the expensive render of the
// two: r² is computed live, and the pooled lane correlates 5008 haplotypes
// against the panel's 1006. The readyTimeout below is headroom rather than a
// measured need. If it appears to hang, check for a second
// `generate-screenshots` process on the machine before shrinking anything —
// that was the cause last time, not the window.
const LCT_WIDE_LOC = LCT_LOC

// The deCODE genetic map, as published by UCSC. See the note on this track's
// entry in the LCT figure's track list for which deCODE map this is and why it
// is not one of the LD-derived maps.
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

// Band the LCT/MCM6 locus so the reader sees the high-r² block sits right over
// the lactase gene (the enhancer variant rs4988235 is in an MCM6 intron,
// upstream of LCT).
const LCT_HIGHLIGHT = [
  {
    refName: 'chr2',
    start: 135_787_850,
    end: 135_876_467,
    assemblyName: 'hg38',
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
// chromAlias reconciles at query time. The LCT figures above need no such
// reconciliation -- their callset and their hub are both chr-named.
const ANOGAM3_HUB = `?config=${encodeURIComponent('https://jbrowse.org/ucsc/anoGam3/config.json')}`

const agLdTrack = (
  trackId: string,
  name: string,
  file: string,
  ldHeight: number,
  squash: boolean,
) => ({
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
      // THE HEIGHT ARITHMETIC, because two rounds of review have now been about
      // it. An unsquashed LD panel draws its triangle at natural aspect -- apex
      // depth is half the drawn width (`canvasHeight` = `canvasWidth / 2` in
      // LDDisplay/shared.ts) -- and the lane's own height clips whatever does
      // not fit. Clipping the whole-arm triangle is right and unavoidable: at
      // 49.4 Mb across ~1490 css px it would be 745 px deep, and the deep half
      // is pairs 20 Mb apart. But 2La is 20,524,058-42,165,532, which draws 653
      // px wide, so ITS apex is 327 px down: at 300 the block this figure
      // exists to show was cut flat at the lane boundary, 27 px short of
      // closing, and a truncated block reads as one that continues past the
      // frame.
      //
      // `squashToHeight` fits that whole 745 px wedge into the lane instead, so
      // it never cuts anything and the height becomes free -- at the cost of
      // scaling 2La's apex by height/745.
      //
      // IT WAS RENDERED, at 240 on both panels, and it is WORSE ON MORE THAN
      // THE ARITHMETIC, which is why it is a parameter here rather than a
      // deleted line. The review asked for it ("we need to improve y-axis real
      // estate here, including by 'squashing' the ld triangles") and the earlier
      // round had only reasoned about it, so it was worth a capture. Two things
      // the arithmetic did not predict:
      //
      // - the block stops being SOLID. Scaling y compresses each cell as well as
      //   the wedge, so the 2La triangle came back as a pale hatched wedge --
      //   individual cells resolvable, no filled mass -- where unsquashed it is
      //   an unmistakable block of red. The figure's whole claim is that one
      //   panel has a block in it and the other does not, and squashed, the
      //   claim is a texture difference.
      // - the empty corner is not reclaimed anyway. Squashing brings the
      //   long-range pairs into frame, and they are white, so the lane is still
      //   about half blank -- just blank with the block flattened above it.
      //
      // So this stays false for both panels, and the height saving is taken
      // where a panel has no deep signal to lose instead. See the two call
      // sites.
      squashToHeight: squash,
      height: ldHeight,
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
const agKaryotypeTrack = (
  pop: string,
  name: string,
  height: number,
  showLegend: boolean,
) => ({
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
      //
      // THE LEGEND IS A HEIGHT FLOOR, which is why it is a parameter. It is
      // clipped to its own display's bounds and it is nine rows tall (four
      // genotype shades, three karyotype classes, two headings) — measured off
      // the capture at 192 css px, i.e. essentially the whole of a 200 px lane.
      // So a lane showing it cannot go below ~200 whatever its row count wants,
      // and a lane not showing it is bounded by its rows alone. The second lane
      // does not show it: its key is identical to the one directly above it,
      // minus the class that population has no carriers of.
      showLegend,
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
// unrelated samples of the same release, over the same window the LD lanes
// draw. Computed by vcftools from the 30x chr2 callset
// (scripts/build_lct_ld.sh), so the estimator is a published one and the panels
// are the release's own.
//
// Per site, not windowed, and that is the finding: rs4988235 comes out the most
// differentiated site in the frame, and the sites just below it are its
// neighbours inside the block. The script prints its RANK rather than its value,
// because the rank is the claim and a run that stopped putting it first is the
// thing to notice. A 10 kb windowed version was built first and says much less
// -- the block's windows average barely above the flanks, because a window mixes
// the swept haplotype with every rare variant sharing it.
//
// The contrast is one panel against the pooled remainder rather than against a
// named second population: the figure's own subject is panel-versus-pooled, and
// naming a second population here would make a comparison the figure is not
// about.
//
// WHICH panel is named, though (review: "unclear what is meant by 'one
// population panel'"). Leaving it as "this panel" was the same reticence applied
// one step too far: not naming a SECOND population keeps the figure's subject,
// while not naming the FIRST one leaves three track headers each referring to a
// set of samples the frame never identifies. It is the European panel, it is the
// population the sweep happened in, and that is the reason this locus is the
// worked example.
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
    // raw per-site values out to well past this window's ~2.2 kb/px: a bigWig
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
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: `https://jbrowse.org/demos/popgen/${file}`,
  },
  displays: [
    {
      type: 'LDDisplay',
      showLDTriangle: true,
      showLegend: true,
      // see lctTrack above: the gate is lifted for this view rather than raised
      // for the track
      forceLoad: true,
      minorAlleleFrequencyFilter: 0.35,
      height: 330,
      // Cells sized by genomic distance (review: "potentially use 'proportional
      // sizing' for the ld blocks with useGenomicPositions:true"). This also
      // retires the connector zone the previous round was tuning: the fan of
      // lines existed to say which column each SNP was, which is only a question
      // when x is SNP index. On genomic positions the SNP IS its column, so the
      // fan is gone and nothing is reserved above the triangle.
      useGenomicPositions: true,
    },
  ],
})

export const ldSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'ld/lct_pooled_vs_panel',
    url: `${HG38_HUB}&session=${encodeSessionSpec({
      sessionTracks: [
        // Both lane names say which samples went in, since that is the only
        // thing that differs between them and the two triangles are otherwise
        // the same display over the same window. "All panels pooled" / "One
        // population panel" named the difference without identifying either
        // side, which is what the review caught.
        lctPanelTrack(
          'kgp_lct_pooled',
          'All 1000 Genomes populations pooled (r²)',
          'lct_1kg38_chr2_pooled_wide.vcf.gz',
        ),
        lctPanelTrack(
          'kgp_lct_panel',
          'European panel only, where the sweep happened (r²)',
          'lct_1kg38_chr2_eur_wide.vcf.gz',
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
            // The genes, so the band has something to be over (review: "we need
            // to add the gene track ... we need to see why this is important").
            // showOnlyGenes because 3 Mb of RefSeq is otherwise a wall of
            // transcripts and the point is which gene the block sits on.
            {
              trackId: 'hg38-ncbiRefSeqCurated',
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
            // wrong lever and would make it worse: the frame holds ~81,000
            // scored sites across ~1400 px, and almost all of them sit under
            // 0.05, so a 0-0.5 axis spent its bottom fifth on a saturated blue
            // bar and drew the one differentiated variant as an
            // indistinguishable speck above it. Nothing about the data changed
            // -- the floor is a display window, and every point that survives
            // it is a variant more differentiated than most of the frame.
            // rs4988235 is then a point near the top of an otherwise sparse
            // lane, and build_lct_ld.sh prints that it is rank 1.
            //
            // Taller too (110 -> 170): with the haze gone the lane has to
            // resolve the spread between 0.1 and 0.5 rather than just show that
            // something is there.
            //
            // ZOOMING OUT FURTHER IS NOT AVAILABLE, and would not show what it
            // is asked for (review: "it might be worth zooming out even more to
            // see that fst is peaking here, or making it a dual figure with the
            // zoom out (no ld track) and zoom in (with ld track)").
            //
            // The scores are a 3.40 Mb slice -- bigWigInfo puts every interval
            // in chr2:133,800,005-137,199,999 -- and this frame is 3.15 Mb of
            // it, so a wider window draws blank lane either side rather than
            // more scan. A genuinely wider one means recomputing Fst over a
            // wider span from the callset and hosting a second file, which is a
            // pipeline decision rather than a spec edit.
            //
            // And there is no sharp peak to zoom out to. rs4988235 IS the
            // single highest scored site in the file (0.474 at
            // chr2:135,851,075), but 134 sites clear 0.30 and they are spread
            // across the block, only three of them inside LCT/MCM6 -- which is
            // what a sweep looks like from Fst: the whole haplotype is
            // differentiated, not the causal base. The lane already draws that.
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
            // A MEASURED genetic map, which is the only honest way to say
            // where the block ends: it is counted off crossovers, in cM/Mb, and
            // has no LD in it, so reading it against the triangles below is not
            // circular. This is the lane that replaced a "recombination track"
            // the display used to compute as 1 - r² between adjacent variants
            // -- the triangle's own first off-diagonal, which could only ever
            // agree with the triangle.
            //
            // WHICH deCODE MAP, because there are two and hg19 has the wrong
            // one. This is `recombRate/recombAvg.bw`, the 2019 sequence-level
            // map (Halldorsson et al.), built natively on hg38 at 682 bp
            // average resolution. hg19's `decodeRmap` is Kong et al. 2010 in
            // 10 kb bins; the page cited the 2019 paper over that file for a
            // while, which is what moving the figure fixed. NOT the HapMap
            // maps, and NOT hg38's own `recomb1000GAvg`: both are estimated
            // FROM LD, so either one over an LD triangle confirms the triangle
            // with itself.
            //
            // Measured in 50 kb bins off the RENDERED lane, which is what a
            // reader is actually looking at: one continuous flat run from
            // 135.04 to 135.95, broken only by two bins under 10 cM/Mb, with
            // the bar clipped at the 100 ceiling at 134.99 on one shoulder and
            // at 136.17 and 136.27 on the other. Off the bigWig itself those
            // three read 161, 460 and 230.
            //
            // Read that against the two things measured independently of it.
            // build_lct_ld.sh's r² profile against rs4988235 is above 0.6 from
            // 135.0 to 136.0 and falls 0.32 / 0.31 / 0.06 across 136.1-136.3,
            // i.e. its fall-off brackets the right-hand hotspot pair. And the
            // panel triangle's own block, measured off this capture at depth
            // 60-220 px, spans 134.70-136.00 -- so it covers the desert and
            // runs somewhat past it on the left, where the map is low rather
            // than zero. Don't tighten the caption to claim the two edges
            // coincide; the right one does and the left one decays.
            //
            // maxScore 100 CLIPS those two hotspots, deliberately: autoscaled
            // to 460 the whole rest of the lane is under a tenth of the height
            // and the desert cannot be told from the merely-quiet flanks. Same
            // argument as the Fst lane's floor one entry up -- it is a display
            // window, and the numbers behind it are here.
            //
            // Spelled out rather than referenced by trackId out of the hub that
            // carries it, only for the NAME: the hub's own shortLabel is
            // "Recomb. deCODE Avg", which over an LD figure reads as a setting
            // rather than as a genetic map. Same bigWig either way, and
            // hgdownload is on third-party-hosts.txt already -- naming a hub
            // track pulls from there regardless.
            {
              trackId: 'decode_recomb',
              type: 'LinearWiggleDisplay',
              minScore: 0,
              maxScore: 100,
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
    // 42 MB of genotypes across the two lanes, the pooled one on 2504 samples
    readyTimeout: 600000,
    // the gene lane, the Fst scatter, the deCODE map, then two 250 px LD
    // triangles + headers + ruler/overview. The triangles came down from 330
    // (reviewer: "reduce heights of the linkage tracks"), which costs nothing
    // legible: the block is a shape, not a height, and the room it frees is
    // what the Fst lane takes.
    //
    // Deleting the 1 - r² band each LD lane reserved gives back 100 px, and
    // hg38's RefSeq over this window spends about the same again: the frame
    // holds a dozen more genes than the hg19 one did, so the gene lane stacks
    // deeper. Sized from the run's own clipped report rather than by
    // subtracting what was removed, which is what got this 103 px short.
    viewportHeight: 1195,
    settleMs: 8000,
    // The one variant the lane exists for, named on it. With the floor raised
    // the lane is legible, but it is still thousands of surviving points and
    // nothing in it says which one is the lactase-persistence allele; a reader
    // would have to take the caption's word and count pixels off the highlight
    // band. rs4988235 is chr2:135,851,076 on hg38, so the pill anchors to the
    // coordinate rather than to a measured x.
    annotations: [
      {
        type: 'text',
        text: 'rs4988235',
        fontSize: 16,
        anchor: {
          track: 'kgp_lct_fst',
          locus: 'chr2:135,851,076',
          fracY: 0.42,
          alignX: 'left',
          dx: -150,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          track: 'kgp_lct_fst',
          locus: 'chr2:135,851,076',
          fracY: 0.38,
          alignX: 'left',
          dx: -80,
        },
        anchor: {
          track: 'kgp_lct_fst',
          locus: 'chr2:135,851,076',
          fracY: 0.09,
        },
      },
    ],
  },

  // THE ZOOM-OUT, WHICH IS NOW AVAILABLE (review: "we can make wider
  // calculations if it results in better figure", answering the round before it,
  // "it might be worth zooming out even more to see that fst is peaking here").
  // It needed a second file, since the lane below reads a 3.4 Mb slice and a
  // wider frame on it draws blank either side. scripts/build_lct_fst_scan.sh
  // recomputes the same Weir & Cockerham estimator, from the same panels of the
  // same release, over 40 Mb of chr2 with LCT at the middle.
  //
  // It does result in a better figure, and by more than expected: rs4988235 is
  // the highest-scoring site of 977,763 across the whole span, and the top ten
  // are all inside the block with it. Of the sites clearing 0.35, sixty-one are
  // in 134-136 Mb and five are in the other thirty-nine megabases.
  //
  // WINDOWED FST IS THE ONE THING THAT WOULD DESTROY THIS, and it was built
  // that way first. See the build script: at 100 kb bins the block ranks 58th
  // of 400 and the lane says the locus is ordinary. A sweep differentiates its
  // own haplotype's variants and leaves the rest of the bin on the background.
  {
    mode: 'url',
    name: 'ld/lct_fst_scan',
    url: `${HG38_HUB}&session=${encodeSessionSpec({
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
            // RAW PER-SITE, the same pin the narrow lane takes, because the
            // zoom bin this lane used to be read through was drawing its own
            // background rather than the data's (review: "did you look to see
            // if more fine-grained fst can be added in the zoomed out view? we
            // can recalculate data").
            //
            // Nothing needed recalculating. build_lct_fst_scan.sh already
            // scores every site and 930,180 of them are in this window; what
            // was coarse was the READ. 40 Mb across the capture's ~1,490 CSS px
            // of data area is ~27 kb a pixel, which lands on the file's
            // coarsest useful zoom level, 40,960 bp -- so the lane drew 1,078
            // points, each of them `summaryScoreMode: 'max'` over about 950
            // sites. Outside the block that bin max has a median of 0.160 and a
            // 99th percentile of 0.333, where the per-site values it summarizes
            // are 0.0002 and 0.118. More than half the old scatter therefore
            // sat above 0.15 for no reason but the summarization, and its
            // background ran to within 0.14 of the 0.474 the pill points at.
            // Per site the peak stands four times clear of the same percentile.
            //
            // The peak was never what the bin was protecting: unbinned, sites
            // over 0.45 go 8 -> 10 and sites over 0.35 go 33 -> 67, while
            // points above the lane's 0.1 floor go 949 -> 13,676. What the bin
            // was hiding is the low half of the distribution, which is the half
            // that makes a peak look like one.
            //
            // The note that used to be here called raw "both unfetchable and
            // unplottable". Measured, it is neither: the whole per-site set is
            // one ~5.5 MB read of the file's data section in ~0.6 s, and of the
            // 930,180 points only 13,676 land above the floor -- the rest clamp
            // onto it, since makeScoreNormalizer clamps to the domain rather
            // than dropping. `max` stays below anyway, for a reader who
            // coarsens this lane from the track menu.
            //
            // The frame beneath draws the same way, which is the other half of
            // this: the two are one analysis at two scales and now look like
            // it, where before the wide lane read as a different dataset.
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
            // The same gene lane the frame below carries, so the wide panel is
            // a stretch of chromosome with genes all along it rather than a
            // bare scatter, and the peak is over one of them (review: "it
            // might be useful to show the gene track in the first figure of
            // the lct panel in the zoom out").
            //
            // showOnlyGenes for the same reason as below, and `collapsed`
            // because 40 Mb of RefSeq stacks into rows that are all the same
            // statement at this width: what a reader can take off the lane
            // here is where genes are, not which transcript is which.
            {
              trackId: 'hg38-ncbiRefSeqCurated',
              type: 'LinearBasicDisplay',
              displayMode: 'collapsed',
              height: 40,
              showOnlyGenes: true,
            },
            {
              trackId: 'kgp_lct_fst_scan',
              type: 'LinearWiggleDisplay',
              defaultRendering: 'scatter',
              useBicolor: false,
              scatterPointSize: 2,
              summaryScoreMode: 'max',
              // The lane below's floor and ceiling, so the two are one axis
              // read at two scales and the peak is the same height in both.
              minScore: 0.1,
              maxScore: 0.5,
              height: 230,
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readySelector: displayPainted('wiggle-display'),
    readyTimeout: 120000,
    settleMs: 8000,
    // 450, not the 390 the lane and its chrome add up to: at 390 the axis was
    // cut off below 0.2 and the noise floor went with it, which is the half of
    // the picture that makes the peak a peak. Neither of the run's own reports
    // sees this -- the clipping is the viewport cutting the display, not content
    // below the fold. The gene lane and its header take the rest.
    viewportHeight: 520,
    // The peak named, from the side. It sits at 0.474 on an axis that stops at
    // 0.5, so there is no room above it for a pill, and the y is derived rather
    // than measured: wiggle-core's axisPlotBox insets the plot by
    // YSCALEBAR_LABEL_OFFSET at each end, and the track element starts 6px above
    // the display, so a score s is 6 + (h-5) - ((s-min)/(max-min))*(h-10) below
    // the track's top edge. Same derivation as dog10k-size-fst-scan's fstY.
    //
    // `leader`, so the pill and its arrow are one annotation: a three-letter
    // label is the case a hand-written tail offset gets wrong, and this one left
    // the arrow ending 50px short of the pill.
    annotations: [
      {
        type: 'text',
        text: 'LCT',
        fontSize: 20,
        leader: true,
        anchor: {
          track: 'kgp_lct_fst_scan',
          locus: 'chr2:135,851,076',
          fracY: 0,
          dy: 25,
        },
        dx: 150,
      },
    ],
  },

  // The two scales as one figure. The lower frame cannot say the locus is
  // unusual -- every site in it is on the same swept haplotype, so its own
  // background is the sweep -- and the upper frame cannot say what the sweep did
  // to linkage, because an LD triangle over 40 Mb is not computable and would
  // not be legible if it were.
  //
  // THE NARROW END IS SOLVED FOR: the lower frame is chr2:134.0-137.15 Mb of the
  // upper one's 116-156, i.e. 0.450-0.529 of its DATA AREA, which is not its
  // image width -- the app's own margins take the difference. L = 12.4,
  // W = 2976.0 over 3000 px is the layout three figures have now each solved for
  // independently (popgen/in2lt_inversion off region dividers,
  // dog10k-size-fst-scan off the same, qc/smn_block_and_reads off two highlight
  // bands), so it is the app's rather than one capture's.
  {
    mode: 'compose',
    name: 'ld/lct_sweep_two_scales',
    parts: ['ld/lct_fst_scan', 'ld/lct_pooled_vs_panel'],
    gutter: 120,
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
        // 340 AND UNSQUASHED. This is the panel with the block in it, so it is
        // the one whose depth is bought rather than chosen: 2La's apex is 327 px
        // down at this window and width, and a lane shorter than that cuts the
        // block flat at its own boundary, which reads as a block continuing past
        // the frame. agLdTrack's comment carries the arithmetic and what a
        // squashed capture of this panel actually looked like.
        agLdTrack(
          'ag1000g_2l_cmgam',
          'Cameroon, both arrangements segregating (r²)',
          'ag1000g_2L_CMgam.ld.gz',
          340,
          false,
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
        agKaryotypeTrack('CMgam', 'Cameroon, one row per mosquito', 200, true),
        // "almost every mosquito", not "fixed": 5 of the 69 are heterozygous
        // for the inverted arrangement, and they are visible two lanes down
        // 250, AND THE ASYMMETRY IS THE HONEST SAVING (review: "we need to
        // improve y-axis real estate here"). Neither panel is squashed, so both
        // draw at the SAME px-per-bp-of-separation; a shorter lane therefore
        // shows less separation at an identical scale rather than a distorted
        // version of the same thing. This population has no deep signal to show
        // -- its r² is a small shallow triangle at the telomeric end and faint
        // speckle under it -- so the 90 px comes off a region that is white in
        // both readings. The panel above cannot give the same 90 px up, because
        // there the deep half is where the block's apex is.
        //
        // What makes the difference in height safe to publish is that the
        // callout on this panel already accounts for the emptiness: "so this
        // span recombines freely" is a statement about the blank, so a reader has
        // no reason to read the shorter lane as a cropped one.
        agLdTrack(
          'ag1000g_2l_gagam',
          'Gabon, one arrangement in almost every mosquito (r²)',
          'ag1000g_2L_GAgam.ld.gz',
          250,
          false,
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
        // No legend on this one, and 170 rather than 200 because the legend was
        // what held it there: the key above it is the same key, and Gabon has no
        // inverted homozygote so its own would be that key minus a row. 170
        // keeps the five heterozygotes' band at 12 px, above the 11 px that was
        // rejected as close to invisible for the one thing in the lane a reader
        // has to be able to find.
        agKaryotypeTrack('GAgam', 'Gabon, one row per mosquito', 170, false),
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
    // a 340 and a 250 px LD panel + a 200 and a 170 px karyotype lane + 4
    // headers + ruler/overview. Undersize this and the rows past the fold are
    // cropped away silently: first paint still fires, so the capture succeeds
    // with the informative rows missing.
    //
    // 1485 -> 1385, 90 px of it the Gabon LD panel and 30 the Gabon karyotype
    // lane losing the legend that was holding it at 200. The run reports nothing
    // blank below the content at 1385, so this is the content's own height.
    //
    // The five Gabon heterozygotes' band -- which one of the callouts points at
    // by name -- sits against the app frame's lower border, and that is not a
    // crop: `groupBy: 'karyotype'` orders in dosage order, so those rows are the
    // last rows the lane has, and at 170 px the band measures the 12 px its
    // 5-of-69 share comes to. Checked on the capture rather than assumed, because
    // it looks like a clip.
    //
    // The other 200 px are NOT available, and the two ways they looked available
    // are both spent: squashing both panels to 240 (rendered -- see agLdTrack)
    // and narrowing the capture. The second is arithmetic rather than a
    // rendering: depth is half the drawn width, so a 1250 px capture would put
    // 2La's apex at 272 and buy ~50 px a panel -- and it walks both floating
    // legends into things. At 1250 the Cameroon karyotype legend clears its own
    // colour bands by 27 px where it now clears them by 55, and each LD panel's
    // r² ramp, which the callout beside it currently misses by 3 px, would be
    // under that callout. Worth doing only together with re-anchoring both
    // callouts, which is a bigger change than the 100 px it returns.
    viewportHeight: 1385,
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
        text: 'Nearly every mosquito here carries the same\nversion, so this span recombines freely.\nThe few that do not are the blue band below.',
        fontSize: 16,
        maxWidth: 430,
      },
      // POINT AT THE BAND, because it is the one thing in this figure that
      // looks like a defect (review: "are you happy with this figure?").
      //
      // Gabon's five heterozygotes are the last five of its 69 rows -- the lane
      // is grouped in dosage order -- so their band is the lane's own bottom
      // edge, 12 px of blue lying against the app frame's border. It is not
      // cropped and it reads as cropped, which is worse than cropped: a reader
      // who takes it for a clip discounts the sentence above it, and that
      // sentence is the whole reason the Gabon panel is white.
      //
      // An arrow is what settles it. A mark aimed at something is a statement
      // that the something is there in full, and it does the parenthetical's
      // job in the callout above better than the parenthetical did -- so the
      // sentence gets its own line back and stops describing a position.
      //
      // The head goes to fracY 0.94 rather than 1: the band's centre. At 170 px
      // and 5 of 69 rows it spans roughly 0.88-1.0, and a head ON the border
      // would restate the ambiguity it is there to remove.
      {
        type: 'arrow',
        fromAnchor: {
          track: 'ag1000g_2l_gagam',
          locus: TWO_LA_LOCUS,
          fracY: 0,
          dy: 96,
        },
        anchor: {
          track: 'ag1000g_2la_karyotype_gagam',
          locus: TWO_LA_LOCUS,
          fracY: 0.94,
        },
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
  // rs4988235, and the cluster it finds is the one whose stripe is CEU and FIN.
  //
  // rs4988235 itself is MAF 0.30 across these samples and so sits below the 0.35
  // filter — it is not one of the columns drawn. The ClinVar tick above the
  // matrix is therefore an independent marker of where the causal variant is,
  // not a column the clustering was steered by.
  //
  // 150 SAMPLES, NOT 2504, from scripts/build_lct_haploblock.sh: six
  // populations at 25 each, chosen to span the range of rs4988235-A frequency
  // rather than to sample it evenly. The full release is 5008 haplotype rows,
  // which is 0.18 px a row in this lane and averages to a flat wash; 300 rows
  // is 2.7 px. That script prints the arithmetic and the per-population
  // frequencies rather than asserting them, and re-prints them against the
  // subsample so the sampling error is visible.
  {
    mode: 'url',
    name: 'ld/lct_haploblock',
    url: `${HG38_HUB}&session=${encodeSessionSpec({
      sessionTracks: [
        // The statistic, over the haplotypes it is computed from. 260, down
        // from 360 and from the standalone figure's 510 (review: "reducing
        // height of the lddisplay (not squash, but just cutting off some)").
        // Cutting rather than squashing is what was asked for and it is also
        // the right instrument here: the block draws 685 px wide over this
        // window, so its apex is 343 px down, and 260 cuts the apex while
        // leaving both EDGES -- which is what the figure reads the triangle
        // for, since an edge is where the block stops and the matrix below has
        // to stop at the same coordinate. Squashing would keep the apex and
        // shrink the edges' slope instead, i.e. blur the one thing being
        // compared across the two lanes.
        lctTrack('LCT lactase-persistence LD, 1000G European panel (r²)', 260),
        {
          type: 'VariantTrack',
          trackId: 'kgp_lct_haplotypes',
          name: '1000 Genomes haplotypes across LCT (one row per haplotype)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'VcfTabixAdapter',
            uri: `${AG_POPGEN}/lct_1kg38_chr2_6pop.vcf.gz`,
            // sample id -> population. It is hosted under genomes/hg19/ only
            // because that is where it was first needed; the table is a sample
            // attribute list and carries no coordinates, so the assembly it
            // sits beside is irrelevant.
            samplesTsvLocation: {
              uri: 'https://jbrowse.org/genomes/hg19/1000g.sorted.csv.gz',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          // 2.5 Mb: the block (135.0-136.25, from build_lct_ld.sh's r² profile)
          // plus enough flank on both sides that the slab has somewhere to
          // stop, AND that the triangle stacked over it has two visible edges.
          // Cut to the block itself the triangle fills the frame corner to
          // corner — the exact failure the tutorial warns about one section up.
          // Matrix mode gives every variant an equal-width column regardless of
          // how the variants bunch genomically, so the cost of a wider frame is
          // columns rather than legibility, and the slab is a horizontal band
          // either way.
          loc: 'chr2:134,400,000-136,900,000',
          highlight: LCT_HIGHLIGHT,
          tracks: [
            {
              trackId: 'hg38-ncbiRefSeqCurated',
              type: 'LinearBasicDisplay',
              height: 60,
              showOnlyGenes: true,
            },
            // The causal variant marked independently of the rows it lands on.
            // The filter is an exact phenotypeList match, and it survives the
            // move to hg38: the hg38 ClinVar table carries the same
            // 'LACTASE PERSISTENCE' string, on rs4988235 itself among others.
            {
              trackId: 'hg38-clinvarMain',
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
              // 520, down from 700 (review: "reducing height of the
              // multisamplevariantdisplay"). 300 haplotype rows is 1.73 px a
              // row, and what the lane is read for survives that: the readout
              // is a HORIZONTAL texture -- one band decided the same way
              // straight across the block against speckle everywhere else --
              // and the cluster is ~124 of those rows, so it is still a 215 px
              // slab. Per-row resolution would matter if a reader had to follow
              // one haplotype, which is what the dendrogram gutter cannot
              // support at any height this figure can afford anyway.
              height: 520,
              // The matrix reads every genotype in the window rather than
              // sampling, and the 30x callset carries several times the
              // variants the phase 3 cut did over this span, so the byte gate
              // trips: without this the lane is a "Requested too much data ...
              // FORCE LOAD" banner and the clustering never runs, which is what
              // failed the first capture of this figure.
              forceLoad: true,
              lineZoneHeight: 34,
              // one row per haplotype rather than per sample. Phased is the
              // point: a haplotype is what travels as one piece, and a diploid
              // row would average a carrier chromosome with a non-carrier one.
              renderingMode: 'phased',
              runClustering: true,
              // The block itself, as build_lct_ld.sh's r² profile resolves it,
              // and narrower than what is drawn — the dog10k-igf1-haplotype
              // pattern. Clustering over the whole drawn window instead mixes
              // in a megabase of unlinked sequence on each side, which is
              // exactly the variation that does NOT travel with the haplotype.
              clusterRegion: 'chr2:135,000,000-136,150,000',
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
    // The samples table is the whole 1000 Genomes release and the VCF is the
    // six-population subsample, so the app warns that it dropped the samples it
    // has no rows for, correctly and every time. The toast lands over the
    // matrix, and its own dismissal is volatile state a session spec cannot
    // arrive in.
    hideSelectors: ['.MuiSnackbar-root'],
    // gene(60) + clinvar(70) + the 260px LD band + the 520px matrix, their
    // headers and the ruler. Sized from the run's own clipped/blank report.
    // 1518 -> 1238: 100 px off the LD band and 180 off the matrix, both argued
    // where they are set.
    viewportHeight: 1238,
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
    // clustered haplotype' is too vague ... i need more detail"). The one they
    // carry comes from the file: at rs4988235 (chr2:135,851,076 on hg38) the
    // slice is 90 alt of 300 haplotype rows -- 150 samples, 90 carrying the
    // persistence allele -- checkable with
    // `bcftools query -r chr2:135851076 -f '[%GT\n]'` on the hosted VCF. Same
    // 150 samples the hg19 cut used, so that count did not move. 90/300 is MAF
    // 0.30, BELOW this figure's own 0.35 filter, so the causal variant is not
    // one of the drawn columns and the clustering never sees it.
    //
    // WHAT THE PILL MUST NOT SAY, and did on hg19: that the slab IS those 90.
    // On this callset it is not. Measured two ways and they agree.
    //
    // Off the capture: one contiguous cluster of ~124 of 300 rows is decided the
    // same way across a 249-column run, and NONE of the other 176 rows matches
    // it there -- a clean separation, just a wider cluster than the carrier set.
    //
    // Off the VCF, over the clustering window at the same MAF floor (230
    // columns): carrier haplotypes agree with the carrier consensus at 0.963
    // mean against 0.301 for non-carriers, so the sweep signal is very strong.
    // But the agreement tail is gradual rather than a cliff -- >=0.90 takes 90
    // haplotypes of which 82 are carriers, >=0.60 takes 123 of which 89 are.
    // So the cluster holds essentially every carrier PLUS a few dozen
    // chromosomes carrying most of the same background, which is what a young
    // haplotype at 30% frequency should look like. Say that; don't restore the
    // arithmetic coincidence.
    //
    // CLUSTER, NOT CLADE, in the pill and in this file (review: "please be
    // careful about using the term 'clade' to refer to humans"). These rows are
    // the output of hierarchical clustering over one window, which is what the
    // pill can name; a clade says descent, and the dendrogram beside it fits no
    // evolutionary model and computes no support, so it does not establish one.
    // user_guides/clustering.md carries the same caution about the tree.
    //
    // TWO PILLS, AND EVERY MARK POINTS AT SOMETHING (review: "there are too
    // many red text annotations, unclear what they are pointing at. might need
    // red arrow from the 'unbroken across block' and ideally the red text is
    // not overlapping the sample labels on left").
    //
    // The three that were here were stacked down the matrix lane at chr2
    // 134,470,000, which is x 42 css px -- inside the dendrogram-and-population
    // gutter, so all three sat on the sidebar they were meant to be beside. The
    // gutter measures 107 css px on this capture (the sidebar's right edge
    // against a 1490 px data area over 2.5 Mb, so 1678 bp/px), and the pill now
    // starts at 134,650,000, which is 149.
    //
    // The third pill is folded into the second as its second line. "Everything
    // else: no shared block" was a whole pill for the half of the finding that
    // the OTHER arrow now makes: two heads out of one pill, one into the cluster
    // and one into the mosaic below it, is the same statement with one box
    // instead of two and with both ends of it identified.
    //
    // BIGGER AND SHORTER (earlier review: "make red text box annotation text
    // larger and less wordy"): 17 -> 22 px, and the counts are gone. The count
    // they carried was hard-won and it belongs in the caption rather than here
    // -- it is exactly the "specific value a reader cannot check against the
    // picture" that website/CLAUDE.md rules out of a callout. The measurement
    // itself stays in the paragraph below.
    //
    // THE STRIPE PILL MOVED TO THE ClinVar LANE, which is the one band in this
    // figure that is genuinely empty: its jexl filter leaves two marks, both at
    // the stripe. So the label sits on the lane directly above the stripe,
    // right-aligned to end short of it, with an arrow across the gap. In the
    // matrix lane it had nowhere to go that was not either the sidebar or the
    // data.
    //
    // It answers "why only [a] small region highlighted? what is the scientific
    // story there?": the stripe is LCT/MCM6, 89 kb, the locus selection acted
    // on, and the block it dragged along is the whole width of the triangle
    // above. Naming the stripe is all the pill has to do -- the ratio is then
    // visible, and stating it would be stating the obvious. The highlight
    // itself carries no label because a highlight writes one at its top-left,
    // which here lands on the LCT gene's own label in the lane above.
    //
    // ARROW HEADS ARE GENOMIC, the matrix's columns are not (matrix mode gives
    // every variant equal width), so the heads are placed to land inside the
    // drawn block rather than at a variant. fracY 0.30 and 0.78 are the cluster's
    // and the mosaic's centres, measured off the capture -- the cluster occupies
    // the top ~0.08-0.52 of the lane and the mosaic the rest.
    //
    // 135,900,000 -> 135,760,000 (review: "the arrows might be slightly
    // pointing to the wrong place, too far to right, off"). Measured off the
    // capture against the highlight, whose edges are known: the cluster's
    // unbroken slab runs about 135.73-135.97 Mb, so 135,900,000 was inside it
    // but within a head's length of its right edge, and an arrowhead is drawn
    // short of its anchor -- so both heads landed on the edge where the slab
    // stops rather than in it. 135,760,000 is left of the LCT/MCM6 stripe, in
    // the part of the slab no highlight tints.
    //
    // Both heads share that x on purpose. The claim is about ROWS -- these rows
    // hold the block, those rows do not -- so two heads in one column of the
    // matrix say it and two heads at different columns would not.
    annotations: [
      {
        type: 'text',
        text: 'LCT/MCM6: the locus the sweep acted on',
        fontSize: 22,
        // one line. At 420 it wrapped, and a right-aligned pill wraps its LAST
        // word onto a line of its own against the arrow it points with.
        maxWidth: 500,
        textAlign: 'end',
        anchor: {
          track: 'hg38-clinvarMain',
          locus: 'chr2:135,690,000',
          fracY: 0.5,
          alignX: 'left',
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          track: 'hg38-clinvarMain',
          locus: 'chr2:135,700,000',
          fracY: 0.5,
          alignX: 'left',
        },
        anchor: {
          track: 'hg38-clinvarMain',
          locus: 'chr2:135,787,850',
          fracY: 0.5,
          alignX: 'left',
        },
      },
      {
        type: 'text',
        text: 'One cluster, unbroken across the block.\nEvery other row: mosaic.',
        fontSize: 22,
        maxWidth: 340,
        anchor: {
          track: 'kgp_lct_haplotypes',
          locus: 'chr2:134,650,000',
          fracY: 0.52,
          alignX: 'left',
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          track: 'kgp_lct_haplotypes',
          locus: 'chr2:135,290,000',
          fracY: 0.46,
          alignX: 'left',
        },
        anchor: {
          track: 'kgp_lct_haplotypes',
          locus: 'chr2:135,760,000',
          fracY: 0.3,
          alignX: 'left',
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          track: 'kgp_lct_haplotypes',
          locus: 'chr2:135,290,000',
          fracY: 0.58,
          alignX: 'left',
        },
        anchor: {
          track: 'kgp_lct_haplotypes',
          locus: 'chr2:135,760,000',
          fracY: 0.78,
          alignX: 'left',
        },
      },
    ],
  },
]
