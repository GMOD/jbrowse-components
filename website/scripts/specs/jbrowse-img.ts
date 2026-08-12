// The jbrowse-img (jb2export) figures: the example images products/jbrowse-img
// README publishes, each one the literal argv of the command the README prints
// beside it. They render through React SSR straight to PNG with no browser
// involved, so they are the one spec family that bypasses the puppeteer
// pipeline entirely (see CliSpec in screenshot-spec-types.ts).
//
// A spec module rather than a section of screenshot-spec-helpers.ts, which is
// where these lived. Two things follow from the move, and the second is the
// reason for it:
//
// - `sync-img-readme.ts` walks `jbrowseImgSpecs` to regenerate every command
//   fence in the README, so that export keeps its `CliSpec[]` type and holds
//   only commands. The one composed figure is a second export.
// - `--affected` attributes a spec to the specs/*.ts that exports it
//   (screenshot-impact.ts, `specFileOwners`). In the helpers barrel these had no
//   owner and matched the `website/scripts/screenshot-` global trigger instead,
//   so editing one jb2export command re-rendered the whole corpus.

import {
  HG002_NANOPORE_BAM,
  HG00151_ONT_1000G_BAM,
} from '../screenshot-spec-helpers.ts'

import type { CliSpec, ScreenshotSpec } from '../screenshot-spec-types.ts'

// S3-hosted yeast comparison (S. cerevisiae R64 vs the YJM1447 strain), used by
// the dotplot/synteny CliSpecs below.
export const YEAST =
  'https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447'

export function cliSpec(name: string, args: string[]): CliSpec {
  return { mode: 'cli', name: `jbrowse-img/${name}`, args }
}

// One panel of jbrowse-img/sv_review_pair: the same three der(3) loci and the
// same render settings, with one sample's track. See the note on the two specs
// that use it for why each modifier is there.
function svReviewHalf(trackId: string) {
  return [
    'breakpoint',
    '--config',
    'https://jbrowse.org/demos/cancer_sv/config.json',
    '--assembly',
    'hg38',
    '--track',
    trackId,
    'height:130',
    'force:true',
    'featureHeight:super-compact',
    '--loc',
    'chr3:25,358,511-25,359,711',
    '--loc',
    'chr10:58,716,962-58,718,162',
    '--loc',
    'chr12:72,272,512-72,273,712',
    '--width',
    '1000',
  ]
}

export const jbrowseImgSpecs: CliSpec[] = [
  // Headline (README "## Screenshot"): a multi-track human view from public
  // files — NCBI RefSeq genes, ClinGen gene-disease, phyloP conservation,
  // SKBR3 nanopore. --aliases reconciles the 1 / chr1 / NC_000001.10 refname
  // styles across files.
  cliSpec('1', [
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--aliases',
    'https://jbrowse.org/genomes/hg19/hg19_aliases.txt',
    '--gffgz',
    'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz',
    // reduced-representation gene view (drop mRNA/exon/CDS speckle, keep gene
    // glyphs) so the RefSeq track reads cleanly at this multi-gene zoom
    '{"showOnlyGenes":true}',
    '--bigbed',
    'https://jbrowse.org/genomes/hg19/clinGen/clinGenGeneDisease.bb',
    '--bigwig',
    'https://hgdownload.soe.ucsc.edu/goldenpath/hg19/phyloP100way/hg19.100way.phyloP100way.bw',
    '--cram',
    'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.cram',
    '--loc',
    '1:19,190,000-19,240,000',
    '--width',
    '1200',
  ]),

  // Whole-genome dotplot: every YJM1447 contig (x) vs every R64 contig (y).
  // --autoDiagonalize reorders the R64 contigs so the main alignment forms a
  // clean diagonal instead of a staircase.
  cliSpec('yeast_dotplot', [
    'dotplot',
    '--fasta',
    `${YEAST}/yjm1447.fa`,
    '--fasta2',
    `${YEAST}/r64.fa`,
    '--paf',
    `${YEAST}/r64_vs_yjm1447.paf`,
    '--autoDiagonalize',
    '--width',
    '1100',
  ]),

  // Single-chromosome synteny ribbon: YJM1447 chr I vs R64 chr I
  // (NC_001133.9). --drawCurves renders the ribbon as a smooth bezier instead
  // of straight trapezoids.
  cliSpec('yeast_synteny', [
    'synteny',
    '--fasta',
    `${YEAST}/yjm1447.fa`,
    '--loc',
    'I',
    '--fasta2',
    `${YEAST}/r64.fa`,
    '--loc2',
    'NC_001133.9',
    '--paf',
    `${YEAST}/r64_vs_yjm1447.paf`,
    '--drawCurves',
    '--width',
    '1400',
  ]),

  // Whole-genome multi-chromosome synteny straight from the CLI (assemblies
  // stack in argv order, the PAF binds to the gap between them). autoDiagonalize
  // reorders grape chromosomes for least overlap; colorBy query tints ribbons by
  // peach chromosome.
  cliSpec('grape_peach_synteny', [
    'synteny',
    '--chromSizes',
    'data/comparative/peach.chrom.sizes',
    '--paf',
    'https://s3.amazonaws.com/jbrowse.org/genomes/synteny/peach_grape.paf.gz',
    '--chromSizes',
    'data/comparative/grape.chrom.sizes',
    '--autoDiagonalize',
    '--colorBy',
    'query',
    '--alpha',
    '0.4',
    '--levelHeights',
    '350',
    '--drawCurves',
    '--width',
    '1400',
  ]),

  // Mammalian-scale: human (hs1) vs mouse (mm39). --minAlignmentLength 500000
  // drops short alignments so the large syntenic blocks stay legible.
  cliSpec('hs1_mm39_synteny', [
    'synteny',
    '--chromSizes',
    'data/comparative/hs1.chrom.sizes',
    '--chain',
    'https://jbrowse.org/demos/hs1ToMm39/hs1ToMm39.over.chain.gz',
    '--chromSizes',
    'data/comparative/mm39.chrom.sizes',
    '--minAlignmentLength',
    '500000',
    '--autoDiagonalize',
    '--colorBy',
    'query',
    '--alpha',
    '0.4',
    '--levelHeights',
    '350',
    '--drawCurves',
    '--cigarMode',
    'matches',
    '--width',
    '1400',
  ]),

  // Three-level stack: hg38 / hs1 / mm39 (one ribbon per adjacent pair — a UCSC
  // liftOver chain between each, each placed between the two assemblies it
  // relates).
  cliSpec('hg38_hs1_mm39_synteny', [
    'synteny',
    '--chromSizes',
    'data/comparative/hg38.chrom.sizes',
    '--chain',
    'data/comparative/hg38ToHs1.over.chain.gz',
    '--chromSizes',
    'data/comparative/hs1.chrom.sizes',
    '--chain',
    'https://jbrowse.org/demos/hs1ToMm39/hs1ToMm39.over.chain.gz',
    '--chromSizes',
    'data/comparative/mm39.chrom.sizes',
    '--minAlignmentLength',
    '500000',
    '--autoDiagonalize',
    '--colorBy',
    'query',
    '--alpha',
    '0.4',
    '--levelHeights',
    '300,300',
    '--drawCurves',
    '--cigarMode',
    'matches',
    '--width',
    '1400',
  ]),

  // Circular structural-variant chord plot: SKBR3 (breast-cancer cell line,
  // hg19) long-read Sniffles SV calls, where each inter-chromosomal chord is a
  // translocation — the classic dense rearranged-cancer-genome view. (The cgiab
  // HG008 somatic benchmark the reviewer pointed at draws an empty ring: its
  // PASS calls are intra-chromosomal DEL/DUP/CNV with no BND translocations, so
  // no chords.) --fasta only reads the .fai for chrom names/lengths; the circular
  // view fetches no sequence.
  cliSpec('circular_chords', [
    'circular',
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--vcfgz',
    'https://jbrowse.org/genomes/hg19/SKBR3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.filtered.vcf.gz',
    '--width',
    '800',
  ]),

  // Gene/feature track over the reference sequence: hosted hg38 NCBI RefSeq
  // (--hub, --track) with --refseq adding the DNA-base + six-frame-translation
  // sequence track below it. Zoomed to a TP53 intron/CDS boundary (not mid-exon)
  // at base level, so the gene track shows readable structure — the intron thins
  // to a line, the CDS exon begins as a solid block, and that block edge lines up
  // with a specific reference base and the translation frame (docs "Gene tracks
  // and the reference sequence"). showOnlyGenes keeps the RefSeq rows to gene
  // features; geneGlyphMode:longestCoding collapses TP53's isoform thicket to
  // its single longest coding transcript, so one clean structure reads instead
  // of a stack of near-identical rows. Supersedes the old standalone `sequence`
  // refseq spec.
  cliSpec('gene_track', [
    '--hub',
    'hg38',
    '--track',
    'hg38-ncbiRefSeqCurated',
    'height:60',
    '{"showOnlyGenes":true,"geneGlyphMode":"longestCoding"}',
    '--refseq',
    '--loc',
    'chr17:7,675,018-7,675,098',
    '--width',
    '1500',
  ]),

  // Hi-C contact matrix: the public hg19 demo .hic streamed from S3. The
  // triangular heatmap shows TAD structure along chr1.
  cliSpec('hic', [
    '--hub',
    'hg19',
    '--track',
    'hg19-ncbiRefSeqCurated',
    '--hic',
    'https://jbrowse.org/genomes/hg19/intra_nofrag_30.hic',
    'height:400',
    '--loc',
    '1:2,500,000-12,500,000',
    '--width',
    '1200',
  ]),

  // Dark theme, human demo (reviewer ask): hg38 PTEN locus via --hub — a clean
  // single-canonical-transcript gene (unlike TP53's isoform thicket) — a tall
  // NCBI RefSeq gene track over phyloP conservation, rendered with darkStock.
  cliSpec('dark_theme', [
    '--hub',
    'hg38',
    '--track',
    'hg38-ncbiRefSeqCurated',
    'height:100',
    '--track',
    'hg38-phyloP100way',
    'height:140',
    '--loc',
    'chr10:87,860,000-87,975,000',
    '--themeName',
    'darkStock',
    '--width',
    '1200',
  ]),

  // Plain alignments pileup (bundled volvox BAM).
  cliSpec('alignments_pileup', [
    '--fasta',
    'data/volvox/volvox.fa',
    '--bam',
    'data/volvox/volvox-sorted.bam',
    '--loc',
    'ctgA:1-20000',
    '--width',
    '1200',
  ]),

  // sort:base — HG008-T PacBio HiFi reads over CUZD1 sorted by the base at the
  // center position, so every read carrying the ~1.8 kb somatic deletion
  // (chr10:122,835,345-122,837,143) pulls into one contiguous band. The window
  // is centered on the deletion midpoint so the sort pivot lands inside it (a
  // pivot outside the deletion doesn't group the deletion reads). The legacy
  // `alignments_readgroup` filename is kept for the doc image URL.
  cliSpec('alignments_readgroup', [
    '--hub',
    'hg38',
    '--track',
    'hg38-ncbiRefSeqCurated',
    'height:55',
    '--bam',
    'https://jbrowse.org/demos/cgiab/HG008-T_chr10_CUZD1_deletion.bam',
    'sort:base',
    'height:420',
    '--loc',
    'chr10:122,831,700-122,840,800',
    '--width',
    '1200',
  ]),

  // group:tag:HP splits the pileup into one sub-track per haplotype. HG002
  // ultralong ONT (hg19), the same rehosted slice HG002_NANOPORE_BAM names; the
  // het deletion sits in one haplotype only.
  cliSpec('alignments_haplotype', [
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--bam',
    HG002_NANOPORE_BAM,
    'group:tag:HP',
    'color:tag:HP',
    'height:400',
    '--loc',
    '1:63,005,675-63,007,432',
    '--width',
    '1200',
  ]),

  // color:methylation paints per-base CpG calls from a modified-base CRAM.
  // COLO829 nanopore (hg38) over the chr20:18.50-18.51Mb CpG islands (the same
  // islands the modifications/gallery figures use — a region with real
  // methylation signal, not the prior featureless window). The UCSC CpG-island
  // BED on top (reviewer ask) marks the island boundaries, so the methylated
  // (red) flanks vs the unmethylated (blue) island cores read against the
  // annotation. --aliases reconciles the chr20/20 refname styles for both the
  // CRAM and the chr-named CpG BED.
  cliSpec('methylation', [
    '--fasta',
    'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
    '--aliases',
    'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    // UCSC CpG islands (BedTabix, .csi index); argv order puts it above the
    // methylation CRAM below.
    '--bedgz',
    'https://jbrowse.org/ucsc/hg38/cpgIslandExt.bed.gz',
    'index:https://jbrowse.org/ucsc/hg38/cpgIslandExt.bed.gz.csi',
    // Sliced to chr20:18,495,000-18,517,000 and re-hosted off ont-open-data.
    // BAM rather than CRAM because the source CRAM's UR points at the
    // producer's own filesystem, so decoding it needs an M5 reference lookup
    // that a viewer should not have to make; the --cram path is still covered
    // by the skbr3 spec above. The comment on cancer_sv's tumour track records
    // that streaming this CRAM "failed all four sweeps of figures.yml
    // deterministically" at a 120s timeout -- 3.4 MB does not.
    '--bam',
    'https://jbrowse.org/demos/ont/COLO829_tumor.ht.chr20_18.5Mb.bam',
    'color:methylation',
    // The key for that coloring. It is off by default in the app because the
    // reader can open the track menu, which is the one thing nobody looking at
    // a PNG can do -- so red and blue were two unexplained colors and the
    // caption had to carry them.
    'legend',
    'height:350',
    '--loc',
    'chr20:18,503,000-18,509,000',
    '--width',
    '1200',
  ]),

  // Variant track (bundled volvox VCF).
  cliSpec('variants', [
    '--fasta',
    'data/volvox/volvox.fa',
    '--vcfgz',
    'data/volvox/volvox.filtered.vcf.gz',
    '--loc',
    'ctgA:1-20000',
    '--width',
    '1200',
  ]),

  // Multi-sample variant genotype matrix: display:multivariant selects the
  // LinearMultiSampleVariantDisplay. Each column is a variant, each row a
  // sample; alt genotypes paint over the reference background. This draws the
  // real 1000 Genomes phase-3 chr11 callset (2,504 samples) over the HBB
  // β-globin locus, with the hosted NCBI RefSeq gene track (via --hub/--track)
  // for context — common variants read as solid vertical bands, rarer ones as
  // sparse speckle. Matches the README command exactly.
  //
  // (The old volvox stand-in and its "SSR renders the matrix empty for real
  // data" note are gone: the SSR path paints real 1000 Genomes genotypes fine —
  // verified by rendering both display:multivariant and display:multivariantmatrix
  // against the phase-3 chr11 VCF.)
  cliSpec('multisample_variants', [
    '--hub',
    'hg19',
    '--track',
    'hg19-ncbiRefSeqCurated',
    '--vcfgz',
    'https://jbrowse.org/genomes/hg19/1000genomes/ALL.chr11.phase3_v5b.HBB_5.2-5.3Mb.vcf.gz',
    'display:multivariant',
    'height:450',
    'force:true',
    '--loc',
    'chr11:5,246,000-5,251,000',
    '--width',
    '1200',
  ]),

  // Sashimi: sashimi:auto overlays splice-junction arcs on the coverage band,
  // sized by junction read depth. Public strand-specific paired-end RNA-seq
  // (hg19) over B2M via --hub — the long first intron reads as one big arc, the
  // downstream exon junctions as smaller arcs. coverageHeight makes the
  // coverage/sashimi band tall enough for the arcs to be legible;
  // featureHeight:super-compact packs the supporting reads into a thin band
  // below so the exon-by-exon read coverage that feeds the junctions is visible
  // without the pileup dominating the frame.
  cliSpec('sashimi_junctions', [
    '--hub',
    'hg19',
    '--track',
    'hg19-ncbiRefSeqCurated',
    'height:90',
    '--bam',
    'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/paired_end_rnaseq/Pairend_StrandSpecific_51mer_Human_hg19.bam',
    'sashimi:auto',
    'coverageHeight:170',
    // LOG, because junction depth here spans three orders of magnitude: the
    // last exon peaks near 4000 and the first two sit in the low hundreds, so a
    // linear axis drew them as a flat line and the band was one spike with the
    // arcs floating over nothing (reviewer). Log puts every exon on the plot,
    // which is what the arcs are meant to be read against.
    'scaletype:log',
    'featureHeight:super-compact',
    'height:420',
    '--loc',
    'B2M',
    '--width',
    '1400',
  ]),

  // SV read-connection arcs: arcs:down links the split-read breakpoints of a
  // structural variant in a band below the coverage (the current default arc
  // direction). HG00151 ONT long reads (1000G-ONT S3, the MINIMAP2_ALIGNED_BAMS
  // file that keeps the SA-tag split alignments) over a ~1.2 kb chr1 inversion —
  // the two breakpoints show as clipped-read columns with the connecting arcs
  // between them. (No color:pairOrientation: that's a paired-end concept,
  // meaningless on long reads; the arcs are the SV signal.)
  cliSpec('sv_read_arcs', [
    '--hub',
    'hg38',
    '--bam',
    HG00151_ONT_1000G_BAM,
    'arcs:down',
    // Chain each long read's split segments (as the inversion_long_read figure
    // does), so the reverse-strand core paints blue between the red forward
    // flanks — the inversion is legible in the pileup itself, not only in the
    // arcs.
    'linkedReads:normal',
    // Split the pileup on SA-tag presence, as inversion_long_read does
    // (reviewer): the reads that cross the two breakpoints get their own
    // labelled section under the arcs, and the flat background pileup goes
    // below it, so the section divider says which reads carry the SV rather
    // than leaving the reader to pick the colored ones out of a single stack.
    'group:splitRead',
    'coverageHeight:80',
    // grouping stacks two coverage lanes and truncates the "Not split" lane at
    // a row boundary, so the whole SV signal fits well under the 820 the
    // ungrouped stack needed — at 820 the bottom third was empty
    'height:560',
    '--loc',
    'chr1:197,786,900-197,789,700',
    '--width',
    '1400',
  ]),

  // MultiWiggle: --multiwig aggregates many BigWigs into one multi-row
  // quantitative track. The sources JSON (data/scatac_catlas.json, 16 curated
  // subadapters carrying per-row name/color/group) is the CATlas single-cell
  // ATAC accessibility-by-cell-type data (Zhang et al 2021), rendered over GCG
  // (glucagon) via --hub hg38 + the RefSeq gene track. Alpha (glucagon) cells —
  // the pancreatic cell type that expresses GCG — show strong accessibility
  // across the locus while the other 15 cell types stay quiet on the shared
  // autoscale: cell-type-specific chromatin accessibility at a marker gene.
  cliSpec('scatac_multiwiggle', [
    '--hub',
    'hg38',
    '--track',
    'hg38-ncbiRefSeqCurated',
    'height:60',
    '--multiwig',
    'data/scatac_catlas.json',
    'name:CATlas single-cell ATAC (accessibility by cell type)',
    // ~27px per row across the 16 cell types — tighter rows than the old 520 so
    // the stack reads compactly (reviewer)
    'height:440',
    // zoomed out to a ~300 kb window around GCG (not the bare gene body) so the
    // alpha-cell peak reads as a localized, cell-type-specific spike against
    // otherwise-quiet flanking chromatin, rather than an isolated close-up whose
    // significance is impossible to judge
    '--loc',
    'chr2:162,000,000-162,300,000',
    '--width',
    '1400',
  ]),

  // The README's "Remote files" example: everything streamed by URL, with
  // --aliases reconciling the 1 / chr1 / NC_000001.10 refname styles across the
  // four sources. Same idea as the headline above, at a locus where the ClinVar
  // variants over the RefSeq genes are the point.
  cliSpec('remote_files', [
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--aliases',
    'https://jbrowse.org/genomes/hg19/hg19_aliases.txt',
    '--bigbed',
    'https://hgdownload.soe.ucsc.edu/gbdb/hg19/bbi/clinvar/clinvarMain.bb',
    '--gffgz',
    'https://jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz',
    '--bigwig',
    'https://jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.regions.bw',
    '--loc',
    '1:48,683,542-48,907,531',
    '--width',
    '1200',
  ]),

  // `--hub` + repeated `--track`: the whole assembly and its hosted trackIds
  // come from genomes.jbrowse.org, so the command names only what to show.
  // 20 kb rather than the 100 kb the README used to print: ClinVar's variant
  // density puts a 100 kb window over the track's own render limit, so half the
  // figure was the words "Region too large to render". `force:true` clears that
  // gate and was tried — it draws, but at 100 kb the variants are bare ticks,
  // where 20 kb labels each one with its base change. Narrowing says more.
  cliSpec('hub_tracks', [
    '--hub',
    'hg19',
    '--track',
    'hg19-ncbiRefSeqCurated',
    '--track',
    'hg19-clinvarMain',
    '--loc',
    'chr1:1,020,000-1,040,000',
    '--width',
    '1200',
  ]),

  // A gene name rather than a locstring: resolved through the hub's Trix index
  // (navToLocStringOrSearch), which is the only reason `--loc BRCA1` works.
  cliSpec('gene_name_search', [
    '--hub',
    'hg19',
    '--track',
    'ncbiRefSeqCurated',
    '--loc',
    'BRCA1',
    '--width',
    '1200',
  ]),

  // The three README examples that show how a config is supplied, each of which
  // renders something and so gets a figure rather than being read on faith.

  // `--config` + `--assembly` + `--loc`: the bundled volvox config, whose
  // adapters use localPath (resolved relative to the config file), so this also
  // demonstrates that a config full of local files needs no server. `--track`
  // is not optional here — a config supplies definitions, not an open track
  // list, so without it this renders a correct and completely empty ruler.
  cliSpec('volvox_config', [
    '--config',
    'data/volvox/config.json',
    '--assembly',
    'volvox',
    '--track',
    'volvox_sv',
    '--loc',
    'ctgA:1-50,000',
    '--width',
    '1200',
  ]),

  // `--session`: a saved session supplies the view and its tracks, `--config`
  // supplies the trackIds it names. data/skbr3/session.json is the `init` form,
  // so this is also the only figure covering that path end to end.
  cliSpec('skbr3_session', [
    '--config',
    'data/config.json',
    '--session',
    'data/skbr3/session.json',
    '--assembly',
    'hg19',
    '--width',
    '1400',
  ]),

  // `snpcov` collapses an alignments track to its coverage band alone — the
  // same data as `alignments_pileup` above with the pileup hidden, which is
  // what makes the pair worth showing together.
  cliSpec('snpcov', [
    '--fasta',
    'data/volvox/volvox.fa',
    '--bam',
    'data/volvox/volvox-sorted.bam',
    'snpcov',
    'height:200',
    '--loc',
    'ctgA:1-20000',
    '--width',
    '1200',
  ]),

  // SKBR3 cell-line whole-genome coverage (hg19, --loc all), log scale — the
  // cancer karyotype's amplifications/deletions stand out.
  cliSpec('skbr3_cov', [
    '--loc',
    'all',
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--bigwig',
    'https://jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.regions.bw',
    'scaletype:log',
    'fill:false',
    'resolution:superfine',
    'height:400',
    'color:purple',
    'minmax:1:1024',
    '--width',
    '1900',
  ]),

  // TUMOUR AND MATCHED NORMAL, SIDE BY SIDE, ONE RENDER EACH (review: "instead
  // of having normal integrated, should be side-by-side figure with the tumor
  // and the normal separate side by side panels ... not something jbrowse-img
  // has to do"). It was one render carrying both tracks on every panel, six
  // lanes stacked; the pair is now two renders and a `mode: 'compose'` with
  // `direction: 'horizontal'`, which is the figure pipeline's own job and needs
  // nothing of jb2export.
  //
  // The two specs are identical but for the track, deliberately: same loci, same
  // width, same track height, so the two halves are comparable line for line and
  // `+append` pads neither. The whole claim is that the left half is full of
  // connecting curves and the right half has none.
  //
  // THREE PANELS, AND THAT IS WHAT KILLED THE DOTTED LINES (review: "i dont
  // like the dotted lines, because that means 'incomplete story'. we need to fix
  // this, if needed with more multi-hop"). A dashed connector is exactly that,
  // and the plugin says so: `AlignmentConnections` sets `strokeDasharray` on a
  // pair whose `hiddenSegmentsBetween` is non-empty -- the read has a
  // supplementary alignment at a locus that is NOT in the view. Here that locus
  // is chr10. COLO829 chain 1 is a closed three-chromosome cycle
  // (agent-docs/reference/SV_MULTIHOP.md): chr3, then 199 bp of chr10 at
  // 58,717,463-58,717,662, then 183 bp of chr12 inverted, then chr3 again. With
  // only chr3 and chr12 on screen, every read that goes the long way round is
  // drawn dashed and correctly so. The third panel makes every connector solid.
  //
  // `featureHeight:super-compact` (review: "use supercompact"), which is 1 px
  // per read. What each half is read for is the presence or absence of a bundle
  // of curves, and at the default 7 px three pileups are most of a very tall
  // page.
  //
  // `force:true` is not a taste call: the chr3 panel is 1.2 kb of 200x ONT and
  // the byte gate refuses it, so it drew "Region too large to render". Which is
  // also how this file found out that breakpoint mode DROPPED its --track
  // modifiers -- `height:240` had never applied either. Fixed in
  // products/jbrowse-img/src/breakpointInit.ts.
  //
  // The assembly name is no longer printed once per panel (review: "we also do
  // not need assembly name on each level necessarily"). That is a change in
  // SVGBreakpointSplitView rather than a flag here: a breakpoint stack is
  // usually one assembly at several loci, so it names the first row and any row
  // whose assembly differs from the one above it.
  cliSpec('sv_review_tumor', svReviewHalf('COLO829_tumor_ont')),
  cliSpec('sv_review_normal', svReviewHalf('COLO829BL_normal_ont')),

  // THE THIRD PANEL: THE ALLELE ITSELF (review: "if there was a 'derived allele'
  // view of this, in order to show the linearized derived allele, it would be
  // interesting to show alongside it"). There is, and it is a plain view rather
  // than a breakpoint one, because the whole point of the reconstruction is that
  // the three loci stop needing separate panels: `der3_RARB_BICC1_TRHDE` is one
  // 39,549 bp contig, and the two panels beside this one are the first 32.7 kb
  // of chr3, 199 bp of chr10 and 183 bp of chr12 laid end to end on it, in that
  // order, with 6.4 kb of chr3 closing the cycle. `der3_segments` is what says
  // so -- each segment drawn with the locus it came from -- so it goes above the
  // reads rather than being left to the caption.
  //
  // Same `--config` and the same hosted files as the other two panels: the
  // derivative assembly is in that config beside hg38 (sv_multihop.py built it;
  // see the cancer_sv tutorial), so the third invocation differs only in which
  // assembly it names.
  //
  // No `force:true` and no `featureHeight`, unlike the two beside it: 39.5 kb of
  // a BAM holding 69 spanning reads is nowhere near the byte gate, and at the
  // default 7 px every read is a row a reader can follow across the junctions --
  // which is the claim. The two sample panels are 200x over 1.2 kb and need both
  // flags for the opposite reason.
  //
  // The heights are picked so `+append` pads nothing: 128 + 440 comes out 679,
  // the sample panels' height exactly. `der3_segments` needs ~120 of its 128 for
  // the four segment rows; the reads track is the one carrying the slack, and it
  // carries ~100 px of it, since 69 spanning reads pack shorter than the three
  // 200x pileups beside them at any read height worth reading. Check the
  // rendered height rather than adding to these numbers -- a track's box is not
  // its `height:` plus a constant (374 -> 440 moved the panel 619 -> 679).
  //
  // 440 rather than the 374 that matched before: each row of a breakpoint export
  // grew by its scalebar band when SVGRowHeader started drawing one (review:
  // "scale indicators and/or keeping each row on the same relative scale"), so
  // the sample panels are three bands taller and this one, an ordinary LGV
  // export that has always drawn its bar, is not. Matching them is what keeps
  // the three captions on one line -- each is anchored to the bottom of its own
  // part, so a short panel lifts its caption out of the row.
  cliSpec('sv_review_derivative', [
    '--config',
    'https://jbrowse.org/demos/cancer_sv/config.json',
    '--assembly',
    'der3_RARB_BICC1_TRHDE',
    '--track',
    'der3_segments',
    'height:128',
    '--track',
    'reads_vs_der3',
    'height:440',
    '--loc',
    'der3_RARB_BICC1_TRHDE:1-39,549',
    '--width',
    '1000',
  ]),
]

// The one composed jbrowse-img figure. Separate from `jbrowseImgSpecs`, which is
// typed `CliSpec[]` because `sync-img-readme.ts` walks it to regenerate every
// command fence in the jb2export README -- and this is not a command.
export const jbrowseImgComposedSpecs: ScreenshotSpec[] = [
  // The one composed jbrowse-img figure. It lives here rather than in
  // `jbrowseImgSpecs`, which is typed `CliSpec[]` because `sync-img-readme.ts`
  // walks it to regenerate every command fence in the jb2export README -- and
  // this is not a command. Its three panels are: the compose is the figure
  // pipeline putting one render beside another, which is what the review asked
  // for ("not something jbrowse-img has to do").
  //
  // WHICH PANEL IS WHICH, IN RED (review: "add red text annotation boxes"). Each
  // render does name its own track, at the 10 px jb2export writes a track label
  // in -- correct, and unreadable in a 3072 px figure scaled to a column of
  // prose, which is the same problem the in-app labels have in every stacked
  // figure here. These are the parts' identities and nothing else; what each
  // panel MEANS is the caption's job, and the third pill is the exception that
  // proves it, since "on one axis" is the only thing in the frame that says the
  // ruler under it is not a chromosome.
  //
  // Anchored per part rather than per pixel: the generator lays an element over
  // each part's own box in the composition. The bottom-left corner is white in
  // all three -- the sample panels' last pileup ends ~80 px short of their
  // bottom edge and the derivative's ~35 -- so the pills sit in the frame rather
  // than over any read.
  {
    mode: 'compose',
    name: 'jbrowse-img/sv_review_pair',
    parts: [
      'jbrowse-img/sv_review_tumor',
      'jbrowse-img/sv_review_normal',
      'jbrowse-img/sv_review_derivative',
    ],
    direction: 'horizontal',
    annotations: [
      // fontSize 22 in a 1x composition. The app captures these pills usually
      // sit on are 2x, where the same number draws half this size relative to
      // the frame -- see ComposeSpec.
      {
        type: 'text',
        text: 'tumour',
        fontSize: 22,
        anchor: {
          selector: '[data-part="0"]',
          alignX: 'left',
          alignY: 'bottom',
          dx: 20,
          dy: -30,
        },
      },
      {
        type: 'text',
        text: 'matched normal, same loci',
        fontSize: 22,
        anchor: {
          selector: '[data-part="1"]',
          alignX: 'left',
          alignY: 'bottom',
          dx: 20,
          dy: -30,
        },
      },
      {
        type: 'text',
        text: 'the allele those curves imply, on one axis',
        fontSize: 22,
        // one line: at the 420 default this wraps, and the second line drops
        // out of the white strip the pills are placed in
        maxWidth: 600,
        anchor: {
          selector: '[data-part="2"]',
          alignX: 'left',
          alignY: 'bottom',
          dx: 20,
          dy: -30,
        },
      },
    ],
  },
]
