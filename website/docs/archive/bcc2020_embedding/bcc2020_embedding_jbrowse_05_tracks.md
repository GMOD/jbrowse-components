---
id: bcc2020_embedding_jbrowse_05_tracks
title: About tracks
---

:::danger

Out of date Please see the
[updated version of this tutorial](/docs/tutorials/embed_linear_genome_view/01_introduction)

:::

## What is a track?

A track is the place to display your data files in JBrowse Linear View. For this
tutorial we're going to add a gene track, an
[alignments track](/docs/user_guides/alignments_track), and a
[variants track](/docs/user_guides/variant_track). We're just going to use basic
configuration, but check the links for the track types to see what kinds of
things you can configure in them.

## Adding tracks

### Gathering data

For genes, we'll use a
[GFF3](https://github.com/The-Sequence-Ontology/Specifications/blob/5c119af6316ccfbc6975af86d0e34157226d208d/gff3.md)
file of the [NCBI RefSeq](https://www.ncbi.nlm.nih.gov/refseq/) human genes. The
link is
https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz

For alignments, we're going to use on the 1000 Genomes sample
[NA12878](https://www.internationalgenome.org/data-portal/sample/NA12878). We'll
use a [CRAM](https://samtools.github.io/hts-specs/CRAMv3.pdf) file
([BAM](https://samtools.github.io/hts-specs/SAMv1.pdf) is also supported), and
the link is
https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram

For variants, we'll use a
[VCF](https://samtools.github.io/hts-specs/VCFv4.3.pdf) of the 1000 Genomes
variant calls (note that this VCF contains all samples, not just NA12878). The
link is
https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/variants/ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf.gz

### Creating track configurations with the CLI

```sh
jbrowse add-track https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz --name "NCBI RefSeq Genes" --category "Genes" --config '{"renderer": {"type": "SvgFeatureRenderer"}}' --skipCheck
jbrowse add-track https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram --name "NA12878 Exome" --category "1000 Genomes, Alignments" --skipCheck
jbrowse add-track https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/variants/ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf.gz --name "1000 Genomes Variant Calls" --category "1000 Genomes, Variants" --skipCheck
```

Open "config.json" again and look at the tracks that were generated. You can see
that again, it has guessed index locations for you, which you can change if
needed. Create a new file called "tracks.js" and copy the tracks array into it
and have it exported, like this:

```javascript title="tracks.js"
export default [
  {
    type: 'BasicTrack',
    trackId:
      'GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff',
    name: 'NCBI RefSeq Genes',
    category: ['Genes'],
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
        locationType: 'UriLocation',
      },
      index: {
        location: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.tbi',
          locationType: 'UriLocation',
        },
        indexType: 'TBI',
      },
    },
    renderer: {
      type: 'SvgFeatureRenderer',
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
    name: 'NA12878 Exome',
    category: ['1000 Genomes', 'Alignments'],
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'CramAdapter',
      cramLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
        locationType: 'UriLocation',
      },
      craiLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram.crai',
        locationType: 'UriLocation',
      },
      sequenceAdapter: {
        type: 'BgzipFastaAdapter',
        fastaLocation: {
          uri: 'http://ftp.ensembl.org/pub/release-100/fasta/homo_sapiens/dna_index/Homo_sapiens.GRCh38.dna.toplevel.fa.gz',
          locationType: 'UriLocation',
        },
        faiLocation: {
          uri: 'http://ftp.ensembl.org/pub/release-100/fasta/homo_sapiens/dna_index/Homo_sapiens.GRCh38.dna.toplevel.fa.gz.fai',
          locationType: 'UriLocation',
        },
        gziLocation: {
          uri: 'http://ftp.ensembl.org/pub/release-100/fasta/homo_sapiens/dna_index/Homo_sapiens.GRCh38.dna.toplevel.fa.gz.gzi',
          locationType: 'UriLocation',
        },
      },
    },
  },
  {
    type: 'VariantTrack',
    trackId:
      'ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf',
    name: '1000 Genomes Variant Calls',
    category: ['1000 Genomes', 'Variants'],
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'VcfTabixAdapter',
      vcfGzLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/variants/ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf.gz',
        locationType: 'UriLocation',
      },
      index: {
        location: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/variants/ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf.gz.tbi',
          locationType: 'UriLocation',
        },
        indexType: 'TBI',
      },
    },
  },
]
```

Now update "index.html" to import this file.

```html {11} title="index.html"
<html>
  <head>
    <script src="//s3.amazonaws.com/jbrowse.org/jb2_releases/jbrowse-linear-view/jbrowse-linear-view@v0.0.1-beta.0/umd/jbrowse-linear-view.js"></script>
  </head>

  <body>
    <h1>We're using JBrowse Linear View!</h1>
    <div id="jbrowse_linear_view"></div>
    <script type="module">
      import assembly from './assembly.js'
      import tracks from './tracks.js'
    </script>
  </body>
</html>
```
