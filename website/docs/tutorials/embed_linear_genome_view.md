---
title: Embedding JBrowse
description: Embed the linear genome view component in a custom web page
guide_category: Tutorials
---

This tutorial embeds a single JBrowse linear genome view into a web page using a
`<script>` tag — no build step or React project required. For the full JBrowse
app, see the [web quickstart](/docs/quickstart_web) instead.

The [LGV storybook](https://jbrowse.org/storybook/lgv/) has the most complete
set of live, runnable examples for this component. To embed other view types
(synteny, dotplot, circular) or use a different bundler, see
[Embedded components](/docs/embedded_components).

<Figure caption="JBrowse linear genome view in a web page" src="/img/embed_linear_genome_view/final.png"/>

## What you need

A text editor and a local HTTP server. JBrowse won't load if you open the HTML
file directly — it needs to be served. If you have Node.js installed,
`npx serve -S` in the directory works.

## Create a web page

Create a folder, then an `index.html` inside it with this content:

```html title="index.html"
<html>
  <body>
    <h1>Hello world!</h1>
  </body>
</html>
```

## Start the server

In the folder, run `npx serve -S`. It prints a local URL (typically
`http://localhost:3000`). Open it in your browser — you should see "Hello
world!".

The `-S` flag tells `serve` to resolve symlinks rather than return a 404, so
data files you symlink into the folder will load.

## Preparing a bgzip FASTA file

This is generally done with samtools:

```bash
bgzip file.fa
samtools faidx file.fa.gz
```

Running `samtools faidx` on the bgzipped file produces both the `.fa.gz.fai` and
`.fa.gz.gzi` indexes that the `BgzipFastaAdapter` needs.

## Preparing a tabix indexed GFF3 file

We recommend the [@jbrowse/cli](/docs/cli):

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

```bash
jbrowse text-index --file file1.gff.gz --fileId ncbi_genes
```

This produces `.ix` and `.ixx` files plus a `_meta.json` file (all three are
used by the text-search adapter).

You can add these to a "per-track text search adapter", as shown in the more
elaborate example below.

## Setup

Pass the assembly, tracks, and an initial session to `createViewState`. This
example wires up an hg38 genome with gene, repeat, alignment, variant, and
conservation tracks:

```typescript
const state = createViewState({
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
          assemblyNames: ['hg38'],
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
})
```

Notes about the above config:

- CRAM tracks need the assembly's sequence to decode reads, but JBrowse supplies
  it automatically from the enclosing assembly, so no manual `sequenceAdapter`
  is required (the same applies to BAM tracks that lack an MD tag, e.g. from
  `samtools calmd`). See the
  [alignments track config guide](/docs/config_guides/alignments_track).

- The configs above use the `uri` shorthand, which assumes each index sits next
  to its data file (e.g. `file.cram.crai`). To place an index elsewhere, use the
  full adapter form — see the
  [auto-generated config reference](/docs/config_guide).

## Using the component in a React app

If you are using `@jbrowse/react-linear-genome-view2` as an NPM package in a
React app (rather than the UMD script tag approach above), import
`useCreateViewState` instead of calling `createViewState` directly in your
component body. `createViewState` is expensive and should not run on every
render:

```js
import {
  useCreateViewState,
  JBrowseLinearGenomeView,
} from '@jbrowse/react-linear-genome-view2'

function GenomeBrowser() {
  const state = useCreateViewState({ assembly, tracks, location: '...' })
  return <JBrowseLinearGenomeView viewState={state} />
}
```

The hook creates the view state once on mount and keeps it stable across
re-renders, so panning, zooming, and parent state changes do not reset the
browser.

## See also

- [Configuring assemblies](/docs/config_guides/assemblies) — the bgzip-FASTA and
  refname-aliasing setup used above
- [Configuring tracks](/docs/config_guides/tracks) — common track config and the
  `displayDefaults` shorthand
- [Supported file types](/docs/config_guides/file_types) — per-format adapters
  and the tabix/bgzip prep steps
- [Text searching](/docs/config_guides/text_searching) — building the trix
  indexes referenced above
- [Vanilla JS demo](https://jbrowse.org/demos/lgv-vanillajs/) — a live example
  of the instance set up above
  ([source](https://github.com/GMOD/jbrowse-react-linear-genome-view-vanillajs-demo))
- [LGV storybook](https://jbrowse.org/storybook/lgv/) — runnable examples
  covering most of the component's customizations
- [Embedded components](/docs/embedded_components) — every embedded package
  (app, linear, circular) plus ready-to-clone bundler demos (Vite, Next.js,
  rsbuild, vanilla JS)
- [@jbrowse/react-app2 demo](https://jbrowse.org/demos/app-vanillajs) — like
  this tutorial but supports multiple assemblies, synteny, and more
  ([storybook](https://jbrowse.org/storybook/app/))
- [Web quickstart](/docs/quickstart_web) — a full JBrowse deployment, with the
  shareable session URLs, track hub connections, and admin panel that the
  embedded components don't provide
