---
title: Embedding JBrowse
description: Embed the linear genome view component in a custom web page
guide_category: Tutorials
tutorial_category: Configuration & embedding
---

**TL;DR:** one `<script>` tag, no build step, no `createViewState` call. Drop
`assembly`, `tracks`, and `init` into `<LinearGenomeView>` and it owns the view
engine itself.

## Prerequisites

- a text editor
- a local HTTP server: opening the HTML file directly won't work, JBrowse needs
  it served. `npx serve -S` in the folder works (`-S` resolves symlinks, so a
  data file you symlink in still loads)

## What this builds

<Figure caption="JBrowse linear genome view in a web page" src="/img/embed_linear_genome_view/final.png"/>

For the full JBrowse app instead of one view, see the
[web quickstart](/docs/quickstart_web). For other view types (synteny, dotplot,
circular), a different bundler, or working demo repos, see
[](/docs/embedded_components). The
[LGV storybook](https://jbrowse.org/storybook/lgv/) has live, copy-pasteable
examples for everything beyond a basic view: themes, per-feature colors, text
search, drawer widgets, reacting to view state, web-worker rendering.

## Quick start

Save as `index.html`, then run `npx serve -S` in the folder and open the URL it
prints:

```html title="index.html"
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>JBrowse Linear Genome View</title>
    <script
      src="https://unpkg.com/@jbrowse/react-linear-genome-view2/dist/react-linear-genome-view.umd.production.min.js"
      crossorigin
    ></script>
  </head>
  <body>
    <div id="jbrowse_linear_genome_view"></div>
    <script>
      const { React, createRoot, LinearGenomeView } =
        JBrowseReactLinearGenomeView

      const assembly = {
        name: 'hg38',
        uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
        refNameAliases: {
          uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
        },
      }

      const tracks = [
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
      ]

      const init = {
        loc: '10:29,838,565..29,838,850',
        tracks: ['ncbi_genes'],
      }

      const root = createRoot(
        document.getElementById('jbrowse_linear_genome_view'),
      )
      root.render(
        React.createElement(LinearGenomeView, { assembly, tracks, init }),
      )
    </script>
  </body>
</html>
```

The unpkg URL always fetches the latest release; pin a version for production
(e.g. `@jbrowse/react-linear-genome-view2@4.3.0/dist/...`) or download the
bundle and serve it yourself.

To serve your own data instead of the hosted hg38 example, get each file into
the indexed, compressed form JBrowse reads (bgzip and index a FASTA,
sort/bgzip/tabix a GFF3, and so on) using the recipes in the
[web quickstart](/docs/quickstart_web#adding-tracks).

For more tracks, more track types (alignments, variants, quantitative), or name
search, see the <a href="#more-complete-example">complete example</a> below,
[](/docs/embedded_components), and the
[LGV storybook](https://jbrowse.org/storybook/lgv/).

## Using the component in a React app

Pass the same `assembly`, `tracks`, and `init` as props instead:

```jsx
import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

function GenomeBrowser() {
  return <LinearGenomeView assembly={assembly} tracks={tracks} init={init} />
}
```

Props are read once on mount, so a parent re-render doesn't reset the browser.
To reach the view engine imperatively from outside (navigate, show a track),
take a `ref` (see the [LGV storybook](https://jbrowse.org/storybook/lgv/)) or
use `useCreateViewState`, which builds the same view state as a hook:

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

<details id="more-complete-example">
<summary>More complete example: multiple track types, name search</summary>

Genes, repeats, alignments, variants, and conservation together, plus a name
search index, all on the same hg38 assembly used above:

```js
const assembly = {
  name: 'hg38',
  uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
  refNameAliases: {
    uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
  },
  cytobands: {
    uri: 'https://jbrowse.org/genomes/GRCh38/cytoBand.txt',
  },
}

const tracks = [
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
      uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
    },
  },
]

const init = {
  loc: '10:29,838,565..29,838,850',
  tracks: ['ncbi_genes', 'NA12878_exome', 'phyloP100way', '1000g_vcf'],
}
```

Drop these into the same `index.html` from [Quick start](#quick-start) in place
of the smaller `assembly`/`tracks`/`init`. This is the config that produced the
screenshot at the top of this page.

Notes:

- CRAM tracks need the assembly's sequence to decode reads, but JBrowse supplies
  it automatically from the enclosing assembly, so no manual `sequenceAdapter`
  is required (the same applies to BAM tracks that lack an MD tag, e.g. from
  `samtools calmd`). See the
  [alignments track config guide](/docs/config_guides/alignments_track).
- These configs use the `uri` shorthand, which assumes each index sits next to
  its data file (e.g. `file.cram.crai`). To place an index elsewhere, use the
  full adapter form (see the
  [auto-generated config reference](/docs/config_guide)).
- The `textSearching` block on `ncbi_genes` is what powers name search; build
  the index for your own data with
  [`jbrowse text-index`](/docs/quickstart_web#indexing-feature-names-for-searching).

</details>

## See also

- [](/docs/embedded_components)
- [](/docs/config_guides/assemblies)
- [](/docs/config_guides/tracks)
- [LGV storybook](https://jbrowse.org/storybook/lgv/)
- [](/docs/jbrowse_anywidget)
- [](/docs/jbrowser)
