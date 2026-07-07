import type {
  ScreenshotSpec,
} from '../screenshot-spec-types.ts'

export const embeddedSpecs: ScreenshotSpec[] = [

  // The embed tutorial's hero figure: the *embedded*
  // `@jbrowse/react-linear-genome-view2` component (not the jbrowse-web app),
  // captured from its prebuilt UMD bundle via the script-tag setup the tutorial
  // documents. `viewState` mirrors the hg38 config in
  // docs/tutorials/embed_linear_genome_view.md verbatim (gene / repeat /
  // alignment / variant / conservation tracks at the MYD88 locus). Remote hg38
  // data (jbrowse.org + UCSC phyloP) — long ready timeout + settle, and a
  // relaxed diff gate since remote-timing jitter is irreducible.
  {
    mode: 'embedded',
    name: 'embed_linear_genome_view/final',
    viewState: {
      assembly: {
        name: 'hg38',
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'GRCh38-ReferenceSequenceTrack',
          adapter: {
            type: 'BgzipFastaAdapter',
            uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
          },
        },
        refNameAliases: {
          adapter: {
            type: 'RefNameAliasAdapter',
            uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
          },
        },
        cytobands: {
          adapter: {
            type: 'CytobandAdapter',
            uri: 'https://jbrowse.org/genomes/GRCh38/cytoBand.txt',
          },
        },
      },
      tracks: [
        {
          type: 'FeatureTrack',
          trackId: 'ncbi_genes',
          name: 'NCBI RefSeq Genes',
          assemblyNames: ['hg38'],
          category: ['Genes'],
          adapter: {
            type: 'Gff3TabixAdapter',
            uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
          },
        },
        {
          type: 'FeatureTrack',
          trackId: 'repeats_hg38',
          name: 'Repeats',
          assemblyNames: ['hg38'],
          category: ['Annotation'],
          adapter: {
            type: 'BigBedAdapter',
            uri: 'https://jbrowse.org/genomes/GRCh38/repeats.bb',
          },
        },
        {
          type: 'AlignmentsTrack',
          trackId: 'NA12878_exome',
          name: 'NA12878 Exome',
          assemblyNames: ['hg38'],
          category: ['1000 Genomes', 'Alignments'],
          adapter: {
            type: 'CramAdapter',
            uri: 'https://jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
          },
        },
        {
          type: 'VariantTrack',
          trackId: '1000g_vcf',
          name: '1000 Genomes Variant Calls',
          assemblyNames: ['hg38'],
          category: ['1000 Genomes', 'Variants'],
          adapter: {
            type: 'VcfTabixAdapter',
            uri: 'https://jbrowse.org/genomes/GRCh38/variants/ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf.gz',
          },
        },
        {
          type: 'QuantitativeTrack',
          trackId: 'phyloP100way',
          name: 'hg38.100way.phyloP100way',
          category: ['Conservation'],
          assemblyNames: ['hg38'],
          adapter: {
            type: 'BigWigAdapter',
            uri: 'https://hgdownload.cse.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
          },
        },
      ],
      defaultSession: {
        name: 'My session',
        margin: 0,
        view: {
          id: 'linearGenomeView',
          type: 'LinearGenomeView',
          init: {
            assembly: 'hg38',
            loc: '10:29,838,565..29,838,850',
            tracks: [
              'GRCh38-ReferenceSequenceTrack',
              'ncbi_genes',
              'NA12878_exome',
              'phyloP100way',
              '1000g_vcf',
            ],
          },
        },
      },
    },
    readyText: 'NCBI RefSeq Genes',
    readyTimeout: 90000,
    settleMs: 15000,
    viewportWidth: 1200,
    viewportHeight: 1000,
    diffThreshold: 0.02,
  },
]
