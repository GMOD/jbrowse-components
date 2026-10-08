---
title: Embedding JBrowse
description: Embed the linear genome view component in a custom web page
guide_category: Tutorials
tutorial_category: Configuration & embedding
---

We embed a JBrowse linear genome view in a web page with one `<script>` tag and
no build step. The `<LinearGenomeView>` component takes three objects,
`assembly`, `tracks` and `view`, and draws the genome browser from them.

## Prerequisites

- a text editor
- a local HTTP server, because the page fetches its data over HTTP.
  `npx serve -S` in the folder works (`-S` resolves symlinks, so a data file you
  symlink in still loads)

## Embed a linear genome view with one script tag {#quick-start}

Save this page as `index.html`:

```html title="index.html"
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>JBrowse Linear Genome View</title>
    <script
      src="https://unpkg.com/@jbrowse/react-linear-genome-view2@next/dist/react-linear-genome-view.umd.production.min.js"
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
        geneticCodes: { chrM: 2 },
      }

      const tracks = [
        {
          trackId: 'ncbi_genes',
          name: 'NCBI RefSeq Genes',
          uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
        },
      ]

      const view = {
        loc: '10:29,838,565..29,838,850',
        tracks: ['ncbi_genes'],
      }

      const root = createRoot(
        document.getElementById('jbrowse_linear_genome_view'),
      )
      root.render(
        React.createElement(LinearGenomeView, { assembly, tracks, view }),
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

Open the URL `serve` prints.

<Figure caption="The complete example below embedded in a web page, with genes, exome reads, conservation and 1000 Genomes calls at the tutorial's chr10 locus." src="/img/embed_linear_genome_view/final.png"/>

The `@next` tag fetches the newest v5 prerelease, which the `assembly` and
`tracks` shorthand above needs, so pin a version for production
(`@jbrowse/react-linear-genome-view2@5.0.0-beta.11/dist/...`). For other view
types, a different bundler, or working demo repos, see
[](/docs/embedded_components).

## Using your own data files in the embedded view

The browser fetches each file itself, so each file has to be reachable and
indexed:

- A relative `uri` such as `uri: 'sample.bam'` resolves against the page, so
  with `npx serve -S .` a file beside `index.html` loads. Use a full URL for a
  file hosted elsewhere.
- A BAM, CRAM, VCF or GFF is indexed (`.bai`, `.crai`, `.tbi`, `.csi`) with the
  index beside the file under the same name plus its suffix. A VCF or GFF is
  bgzipped; a FASTA has its `.fai`, and a bgzipped one its `.gzi`.
- A file on another origin needs CORS headers allowing the page's origin and
  `Range` requests, since the browser reads slices rather than whole files.
- Sequence names in tracks match the assembly's, or the assembly's
  `refNameAliases` map them.

Prep your own data files with the
[web quickstart](/docs/quickstart_web#adding-tracks) recipes.

## Using the component in a React app

In a React app, pass the same `assembly`, `tracks`, and `view` as props:

```jsx
import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

function GenomeBrowser() {
  return <LinearGenomeView assembly={assembly} tracks={tracks} view={view} />
}
```

The component reads its props once, on mount. To navigate or show a track from
code afterwards, take a `ref` or use `useCreateViewState`, which builds the same
view state as a hook.

The `useCreateViewState` hook returns `undefined` for the first frame while the
view and display types load, so render nothing until then:

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
  geneticCodes: { chrM: 2 },
}

const tracks = [
  {
    trackId: 'ncbi_genes',
    name: 'NCBI RefSeq Genes',
    category: ['Genes'],
    uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
    textSearching: {
      textSearchAdapter: {
        uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ix',
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

const view = {
  loc: '10:29,838,565..29,838,850',
  tracks: ['ncbi_genes', 'NA12878_exome', 'phyloP100way', '1000g_vcf'],
}
```

Drop these into the `index.html` from [Quick start](#quick-start) in place of
the smaller `assembly`/`tracks`/`view`.

- CRAM decodes reads against the assembly's sequence, which the component takes
  from the enclosing assembly. See the
  [alignments track config guide](/docs/config_guides/alignments_track).
- JBrowse looks for the index next to the data file; add `index` or `type`
  beside `uri` to override the guess.
- `textSearching` on `ncbi_genes` adds name search; build your own index with
  [`jbrowse text-index`](/docs/quickstart_web#indexing-feature-names-for-searching).

</details>

## See also

- [](/docs/embedded_components)
- [](/docs/config_guides/assemblies)
- [](/docs/config_guides/tracks)
- [LGV storybook](https://jbrowse.org/storybook/lgv/)
- [](/docs/jbrowse_anywidget)
- [](/docs/jbrowser)
- [](/docs/tutorials/cli_desktop)
- [](/docs/tutorials/display_settings)
