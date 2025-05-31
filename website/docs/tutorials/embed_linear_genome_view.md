---
id: embed_linear_genome_view
title: Embedding JBrowse
---

import Figure from '../figure'

## Welcome!

This tutorial will show you how to get a JBrowse 2 linear genome view embedded
in a website.

This tutorial will set you up with just the "linear genome view" component in a
way that you can copy and paste onto your webpage

Please note: this tutorial only sets up the embedded linear genome view
component. See our jbrowse-web [quickstart_web](/docs/quickstart_web) for the
"full application"

<Figure caption="JBrowse Linear Genome View in a web page" src="/img/embed_linear_genome_view/final.png"/>

## What you need

You can do most of this tutorial with a simple text editor and some way to serve
files (just opening the HTML files we create in a browser won't work, you'll
need a server).

If you have Node.js installed, you can run a simple server by opening your
terminal in the directory you want to serve and running `npx serve` (or you can
install it globally with `npm install -g serve` and then run `serve`).

## Create a simple web page

Let's get started!

The first thing we're going to do is create a simple web page into which we can
embed JBrowse Linear Genome View.

First, create a folder to put the files in. Inside that folder, create a new
file called "index.html" and open it in your preferred text editor/IDE. Paste
the following into the file and save it:

```html title="index.html"
<html>
  <body>
    <h1>Hello world!</h1>
  </body>
</html>
```

## Start the server

Open your terminal and navigate to the folder where you saved your "index.html".
From there, run the command `npx serve`. It should print out a message that
looks something like this:

```

   Serving!

   Local:  http://localhost:5000

   Copied local address to clipboard!

```

Now open your web browser and navigate to the url (e.g.
[http://localhost:5000](http://localhost:5000)) You should see a web page that
says "Hello world!"

## Adding JBrowse

To get right to business, here is a complete example of a working linear genome
view, replace your index.html file with the contents below

```html title="index.html"
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>JBrowse Linear Genome View</title>

    <script
      src="https://unpkg.com/@jbrowse/react-linear-genome-view2@3.5.0/dist/react-linear-genome-view.umd.production.min.js"
      crossorigin
    ></script>
  </head>

  <body>
    <div id="jbrowse_linear_genome_view"></div>

    <script>
      const { React, createRoot, createViewState, JBrowseLinearGenomeView } =
        JBrowseReactLinearGenomeView

      const state = new createViewState({
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
            adapter: {
              type: 'Gff3TabixAdapter',
              uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
            },
          },
        ],
        defaultSession: {
          name: 'My session',
          view: {
            id: 'linearGenomeView',
            type: 'LinearGenomeView',
            init: {
              assembly: 'hg38',
              loc: '10:29,838,565..29,838,850',
              tracks: ['ncbi_genes'],
            },
          },
        },
      })

      const root = createRoot(
        document.getElementById('jbrowse_linear_genome_view'),
      )
      root.render(
        React.createElement(JBrowseLinearGenomeView, {
          viewState: state,
        }),
      )
    </script>
  </body>
</html>
```

You can see a couple of notable things in the above script:

- We import the JBrowse script in the `<head>` of the page. This creates a
  global variable `JBrowseReactLinearGenomeView` that we use in our script. In
  this code snippet
- We point directly at a CDN (the unpkg URL) but you can also download this file
  for later use. You can also remove the @3.5.0 part of the URL to point to the
  latest version always, but to avoid any potential breaking changes, pinning
  the version can help
- We provide an assembly, the hg38 genome assembly, as a bgzip indexed FASTA
  file
- We provide a gene track, which is a tabix indexed GFF3 file
- We provide a 'default session' to navigate to a specific genomic location on
  startup

## Preparing a bgzip FASTA file

This is generally done with samtools

```bash
bgzip file.fa
samtools faidx file.fa
```

## Preparing a tabix indexed GFF3 file

We recommend using the @jbrowse/cli

```bash
npm install -g @jbrowse/cli
jbrowse --version # ensure the 'jbrowse' command works
jbrowse sort-gff myfile.gff > myfile.sorted.gff
bgzip myfile.sorted.gff
tabix myfile.sorted.gff.gz
```

## Preparing text searching for your GFF file

You can use the @jbrowse/cli tool to create a text search index with a command
like this:

```
jbrowse text-index --file file1.gff.gz --fileId ncbi_genes
```

This will produce a ".ix" and ".ixx" file (and a meta.json file, which is
unused)

You can add these to a "per-track text search adapter", which is seen below

## A more elaborate example

Here is an example of the createViewState that you could replace in the above
code snippet that includes some more track types, including

- VCF
- BigWig
- BigBed,
- BAM
- CRAM

```typescript
const state = new createViewState({
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
      textSearching: {
        textSearchAdapter: {
          type: 'TrixTextSearchAdapter',
          textSearchAdapterId: 'gff3tabix_genes-index',
          uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ix',
          assemblyNames: ['GRCh38'],
        },
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

        sequenceAdapter: {
          type: 'BgzipFastaAdapter',
          uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
        },
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
    {
      type: 'AlignmentsTrack',
      trackId: 'skbr3_pacbio',
      name: 'SKBR3 pacbio',
      assemblyNames: ['hg38'],
      adapter: {
        type: 'BamAdapter',
        uri: 'https://jbrowse.org/genomes/GRCh38/skbr3/SKBR3_Feb17_GRCh38.sorted.bam',
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
          'skbr3_pacbio',
          '1000g_vcf',
        ],
      },
    },
  },
})
```

Notes about the above config:

- The CRAM track contains a reference to the sequence adapter. This currently
  must be done for CRAM, and also for BAM tracks that do not have an MD tag
  (e.g. from samtools calmd)

- The configs we discussed so far assume e.g. that the BAM index will be
  bamFile+'.bai'. The full configuration schema allows handling cases where the
  bai is in a different place. Our auto-generated config docs have more info.

## Further reading

This tutorial above is just a simple example to get you started. There is much
more you can do with this component, such as programmatically controlling it,
customizing it, and more. Here is some further reading

- Link to a live example of the instance set up above
  https://jbrowse.org/demos/lgv-vanillajs/ (source code:
  https://github.com/GMOD/jbrowse-react-linear-genome-view-vanillajs-demo)

- Storybook documentation for the linear genome view component, which describes
  many of the customizations you can do https://jbrowse.org/storybook/lgv/main/

- You can also see the "@jbrowse/react-app2" component, which is like this
  tutorial, but it allows loading multiple assemblies, showing synteny, etc
  https://jbrowse.org/demos/app-vanillajs (also has storybook docs
  https://jbrowse.org/storybook/app/main/)

- As mentioned earlier, the embedded components If you haven't checked it out,
  the "jbrowse-web" quickstart guide here is our main suggestion for deployment
  https://jbrowse.org/jb2/docs/quickstart_web/
