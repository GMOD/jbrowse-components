import type { RExportSpec } from '../screenshot-spec-types.ts'

// The "Export R script" gallery: for each figure, the SAME session an existing
// browser figure already shows, re-rendered through the real exporter —
// `jb2export … --out <tmp>.R`, then Rscript.
//
// Every spec here names another spec (`from`) rather than carrying a dataset of
// its own, so each R figure is the direct counterpart of a JBrowse rendering of
// the identical view. That is the comparison a reader actually wants ("what does
// this track look like in ggplot2?"), and it keeps the R gallery on the datasets
// the docs already explain rather than on a parallel set of examples.
//
// It also removes a class of drift: retargeting a browser figure retargets its R
// twin, and deleting one is a validateSpecs failure rather than a stale render.
// Before this, these 19 figures were hand-made PNGs force-added past
// .gitignore, absent from figures.lock, and reproducible only from prose.
//
// Most carry a `cli` block, which publishes (and runs) the figure as the
// file-flag command a reader typing jb2export would write — `--fasta … --bam …`
// — instead of a config plus a session spec. Only the FILE LOCATIONS live there:
// the loc, the panel order and every display setting are still read out of
// `from`. The handful without one say why below.
function rexportSpec(
  name: string,
  from: string,
  extra: Partial<RExportSpec> = {},
): RExportSpec {
  return { mode: 'rexport', name: `rexport/${name}`, from, ...extra }
}

// Bioconductor readers, by track type. Named per spec so a machine without the
// full stack skips the figures it cannot draw and says which package is missing,
// instead of failing the sweep.
const BIGWIG = ['rtracklayer']
const BAM = ['Rsamtools', 'GenomicAlignments']
const TABIX = ['Rsamtools']

// Files the commands name. A `test_data/…` path is repo-relative and gets
// rewritten onto the hosted mirror (see rExportInvocation); everything else is
// already a public URL.
//
// The reference is named outright because a CLI assembly is built from an
// INDEXED FASTA — volvox's config assembly is a .2bit, which no flag builds, and
// hg19/hg38 come from the shared genome mirrors rather than from a config. The
// alias tables come with them: hg19's loc `1:…` and the NCBI RefSeq GFFs'
// `NC_000015.10` contig names both need the assembly's chr↔accession mapping,
// and without it those tracks read zero rows.
const VOLVOX = 'test_data/volvox/'
const VOLVOX_FASTA = `${VOLVOX}volvox.fa`
const HG19_FASTA = 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz'
const HG19_ALIASES =
  'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt'
const HG38_FASTA = 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz'
const HG38_ALIASES =
  'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt'
const HG38_REFSEQ =
  'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GRCh38_latest_genomic.sort.gff.gz'
const CANCER_SV = 'https://jbrowse.org/demos/cancer_sv/'
const COLO829_TUMOUR =
  'https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829_tumor.ht.cram'

export const rexportSpecs: RExportSpec[] = [
  // ── Quantitative ────────────────────────────────────────────────────────
  // The multi-wiggle renderer comparison: several BigWigs read into one long
  // data.frame, drawn in whichever mode the display is in. `--multiwig` takes
  // the sources as a comma-separated list, so each subtrack is labelled by its
  // filename rather than by the config's k1..k4.
  rexportSpec('multiwiggle', 'multiwig/multi_renderer_types', {
    rPackages: BIGWIG,
    cli: {
      fasta: VOLVOX_FASTA,
      tracks: [
        {
          trackId: 'volvox_microarray_multi',
          flag: 'multiwig',
          file: [1, 2, 3, 4].map(i => `${VOLVOX}v${i}.cram.bw`),
          // the whole comma-separated list is what names the track otherwise,
          // so the panel title comes out as the LAST file in it
          opts: ['name:MultiWig'],
        },
      ],
    },
  }),

  // ── Alignments ──────────────────────────────────────────────────────────
  // A coverage histogram over a strand-colored pileup, the default alignments
  // view. Deliberately a BAM source rather than one of the CRAM figures: the
  // CRAM path shells out to samtools to decode a temp BAM (Rsamtools is
  // BAM-only) and needs the reference too, which is a lot to ask of a docs
  // regen — jb2export can still do it, and exportRRun covers it.
  rexportSpec('alignments', 'display_type_default_badge', {
    rPackages: BAM,
    cli: {
      fasta: VOLVOX_FASTA,
      tracks: [
        {
          trackId: 'volvox_alignments_pileup_coverage',
          flag: 'bam',
          file: `${VOLVOX}volvox-sorted.bam`,
        },
      ],
    },
  }),

  // Sort by base at a SNP: reads carrying the alternate allele group at the
  // top, which is the whole point of the localized sort.
  //
  // The sort has to be added here. `alignments_sort_by_base` deliberately
  // STARTS unsorted — its two frames are the right-click and its effect — and
  // an rexport spec re-exports the source's session, not the state its UI
  // actions reach, so the R twin came out an ordinary unsorted pileup. Written
  // as the display state the click produces rather than as `sort:base`, which
  // anchors on the view centre (14,485 here): the SNP is at ctgA:14,481, the
  // column the browser figure right-clicks, and sorting three bases off it
  // would look exactly as unsorted as sorting nothing.
  rexportSpec('alignments_sort', 'alignments_sort_by_base', {
    rPackages: BAM,
    cli: {
      fasta: VOLVOX_FASTA,
      tracks: [
        {
          trackId: 'volvox_bam',
          flag: 'bam',
          file: `${VOLVOX}volvox-sorted.bam`,
          // pos is 0-based genomic, as the context menu's own `genomicPos` is.
          // No assemblyName: the layout keys the sort off refName alone
          // (sortLayout.ts), and a --fasta assembly is named for its file, so
          // spelling one here would only publish a value that has to track the
          // filename.
          opts: [
            '{"sortedBy":{"type":"basePair","pos":14480,"refName":"ctgA"}}',
          ],
        },
      ],
    },
  }),

  // Long reads across an insertion: the CIGAR walk that draws deletions,
  // skipped introns and insertion ticks over the read body.
  rexportSpec('long_reads', 'read_vs_ref_insertion', {
    rPackages: BAM,
    cli: {
      fasta: HG19_FASTA,
      aliases: HG19_ALIASES,
      tracks: [
        {
          trackId: 'ngmlr',
          flag: 'cram',
          file: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.cram',
          opts: ['name:SKBR3 pacbio (NGMLR)'],
        },
      ],
    },
  }),

  // Base modifications from the MM/ML tags: each read's 5mC calls as per-base
  // ticks, the one thing a modBAM figure is for.
  //
  // Sourced from the UNGROUPED half of the Group-by-HP pair rather than the
  // grouped one or the four-track combined figure, because those two claim
  // things this export cannot draw and the R twin would quietly contradict its
  // source: `groupBy` has no R translation (the pileup comes out in one block),
  // and the modkit lanes are MultiQuantitativeTracks over a BedTabix bedMethyl,
  // which the multi-wiggle exporter — BigWig-only — contributes nothing for.
  rexportSpec('modifications', 'methylation/hg002_snrpn_ungrouped', {
    rPackages: BAM,
    cli: {
      fasta: HG38_FASTA,
      aliases: HG38_ALIASES,
      dropTracks: [
        {
          trackId: 'cpgisland_ucsc_hg38',
          why: 'a UCSCAdapter from a plugin jb2export does not bundle; the config form warns and renders the rest',
        },
      ],
      tracks: [
        {
          trackId: 'ncbi_refseq_109_hg38_latest',
          flag: 'gffgz',
          file: HG38_REFSEQ,
          // the config track carries this; a bare file has only what is typed
          opts: ['name:NCBI RefSeq', '{"showOnlyGenes":true}'],
        },
        {
          trackId: 'HG002_snrpn_5mC_reads',
          flag: 'bam',
          file: 'https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam',
        },
      ],
    },
  }),

  // ── Genes ───────────────────────────────────────────────────────────────
  rexportSpec('genes', 'customized_feature_details', {
    rPackages: BIGWIG,
    cli: {
      fasta: VOLVOX_FASTA,
      tracks: [
        {
          trackId: 'gff3tabix_genes',
          flag: 'gffgz',
          file: `${VOLVOX}volvox.sort.gff3.gz`,
        },
      ],
    },
  }),

  // ── Variants ────────────────────────────────────────────────────────────
  // No `cli` here or on the matrix below: volvox.test.vcf.gz names its contig
  // `contigA` where the assembly says `ctgA`, and that mapping lives in the
  // volvox config's refNameAliases as inline FromConfigAdapter features — there
  // is no alias FILE for `--aliases` to name. Without it the exported script
  // reads the VCF by the canonical name and every panel comes out empty, which
  // is exactly the silence a published command must not have.
  rexportSpec('variants', 'volvox_variants', { rPackages: TABIX }),

  // The multi-sample matrix: site-indexed columns, samples ordered by hclust
  // with a hand-rolled dendrogram composed as a left panel.
  rexportSpec('variant_matrix', 'variants/cluster_dialog', {
    rPackages: TABIX,
  }),

  // ── Hi-C ────────────────────────────────────────────────────────────────
  // strawr rotates the contact matrix into the triangular view on a genomic
  // x-axis, so it stacks under the gene track the source figure shows.
  rexportSpec('hic', 'hic/percentile_on', {
    rPackages: ['strawr'],
    cli: {
      fasta: HG19_FASTA,
      aliases: HG19_ALIASES,
      tracks: [
        {
          trackId: 'hic',
          flag: 'hic',
          file: 'https://jbrowse.org/genomes/hg19/intra_nofrag_30.hic',
        },
      ],
    },
  }),

  // Two discontiguous regions concatenated on one cumulative-bp axis — the
  // multi-region layout, with the Hi-C panel spanning the divider. One --loc,
  // two space-separated regions, exactly as the location box takes them.
  rexportSpec('multiregion', 'hic/two_regions', {
    rPackages: ['strawr'],
    cli: {
      fasta: HG19_FASTA,
      aliases: HG19_ALIASES,
      tracks: [
        {
          trackId: 'hic',
          flag: 'hic',
          file: 'https://jbrowse.org/genomes/hg19/intra_nofrag_30.hic',
        },
      ],
    },
  }),

  // ── GWAS ────────────────────────────────────────────────────────────────
  // No `cli`: the track is a GWASTrack over a GWASAdapter, whose `scoreColumn`
  // says which column of the tabix'd BED holds the p-value. No file flag builds
  // that adapter, and `--bedgz` would open it as an ordinary feature track.
  rexportSpec('gwas', 'gwas/manhattan', { rPackages: TABIX }),

  // ── Figures the gallery already curates ─────────────────────────────────
  // Everything below re-exports a reviewed gallery/topic figure, so the R
  // rendering can be compared against a JBrowse one a reader has already seen.

  // Polyprotein cleavage products as nested gene glyphs — the densest feature
  // layout in the set, and a good test of gene_layout's row packing. A plain
  // unindexed GFF3, which is what `--gff` is for.
  rexportSpec('genes_sarscov2', 'gallery/sarscov2_polyprotein', {
    rPackages: BIGWIG,
    cli: {
      fasta: 'test_data/sars-cov2/sequence.fasta.gz',
      tracks: [
        {
          trackId: 'ncbi_genes_with_mature_peptides',
          flag: 'gff',
          file: 'test_data/sars-cov2/ncbi_original.gff3',
          opts: ['name:NCBI genes (with mature peptides)'],
        },
      ],
    },
  }),

  // The same idea across two loci at once — a multi-region scATAC figure, which
  // is the multi-region layout doing real work rather than demonstrating itself.
  //
  // No `cli`: the twelve BigWigs are one MultiWiggleAdapter whose subadapters
  // carry the cell-type name, the lineage group and the colour each row is drawn
  // in. `--multiwig` takes a bare url list, so a file-flag command would publish
  // twelve filenames and lose the grouping the figure is about.
  rexportSpec('scatac_multiregion', 'scatac/pbmc5k_marker_swap', {
    rPackages: BIGWIG,
  }),

  // A phased trio genotype matrix: each sample expanded into its two
  // haplotypes, which is the one case the matrix colours per allele.
  rexportSpec('trio_phased', 'trio-matrix-phased-clean', {
    rPackages: [...TABIX, ...BIGWIG],
    cli: {
      fasta: HG38_FASTA,
      aliases: HG38_ALIASES,
      tracks: [
        {
          trackId: 'ncbi_refseq_109_hg38_latest',
          flag: 'gffgz',
          file: HG38_REFSEQ,
          opts: ['name:NCBI RefSeq'],
        },
        {
          trackId: 'HG02024_VN049_KHVTrio.chr1.vcf',
          flag: 'vcfgz',
          file: 'https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz',
        },
      ],
    },
  }),

  // ── Structural variants ─────────────────────────────────────────────────
  // Soft- and hard-clip indicator bars at a breakpoint: the first signal an SV
  // gives you in a pileup, and the reason bam_clips exists.
  rexportSpec('sv_clipping', 'alignment_clipping_indicators', {
    rPackages: BAM,
    cli: {
      fasta: VOLVOX_FASTA,
      tracks: [
        {
          trackId: 'volvox-long-reads-sv-bam',
          flag: 'bam',
          file: `${VOLVOX}volvox-long-reads-sv.bam`,
        },
      ],
    },
  }),

  // Somatic SV calls over the tumour and matched-normal long reads they were
  // called from — the comparison that says a call is real. Both read sets are
  // named so the panels read as tumour and normal; the normal's filename
  // (PAU59807.d052sup…) says nothing about which of the two it is.
  rexportSpec('sv_tumour_normal', 'cancer_sv/multihop_tumour_vs_normal', {
    rPackages: [...TABIX, ...BAM],
    cli: {
      fasta: HG38_FASTA,
      aliases: HG38_ALIASES,
      tracks: [
        {
          trackId: 'COLO829_somatic_sv',
          flag: 'vcfgz',
          file: `${CANCER_SV}COLO829.somatic-sv.vcf.gz`,
          opts: ['name:COLO829 somatic SVs (nanomonsv)'],
        },
        {
          trackId: 'COLO829_tumor_ont',
          flag: 'cram',
          file: COLO829_TUMOUR,
          opts: ['name:COLO829 tumour (ONT R10, haplotagged)'],
        },
        {
          trackId: 'COLO829BL_normal_ont',
          flag: 'bam',
          file: 'https://ont-open-data.s3.amazonaws.com/colo829_2024.03/basecalls/colo829bl/sup/PAU59807.d052sup4305mCG_5hmCGvHg38.bam',
          opts: ['name:COLO829BL matched normal (ONT R10)'],
        },
      ],
    },
  }),

  // A foldback inversion: reads whose two halves point the same way.
  rexportSpec('sv_foldback', 'cancer_sv/foldback_reconstruction', {
    rPackages: [...BAM, ...BIGWIG],
    cli: {
      fasta: HG38_FASTA,
      aliases: HG38_ALIASES,
      tracks: [
        {
          trackId: 'ncbi_refseq_hg38',
          flag: 'gffgz',
          file: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz',
          // a CSI, not the .tbi a tabix'd file is assumed to carry
          opts: [
            'index:https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi',
            'name:NCBI RefSeq genes',
          ],
        },
        {
          trackId: 'COLO829_tumor_ont',
          flag: 'cram',
          file: COLO829_TUMOUR,
          opts: ['name:COLO829 tumour (ONT R10, haplotagged)'],
        },
      ],
    },
  }),

  // BCR-ABL, the two fusion partners side by side on one cumulative axis —
  // multi-region doing the job it exists for.
  rexportSpec('sv_fusion', 'cancer_sv/k562_bcr_abl_split', {
    rPackages: [...BAM, ...BIGWIG],
    cli: {
      fasta: HG38_FASTA,
      aliases: HG38_ALIASES,
      tracks: [
        {
          trackId: 'ncbi_refseq_hg38',
          flag: 'gffgz',
          file: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz',
          opts: [
            'index:https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi',
            'name:NCBI RefSeq genes',
          ],
        },
        {
          trackId: 'K562_isoseq',
          flag: 'bam',
          file: `${CANCER_SV}K562_isoseq.bam`,
          opts: ['name:K562 PacBio Iso-Seq (ENCODE)'],
        },
      ],
    },
  }),

  // 1000 Genomes SVs as a multi-sample genotype panel over the genes they hit.
  rexportSpec('sv_multisample', 'multisv_svtype', {
    rPackages: [...TABIX, ...BIGWIG],
    cli: {
      fasta: HG38_FASTA,
      aliases: HG38_ALIASES,
      tracks: [
        {
          trackId: '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
          flag: 'vcfgz',
          file: 'https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20210124.SV_Illumina_Integration/1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf.gz',
        },
        {
          trackId: 'ncbi_refseq_109_hg38',
          flag: 'gffgz',
          file: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
          opts: ['name:NCBI RefSeq'],
        },
      ],
    },
  }),

  // `qc/callsets_at_smn` (three SV callsets at SMN) is deliberately NOT here.
  // It exports correctly now — the BigBed reader and the label-room rule both
  // came out of trying it — but the figure is unusable: DGV alone packs 1009
  // overlapping records into 61 rows across that 2.5 Mb window, and a feature
  // panel gets a fixed height weight however many rows it packs, so all 61 are
  // squeezed into ~2 inches. The browser has a scrollable track and a fit
  // ladder; the R panel would need its height weighted by the row count it
  // discovers at draw time. Worth doing, and then this figure is worth adding.

  // A biallelic CNV: copy number over the SV calls and the genes.
  //
  // No `cli`: the copy-number lane is a 108-BigWig cohort, one file per PUR
  // sample. `--multiwig` would take them, as 108 comma-separated urls on one
  // line — a command nobody reads, let alone types.
  rexportSpec('sv_cnv', 'cnv1000g/ugt2b17_biallelic', {
    rPackages: [...TABIX, ...BIGWIG],
  }),
]
