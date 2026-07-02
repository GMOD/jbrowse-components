export interface SampleLink {
  config?: string
  href?: string
  label: string
}

// Long-standing core demos (volvox, the organism instances, themes, auth).
export const sampleConfigs: readonly SampleLink[] = [
  {
    config: 'test_data/volvox/config.json',
    label: 'Volvox',
  },
  {
    href: '?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-50000","type":"LinearGenomeView","tracks":["gff3tabix_genes","volvox_microarray_multi","volvox_bam"]}]}',
    label: 'Volvox (genes + multi-wiggle + BAM)',
  },
  {
    config: 'test_data/config.json',
    label: 'Human basic',
  },
  {
    href: '?config=test_data/config_demo.json&session=spec-{"views":[{"assembly":"hg38","loc":"10:87863113-87971930","type":"LinearGenomeView","colorByCDS":true,"tracks":["ncbi_refseq_109_hg38_latest"]}]}',
    label: 'Human PTEN gene (NCBI RefSeq GFF, color by CDS frame)',
  },
  {
    config: 'test_data/sars-cov2/config.json',
    label: 'SARS-CoV2',
  },
  {
    config: 'test_data/cfam2/config.json',
    label: 'Dog (NCBI)',
  },
  {
    config: 'test_data/honeybee/config.json',
    label: 'Honeybee',
  },
  {
    config: 'test_data/wormbase/config.json',
    label: 'Wormbase',
  },
  {
    config: 'test_data/breakpoint/config.json',
    label: 'Breakpoint',
  },
  {
    config: 'test_data/many_contigs/config.json',
    label: 'Many contigs',
  },
  {
    config: 'test_data/wgbs/config.json',
    label: 'WGBS methylation',
  },
  {
    config: 'test_data/methylation_test/config.json',
    label: 'Nanopore methylation',
  },
  {
    config: 'test_data/volvox/config_main_thread.json',
    label: 'Volvox (main thread)',
  },
  {
    config: 'test_data/volvox/config_auth_main.json',
    label: 'Volvox (auth, main thread)',
  },
  {
    config: 'test_data/volvox/config_auth.json',
    label: 'Volvox (auth)',
  },
  {
    config: 'test_data/volvoxhub/config.json',
    label: 'Volvox (UCSC hub)',
  },
  {
    config: 'test_data/volvox/theme.json',
    label: 'Theme (wild color)',
  },
  {
    config: 'test_data/volvox/theme2.json',
    label: 'Theme (wormbase)',
  },
]

// Demos added more recently (2025+): newer feature/data showcases.
export const recentConfigs: readonly SampleLink[] = [
  {
    href: '?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-50000","type":"LinearGenomeView","tracks":[{"trackId":"volvox_sv_cram","displaySnapshot":{"type":"LinearAlignmentsDisplay","readConnections":"arc"}}]}]}',
    label: 'Volvox SV (arc display)',
  },
  {
    config: 'test_data/volvox/config_broken.json',
    label: 'Broken track config',
  },
  {
    config: 'test_data/volvox/config_spec.json',
    label: 'Volvox (spec session)',
  },
  {
    config: 'test_data/config_gwas.json',
    label: 'GWAS (Manhattan + LD)',
  },
  {
    config: 'test_data/gwas/locuszoom_ld.json',
    label: 'GWAS LD (GIANT BMI, FTO locus)',
  },
  {
    href: '?config=test_data/sars-cov2/config.json&session=spec-{"views":[{"assembly":"Wuhan-Hu-1","loc":"NC_045512.2:266-21555","type":"LinearGenomeView","colorByCDS":true,"tracks":["ncbi_genes_with_mature_peptides"]}]}',
    label: 'SARS-CoV2 polyprotein (ORF1ab peptides)',
  },
  {
    config: 'test_data/enterovirus_d/config.json',
    label: 'Enterovirus D polyprotein (mature peptides)',
  },
  {
    config: 'test_data/maize_te/config.json',
    label: 'Maize transposable elements (LTR subparts)',
  },
  {
    config: 'test_data/human_mito/config.json',
    label: 'Human mitochondrion (transl_table=2, polyA stops)',
  },
  {
    href: '?config=test_data/config_demo.json&session=spec-{"views":[{"assembly":"hg38","loc":"3:49358083-49358183","type":"LinearGenomeView","colorByCDS":true,"tracks":["ncbi_refseq_109_hg38_latest"]}]}',
    label: 'GPX1 selenoprotein (UGA→Sec readthrough)',
  },
  {
    config: 'test_data/arabidopsis_methylation/config.json',
    label: 'Arabidopsis methylation (ONT 5mC/5hmC)',
  },
  {
    config: 'test_data/arabidopsis_methylation/config_emseq_bisulfite.json',
    label: 'Arabidopsis methylation (EM-seq bisulfite)',
  },
  {
    href: '?config=https://jbrowse.org/ucsc/hg38/config.json&session=spec-{"views":[{"assembly":"hg38","loc":"chr17:43044000-43126000","type":"LinearGenomeView","tracks":["hg38-cactus447way"]}]}',
    label: 'hg38 MAF (447-way)',
  },
  {
    href: '?config=https://jbrowse.org/demos/ce/config.json&session=spec-{"views":[{"assembly":"ce11","loc":"chrI:2998500-3001800","type":"LinearGenomeView","tracks":[{"trackId":"ce11.26way","displaySnapshot":{"type":"LinearMafDisplay","showConservation":true,"rowHeight":8}}]}]}',
    label: 'C. elegans MAF (26-way, conservation band)',
  },
  {
    href: '?config=test_data/config_demo.json&session=spec-{"views":[{"assembly":"hg19","loc":"11:5200000-5400000","type":"LinearGenomeView","tracks":["broad_chromhmm_multirow_hg19"]}]}',
    label: 'ChromHMM states (9 ENCODE cell types, β-globin)',
  },
  {
    href: '?config=test_data/config_demo.json&session=spec-{"views":[{"assembly":"hg19","loc":"11:5200000-5400000","type":"LinearGenomeView","tracks":["roadmap_chromhmm_multirow_hg19"]}]}',
    label: 'ChromHMM states (Roadmap, 127 epigenomes)',
  },
  {
    href: '?config=test_data/config_demo.json&session=spec-{"views":[{"assembly":"hg38","loc":"11:2153000-2172000","type":"LinearGenomeView","tracks":["catlas_scatac_celltypes_hg38"]}]}',
    label: 'Single-cell ATAC by cell type (CATlas, INS locus)',
  },
  {
    href: '?config=test_data/config_demo.json&session=spec-{"views":[{"assembly":"hg38","loc":"1:16900000-16920000","type":"LinearGenomeView","tracks":["hg002_dipcall_dip_vcf_t2t","hg002_dipcall_hap1_t2t","hg002_dipcall_hap2_t2t"]}]}',
    label: 'HG002 diploid assembly (dipcall hap1+hap2 + variant calls vs GRCh38)',
  },
]

const hs1Mm39DotplotSpec = encodeURIComponent(
  JSON.stringify({
    views: [
      {
        type: 'DotplotView',
        tracks: ['hs1ToMm39.over.chain.pif'],
        views: [{ assembly: 'hs1' }, { assembly: 'mm39' }],
        autoDiagonalize: true,
        colorBy: 'query',
        minAlignmentLength: 1000000,
      },
    ],
  }),
)

const volvoxDotplotHighlightSpec = encodeURIComponent(
  JSON.stringify({
    views: [
      {
        type: 'DotplotView',
        views: [
          { assembly: 'volvox', loc: 'ctgA:1-50000' },
          { assembly: 'volvox', loc: 'ctgA:1-50000' },
        ],
        tracks: ['volvox_fake_synteny'],
        highlight: ['ctgA:5000-15000'],
      },
    ],
  }),
)

export const syntenyConfigs: readonly SampleLink[] = [
  {
    config: 'test_data/config_synteny_grape_peach.json',
    label: 'Grape/Peach synteny',
  },
  {
    config: 'test_data/config_dotplot.json',
    label: 'Grape/Peach dotplot',
  },
  {
    config: 'test_data/config_human_dotplot.json',
    label: 'Human dotplot',
  },
  {
    config: 'test_data/yeast_synteny/config.json',
    label: 'Yeast synteny',
  },
  {
    config: 'test_data/hs1_vs_mm39/config.json',
    label: 'hs1 vs mm39 synteny',
  },
  {
    href: `?config=test_data/hs1_vs_mm39/config.json&session=spec-${hs1Mm39DotplotSpec}`,
    label: 'hs1 vs mm39 dotplot',
  },
  {
    href: `?config=test_data/volvox/config_main_thread.json&session=spec-${volvoxDotplotHighlightSpec}`,
    label: 'Volvox dotplot (w/ highlight)',
  },
  {
    config: 'test_data/hg19_vs_hg38/config.json',
    label: 'hg19 vs hg38 liftover',
  },
]

export const demoSessions: readonly SampleLink[] = [
  {
    href: '?config=test_data/config_demo.json&session=share-oTyYRpz9fN&password=fYAbt',
    label: 'HG002 insertion',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-pjaAq1hNxB&password=Z9teR',
    label: 'SKBR3 breakpoint split view',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-XyL52LPDoO&password=861E4',
    label: 'Methylation/modifications nanopore',
  },
  {
    href: '?config=test_data/breakpoint/config.json&session=share-xeUuLRakik&password=vh0ca',
    label: 'Breakpoint split view (multi-hop)',
  },
  {
    href: '?config=test_data/config_dotplot.json&session=share-zw51jIwuXb&password=i8WqY',
    label: 'Grape vs Peach dotplot',
  },
  {
    href: '?config=test_data/yeast_synteny/config.json',
    label: 'Yeast dotplot',
  },
  {
    href: '?config=https://jbrowse.org/genomes/GRCh38/1000genomes/config_1000genomes.json&session=share-SUK-mntGyB&password=eQF0F',
    label: '1000 genomes trio',
  },

  {
    href: '?config=test_data/config_demo.json&session=share-Pw7kOjagSF&password=e0SuE',
    label: 'ENCODE multi-bigwig',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-7skGDzEmMi&password=NGzLX',
    label: 'COLO829 tumor vs normal multi-bigwig',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-sA7riIQWhJ&password=3pkHd',
    label: 'Inversion "single row" breakpoint view',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-ofjI26CNas&password=ohqlR',
    label: 'Inversion (linked reads mode)',
  },
  {
    href: '?config=https://jbrowse.org/demos/plant_synteny_demo/config2.json&session=share-pARmvLazem&password=ZPOwE',
    label: 'Grape vs peach vs cacao',
  },
  {
    href: '?config=https://jbrowse.org/genomes/potato/config.json',
    label: 'Tetraploid potato multi-sample VCF',
  },
  {
    href: '?hubURL=https://hgdownload.soe.ucsc.edu/hubs/GCF/019/202/715/GCF_019202715.1/hub.txt&config=none',
    label: 'UCSC GenArk hub (GCF_019202715.1)',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-vQBatl-Of9&password=Mhl6F',
    label: 'Human trio phased VCF rendering',
  },
  {
    href: '?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","type":"CircularView","tracks":["volvox_sv_test"]}]}',
    label: 'Circular view (volvox SVs as chords)',
  },
  {
    href: '?config=test_data/config_demo.json&session=spec-{"views":[{"assembly":"hg19","loc":"17:1-83257441","type":"LinearGenomeView","tracks":["hic"]}]}',
    label: 'Hi-C contact matrix (chr17, hg19)',
  },
  {
    href: '?config=test_data/config_gwas.json&session=spec-{"views":[{"assembly":"hg19","loc":"2:191790000-192120000","type":"LinearGenomeView","tracks":["sle_gwas_ld"]}]}',
    label: 'GWAS LD coloring',
  },
  {
    href: '?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-50000","type":"LinearGenomeView","tracks":["volvox_bedpe"]}]}',
    label: 'BEDPE arc display (volvox SVs)',
  },
  {
    href: '?config=test_data/config_demo.json&session=spec-{"views":[{"assembly":"hg19","loc":"1:1-5000000","type":"LinearGenomeView","tracks":["Pairend_StrandSpecific_51mer_Human_hg19"]}]}',
    label: 'Paired-end stranded RNA-seq',
  },
  {
    href: '?config=test_data/config_demo.json&session=spec-{"views":[{"assembly":"hg38","loc":"15:23615000-23680000","type":"LinearGenomeView","tracks":[{"trackId":"HG002_WGS_fiberseq.MAGEL2_2","displaySnapshot":{"type":"LinearAlignmentsDisplay","colorBy":{"type":"modifications"}}}]}]}',
    label: 'Fiber-seq (5mC/6mA, MAGEL2)',
  },
  {
    href: '?config=test_data/config_demo.json&session=spec-{"views":[{"assembly":"hg38","loc":"17:43000000-43200000","type":"LinearGenomeView","tracks":["NA12878-DirectRNA.pass.dedup.NoU.fastq.hg38.minimap2.sorted"]}]}',
    label: 'Direct RNA-seq nanopore (BRCA1)',
  },
]

export const galleryDemos: readonly SampleLink[] = [
  {
    href: '?config=test_data%2Fconfig_dotplot.json&session=share-r4sMB3bHh5&password=C9jCa',
    label: 'Dotplot grape vs peach',
  },
  {
    href: '?config=test_data%2Fconfig_dotplot.json&session=share-4MjF5YGM_G&password=rByjt',
    label: 'Synteny grape vs peach',
  },
  {
    href: '?config=test_data%2Fhs1_vs_mm39%2Fconfig.json',
    label: 'Hs1 vs mm39 synteny',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-xS8Eg67AFS&password=jPzH5',
    label: 'Hi-C contact matrix',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-n9_vE%2FEl2R&password=wu9J6',
    label: 'SKBR3 SV inspector',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-6pkcSXlbFL&password=ER28C',
    label: 'Horizontally flipped',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-AcZSrC_yOb&password=e7b64',
    label: 'COLO829 tumor vs normal',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-Swq8pJTX0z&password=yM41l',
    label: 'SKBR3 breakpoint split view',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-psOr2x2efp&password=bErZE',
    label: 'GIAB - Heterozygous small deletion',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-oTyYRpz9fN&password=fYAbt',
    label: 'GIAB - ~1.5kb insertion',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-rzJ27iixQH&password=rSgZe',
    label: 'SKBR3 - ~500bp insertion',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-LffYr8SI5E&password=VmZVl',
    label: 'COLO829 tumor nanopore methylation',
  },
  {
    href: '?config=https://jbrowse.org/genomes/GRCh38/1000genomes/config_1000genomes.json&session=share-DN_h4SIwo4&password=CxkLw',
    label: '1000 genomes SV call w/ INV on chr19',
  },
]
