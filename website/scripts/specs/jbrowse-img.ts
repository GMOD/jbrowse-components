// Example figures for the products/jbrowse-img README, each the literal argv
// of the command the README prints beside it. sync-img-readme.ts regenerates
// the README's command fences from `jbrowseImgSpecs`.

import {
  HG002_NANOPORE_BAM,
  HG00151_ONT_1000G_BAM,
} from '../screenshot-spec-helpers.ts'

import type { CliSpec, ScreenshotSpec } from '../screenshot-spec-types.ts'

export const YEAST =
  'https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447'

export function cliSpec(name: string, args: string[]): CliSpec {
  return { mode: 'cli', name: `jbrowse-img/${name}`, args }
}

// one panel of jbrowse-img/sv_review_pair
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

// Each row is the argv `jb2export batch` builds for one record of
// COLO829.somatic-sv.vcf.gz (runBatch.ts), one per "Reading the sheet" case in
// sv_callset_review.md.
const SV_SHEET_ROWS = {
  '056': {
    file: '056_chr7_104844620-chr7_104971854_r_138.png',
    locs: ['chr7:104844021-104845221', 'chr7:104971255-104972455'],
  },
  '009': {
    file: '009_chr1_168055349-chr19_23850381_r_2_0.png',
    locs: ['chr1:168054750-168055950', 'chr19:23849782-23850982'],
  },
  '013': {
    file: '013_chr2_20405765-chr2_20408702_d_78.png',
    locs: ['chr2:20405166-20406366', 'chr2:20408103-20409303'],
  },
}
const SV_SHEET_SAMPLES = {
  tumor: 'COLO829_tumor_ont',
  normal: 'COLO829BL_normal_ont',
}

// Outside `jbrowseImgSpecs`, so sync-img-readme.ts prints no command for them:
// a reader makes these with the tutorial's `batch` command.
export const jbrowseImgBatchRowSpecs: CliSpec[] = svSheetSpecs()

function svSheetSpecs() {
  return Object.entries(SV_SHEET_ROWS).flatMap(([row, { locs }]) =>
    Object.entries(SV_SHEET_SAMPLES).map(([sample, trackId]) =>
      cliSpec(`sv_sheet_${row}_${sample}`, [
        'breakpoint',
        '--config',
        'https://jbrowse.org/demos/cancer_sv/config.json',
        '--assembly',
        'hg38',
        '--track',
        trackId,
        'force:true',
        'height:240',
        ...locs.flatMap(loc => ['--loc', loc]),
        '--width',
        '1100',
      ]),
    ),
  )
}

export const jbrowseImgSpecs: CliSpec[] = [
  // the README's "## Screenshot" headline
  cliSpec('1', [
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    'aliases:https://jbrowse.org/genomes/hg19/hg19_aliases.txt',
    'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz',
    '{"filter":["geneLike"]}',
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

  cliSpec('yeast_dotplot', [
    'dotplot',
    '--fasta',
    `${YEAST}/yjm1447.fa`,
    '--fasta',
    `${YEAST}/r64.fa`,
    '--paf',
    `${YEAST}/r64_vs_yjm1447.paf`,
    '--view',
    'autoDiagonalize=true',
    '--width',
    '1100',
  ]),

  cliSpec('yeast_synteny', [
    'synteny',
    '--fasta',
    `${YEAST}/yjm1447.fa`,
    'loc:I',
    '--fasta',
    `${YEAST}/r64.fa`,
    'loc:NC_001133.9',
    '--paf',
    `${YEAST}/r64_vs_yjm1447.paf`,
    '--view',
    'mark.interpolate=bump',
    '--width',
    '1400',
  ]),

  cliSpec('hosted_synteny', [
    'synteny',
    '--genome',
    'hg38',
    'loc:chr7:27000000-27300000',
    '--genome',
    'mm39',
    'loc:chr6:52000000-52300000',
    '--view',
    'mark.interpolate=bump',
    '--width',
    '1400',
  ]),

  cliSpec('grape_peach_synteny', [
    'synteny',
    '--chromSizes',
    'data/comparative/peach.chrom.sizes',
    '--paf',
    'https://s3.amazonaws.com/jbrowse.org/genomes/synteny/peach_grape.paf.gz',
    '--chromSizes',
    'data/comparative/grape.chrom.sizes',
    '--view',
    'autoDiagonalize=true',
    'encoding.color.field=query',
    'encoding.opacity=0.4',
    'levelHeights=350',
    'mark.interpolate=bump',
    '--width',
    '1400',
  ]),

  cliSpec('hs1_mm39_synteny', [
    'synteny',
    '--chromSizes',
    'data/comparative/hs1.chrom.sizes',
    '--chain',
    'https://jbrowse.org/demos/hs1ToMm39/hs1ToMm39.over.chain.gz',
    '--chromSizes',
    'data/comparative/mm39.chrom.sizes',
    '--view',
    'filter.0.field=length',
    'filter.0.gte=500000',
    'autoDiagonalize=true',
    'encoding.color.field=query',
    'encoding.opacity=0.4',
    'levelHeights=350',
    'mark.interpolate=bump',
    'cigarMode=matches',
    '--width',
    '1400',
  ]),

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
    '--view',
    'filter.0.field=length',
    'filter.0.gte=500000',
    'autoDiagonalize=true',
    'encoding.color.field=query',
    'encoding.opacity=0.4',
    'levelHeights=300',
    'mark.interpolate=bump',
    'cigarMode=matches',
    '--width',
    '1400',
  ]),

  // The spec file picks one of the config's four all-vs-all tracks; a bare
  // `synteny --config` overlays all four on every band.
  cliSpec('ecoli_ava_synteny', [
    '--config',
    'https://jbrowse.org/demos/ecoli_pangenome/config.json',
    '--spec',
    'data/comparative/ecoli_ava.spec.json',
    '--width',
    '1400',
  ]),

  // The cgiab HG008 benchmark has no BND calls, so its ring draws no chords.
  cliSpec('circular_chords', [
    'circular',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    'https://jbrowse.org/genomes/hg19/SKBR3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.filtered.vcf.gz',
    '--width',
    '800',
  ]),

  cliSpec('circular_synteny', [
    '--config',
    'https://jbrowse.org/demos/circular_synteny/config.json',
    '--spec',
    'data/comparative/hg38_mm39_circular.spec.json',
    '--width',
    '800',
  ]),

  // The window sits on a TP53 intron/CDS boundary, so the exon edge lines up
  // with a reference base and the translation frame.
  cliSpec('gene_track', [
    '--genome',
    'hg38',
    '--track',
    'hg38-ncbiRefSeqCurated',
    'height:60',
    '{"filter":["geneLike"],"geneGlyphMode":"longestCoding"}',
    '--refseq',
    '--loc',
    'chr17:7,675,018-7,675,098',
    '--width',
    '1500',
  ]),

  cliSpec('hic', [
    '--genome',
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

  cliSpec('dark_theme', [
    '--genome',
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
    'stock',
    '--themeMode',
    'dark',
    '--width',
    '1200',
  ]),

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

  // The sort pivot, the window's centre, must land inside the CUZD1 deletion
  // to group its reads. The doc image URL keeps the `alignments_readgroup` name.
  cliSpec('alignments_readgroup', [
    '--genome',
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

  cliSpec('alignments_haplotype', [
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--bam',
    HG002_NANOPORE_BAM,
    'facet=tags.HP',
    'encoding.color.field=tags.HP',
    'height:400',
    '--loc',
    '1:63,005,675-63,007,432',
    '--width',
    '1200',
  ]),

  cliSpec('methylation', [
    'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
    'aliases:https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    // argv order stacks the CpG islands above the reads
    'https://jbrowse.org/ucsc/hg38/cpgIslandExt.bed.gz',
    'index:https://jbrowse.org/ucsc/hg38/cpgIslandExt.bed.gz.csi',
    // The source CRAM's UR names the producer's filesystem, so decoding it
    // needs an M5 lookup, and streaming it timed out in figures.yml.
    '--bam',
    'https://jbrowse.org/demos/ont/COLO829_tumor.ht.chr20_18.5Mb.bam',
    'baseColor:methylation',
    'legend.show=true',
    'height:350',
    '--loc',
    'chr20:18,503,000-18,509,000',
    '--width',
    '1200',
  ]),

  cliSpec('variants', [
    'data/volvox/volvox.fa',
    'data/volvox/volvox.filtered.vcf.gz',
    '--loc',
    'ctgA:1-20000',
    '--width',
    '1200',
  ]),

  cliSpec('multisample_variants', [
    '--genome',
    'hg19',
    '--track',
    'hg19-ncbiRefSeqCurated',
    'https://jbrowse.org/genomes/hg19/1000genomes/ALL.chr11.phase3_v5b.HBB_5.2-5.3Mb.vcf.gz',
    'display:multivariant',
    'height:450',
    'force:true',
    '--loc',
    'chr11:5,246,000-5,251,000',
    '--width',
    '1200',
  ]),

  cliSpec('sashimi_junctions', [
    '--genome',
    'hg19',
    '--track',
    'hg19-ncbiRefSeqCurated',
    'height:90',
    '--bam',
    'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/paired_end_rnaseq/Pairend_StrandSpecific_51mer_Human_hg19.bam',
    'sashimi:auto',
    'coverage.height=170',
    // junction depth spans three orders of magnitude; a linear axis flattens
    // every exon but the last
    'coverage.encoding.y.scale.type=log',
    'featureHeight:super-compact',
    'height:420',
    '--loc',
    'B2M',
    '--width',
    '1400',
  ]),

  cliSpec('sv_read_arcs', [
    '--genome',
    'hg38',
    '--bam',
    HG00151_ONT_1000G_BAM,
    'arcs:down',
    'unit=chain',
    // the chain's segment colors live under the orientation fields
    'encoding.color.field=pairOrientation',
    'facet=split',
    'coverage.height=80',
    'height:560',
    '--loc',
    'chr1:197,786,900-197,789,700',
    '--width',
    '1400',
  ]),

  cliSpec('scatac_multiwiggle', [
    '--genome',
    'hg38',
    '--track',
    'hg38-ncbiRefSeqCurated',
    'height:60',
    '--multiwig',
    'data/scatac_catlas.json',
    'name:CATlas single-cell ATAC (accessibility by cell type)',
    'height:440',
    // a narrower window loses the quiet flanks the alpha-cell peak reads
    // against
    '--loc',
    'chr2:162,000,000-162,300,000',
    '--width',
    '1400',
  ]),

  cliSpec('remote_files', [
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    'aliases:https://jbrowse.org/genomes/hg19/hg19_aliases.txt',
    'https://hgdownload.soe.ucsc.edu/gbdb/hg19/bbi/clinvar/clinvarMain.bb',
    'https://jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz',
    'https://jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.regions.bw',
    '--loc',
    '1:48,683,542-48,907,531',
    '--width',
    '1200',
  ]),

  // ClinVar's density puts a 100 kb window over the track's render limit;
  // `force:true` draws it, but as bare ticks with no base-change labels.
  cliSpec('hub_tracks', [
    '--genome',
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

  // the hub's Trix index resolves `--loc BRCA1`
  cliSpec('gene_name_search', [
    '--genome',
    'hg19',
    '--track',
    'ncbiRefSeqCurated',
    '--loc',
    'BRCA1',
    '--width',
    '1200',
  ]),

  // Without `--track` this renders an empty ruler: a config defines tracks
  // but opens none.
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

  // the only figure covering a session in the `init` form
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

  cliSpec('snpcov', [
    '--fasta',
    'data/volvox/volvox.fa',
    '--bam',
    'data/volvox/volvox-sorted.bam',
    'pileup.show=false',
    'coverage.height=200',
    'height:200',
    '--loc',
    'ctgA:1-20000',
    '--width',
    '1200',
  ]),

  cliSpec('skbr3_cov', [
    '--loc',
    'all',
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--bigwig',
    'https://jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.regions.bw',
    'encoding.y.scale.type=log',
    'mark=point',
    'data.resolution=100',
    'height:400',
    'color:purple',
    'encoding.y.scale.domainMin=1',
    'encoding.y.scale.domainMax=1024',
    '--width',
    '1900',
  ]),

  // The two halves differ only in the track, so they compare line for line.
  // The plugin dashes a connector whose read has a supplementary alignment
  // outside the view, so the chr10 panel keeps every connector solid
  // (agent-docs/reference/SV_MULTIHOP.md). The byte gate refuses the 200x ONT
  // chr3 panel without `force:true`.
  cliSpec('sv_review_tumor', svReviewHalf('COLO829_tumor_ont')),
  cliSpec('sv_review_normal', svReviewHalf('COLO829BL_normal_ont')),

  // The heights make this panel as tall as the sample panels (679 px), so
  // `+append` pads nothing and the three captions stay on one line. Check the
  // rendered height after a change: a track's box is not its `height:` plus a
  // constant.
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

export const jbrowseImgComposedSpecs: ScreenshotSpec[] = [
  // The pills sit in the bottom-left corner, which is white in all three
  // parts.
  {
    mode: 'compose',
    name: 'jbrowse-img/sv_review_pair',
    parts: [
      'jbrowse-img/sv_review_tumor',
      'jbrowse-img/sv_review_normal',
      'jbrowse-img/sv_review_derivative',
    ],
    columns: 3,
    annotations: [
      // fontSize 22 in this 1x composition; app captures are 2x, so the same
      // number draws half as large there (see ComposeSpec)
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

  ...Object.keys(SV_SHEET_ROWS).map((row): ScreenshotSpec => ({
    mode: 'compose',
    name: `jbrowse-img/sv_sheet_${row}`,
    parts: Object.keys(SV_SHEET_SAMPLES).map(
      sample => `jbrowse-img/sv_sheet_${row}_${sample}`,
    ),
    columns: Object.keys(SV_SHEET_SAMPLES).length,
  })),
  {
    mode: 'compose',
    name: 'jbrowse-img/sv_callset_sheet',
    parts: Object.keys(SV_SHEET_ROWS).map(row => `jbrowse-img/sv_sheet_${row}`),
    gutter: 40,
    annotations: Object.values(SV_SHEET_ROWS).map(({ file }, i) => ({
      type: 'text' as const,
      text: file,
      maxWidth: 800,
      fontSize: 22,
      anchor: {
        selector: `[data-part="${i}"]`,
        alignX: 'left' as const,
        alignY: 'bottom' as const,
        dx: 20,
        dy: -20,
      },
    })),
  },
]
