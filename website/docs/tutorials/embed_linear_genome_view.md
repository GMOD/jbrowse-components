---
title: Embedding JBrowse
description: Embed the linear genome view component in a custom web page
guide_category: Tutorials
tutorial_category: Configuration & embedding
---

**TL;DR:** one `<script>` tag and no build step. Drop `assembly`, `tracks`, and
`init` into `<LinearGenomeView>` and it owns the view engine itself.

## Prerequisites

- a text editor
- a local HTTP server: opening the HTML file directly won't work, JBrowse needs
  it served. `npx serve -S` in the folder works (`-S` resolves symlinks, so a
  data file you symlink in still loads)

## The finished embedded view

<Figure caption="JBrowse linear genome view in a web page" src="/img/embed_linear_genome_view/final.png"/>

For other view types, a different bundler, or working demo repos, see
[](/docs/embedded_components). The
[LGV storybook](https://jbrowse.org/storybook/lgv/) has copy-pasteable examples
for everything beyond a basic view.

## Quick start

Save as `index.html`:

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
          trackId: 'ncbi_genes',
          name: 'NCBI RefSeq Genes',
          uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
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

A `tracks` entry's shortest form is `{ trackId, uri }`: type and adapter come
from the file's extension, `assemblyNames` from the one `assembly` above (see
[the shortest track](/docs/config_guides/tracks#the-shortest-track)).

```bash
npx serve -S .
```

Open the URL it prints. Pin a version for production
(`@jbrowse/react-linear-genome-view2@4.3.0/dist/...`) rather than always
fetching latest from unpkg.

Prep your own data files with the
[web quickstart](/docs/quickstart_web#adding-tracks) recipes. For more tracks,
more track types, or name search, see the
<a href="#more-complete-example">complete example</a> below.

## Using the component in a React app

Pass the same `assembly`, `tracks`, and `init` as props:

```jsx
import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

function GenomeBrowser() {
  return <LinearGenomeView assembly={assembly} tracks={tracks} init={init} />
}
```

Props are read once on mount. To reach the view engine imperatively (navigate,
show a track), take a `ref` or use `useCreateViewState`, which builds the same
view state as a hook. It is `undefined` for the first frame, while the view and
display types the options name load, so render nothing until then:

```js
import {
  useCreateViewState,
  JBrowseLinearGenomeView,
} from '@jbrowse/react-linear-genome-view2'

function GenomeBrowser() {
  const state = useCreateViewState({ assembly, tracks, location: '...' })
  return state ? <JBrowseLinearGenomeView viewState={state} /> : null
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
    trackId: 'ncbi_genes',
    name: 'NCBI RefSeq Genes',
    category: ['Genes'],
    uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
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
    trackId: 'repeats_hg38',
    name: 'Repeats',
    category: ['Annotation'],
    uri: 'https://jbrowse.org/genomes/GRCh38/repeats.bb',
  },
  {
    trackId: 'NA12878_exome',
    name: 'NA12878 Exome',
    category: ['1000 Genomes', 'Alignments'],
    uri: 'https://jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
  },
  {
    trackId: '1000g_vcf',
    name: '1000 Genomes Variant Calls',
    category: ['1000 Genomes', 'Variants'],
    uri: 'https://jbrowse.org/genomes/GRCh38/variants/ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf.gz',
  },
  {
    trackId: 'phyloP100way',
    name: 'hg38.100way.phyloP100way',
    category: ['Conservation'],
    uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
  },
]

const init = {
  loc: '10:29,838,565..29,838,850',
  tracks: ['ncbi_genes', 'NA12878_exome', 'phyloP100way', '1000g_vcf'],
}
```

Drop these into the `index.html` from [Quick start](#quick-start) in place of
the smaller `assembly`/`tracks`/`init`.

- CRAM needs the assembly's sequence to decode reads, supplied automatically
  from the enclosing assembly. See the
  [alignments track config guide](/docs/config_guides/alignments_track).
- The index is assumed to sit next to the data file; add `index` or `type`
  beside `uri` to override the guess.
- `textSearching` on `ncbi_genes` powers name search; build your own index with
  [`jbrowse text-index`](/docs/quickstart_web#indexing-feature-names-for-searching).

</details>

## See also

- [](/docs/embedded_components)
- [](/docs/config_guides/assemblies)
- [](/docs/config_guides/tracks)
- [LGV storybook](https://jbrowse.org/storybook/lgv/)
- [](/docs/jbrowse_anywidget)
- [](/docs/jbrowser)
