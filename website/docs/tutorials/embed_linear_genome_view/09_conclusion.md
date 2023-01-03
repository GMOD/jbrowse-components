---
id: 09_conclusion
title: Conclusion
---

## That's it!

Congratulations, you've embedded JBrowse 2 in a web page! Now you can start to
experiment and explore. Some things to try might be:

- Add two views to the same web page
- Find your own files to add as tracks
- Explore the [configuration guide](/docs/config_guide) and learn how to do
  things like customize the colors of features in your tracks

Let us know how things go. We'd love to hear your feedback or help you in any
way we can. Our contact information can be found [here](/contact).

Happy hacking!

## Production note

This tutorial relies on the development builds of React and the JBrowse Linear
Genome View. You should use the production builds in your final product. You
would do this by replacing the `src` inside the `<script>` tag in your
"index.html". Here are the development builds and their production equivalents:

- React
  - Development: https://unpkg.com/react@16/umd/react.development.js
  - Production: https://unpkg.com/react@16.14.0/umd/react.production.min.js
- ReactDOM
  - Development:
    https://unpkg.com/react-dom@16.14.0/umd/react-dom.development.js
  - Production:
    https://unpkg.com/react-dom@16.14.0/umd/react-dom.production.min.js
- JBrowseReactLinearGenomeView
  - Development:
    https://unpkg.com/@jbrowse/react-linear-genome-view/dist/react-linear-genome-view.umd.development.js
  - Production:
    https://unpkg.com/@jbrowse/react-linear-genome-view/dist/react-linear-genome-view.umd.production.min.js

## Reference

For reference, here are the final versions of the files we created in this
tutorial:

<details>
  <summary>index.html</summary>
  <p>

```html title="index.html"
<html>
  <head>
    <script
      src="//unpkg.com/react@16/umd/react.development.js"
      crossorigin
    ></script>
    <script
      src="//unpkg.com/react-dom@16/umd/react-dom.development.js"
      crossorigin
    ></script>
    <script
      src="//unpkg.com/@jbrowse/react-linear-genome-view/dist/react-linear-genome-view.umd.development.js"
      crossorigin
    ></script>
  </head>

  <body>
    <h1>We're using JBrowse Linear Genome View!</h1>
    <button data-type="gene_button" data-location="10:94762681..94855547">
      CYP2C19
    </button>
    <button data-type="gene_button" data-location="13:32315086..32400266">
      BRCA2
    </button>
    <div id="jbrowse_linear_genome_view"></div>
    <script type="module">
      import assembly from './assembly.js'
      import tracks from './tracks.js'
      const { createViewState, JBrowseLinearGenomeView } =
        JBrowseReactLinearGenomeView
      const { createElement } = React
      const { render } = ReactDOM
      const updates = document.getElementById('update')
      const state = new createViewState({
        assembly,
        tracks,
        onChange: patch => {
          updates.innerHTML += JSON.stringify(patch) + '\n'
        },
        location: '1:100,987,269..100,987,368',
        defaultSession: {
          name: 'my session',
          view: {
            id: 'linearGenomeView',
            type: 'LinearGenomeView',
            tracks: [
              {
                id: 'IpTYJKmsp',
                type: 'ReferenceSequenceTrack',
                configuration: 'GRCh38-ReferenceSequenceTrack',
                displays: [
                  {
                    id: 's877wHWtzD',
                    type: 'LinearReferenceSequenceDisplay',
                    configuration:
                      'GRCh38-ReferenceSequenceTrack-LinearReferenceSequenceDisplay',
                  },
                ],
              },
            ],
          },
        },
      })
      function navTo(event) {
        state.session.view.navToLocString(event.target.dataset.location)
      }
      const buttons = document.getElementsByTagName('button')
      for (const button of buttons) {
        if (button.dataset.type === 'gene_button') {
          button.addEventListener('click', navTo)
        }
      }
      const textArea = document.getElementById('session')
      document.getElementById('showsession').addEventListener('click', () => {
        textArea.innerHTML = JSON.stringify(state.session, undefined, 2)
      })
      render(
        createElement(JBrowseLinearGenomeView, { viewState: state }),
        document.getElementById('jbrowse_linear_genome_view'),
      )
    </script>
    <button id="showsession">Show current session</button>
    <textarea id="session" name="session" rows="20" cols="80"></textarea>
    <p>updates:</p>
    <textarea
      id="update"
      name="update"
      rows="5"
      cols="80"
      wrap="off"
    ></textarea>
  </body>
</html>
```

  </p>
</details>

<details>
  <summary>assembly.js</summary>
  <p>

```javascript title="assembly.js"
export default {
  name: 'GRCh38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'GRCh38-ReferenceSequenceTrack',
    adapter: {
      type: 'BgzipFastaAdapter',
      fastaLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
        locationType: 'UriLocation',
      },
      faiLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz.fai',
        locationType: 'UriLocation',
      },
      gziLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz.gzi',
        locationType: 'UriLocation',
      },
    },
  },
  aliases: ['hg38'],
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      location: {
        uri: 'http://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/GRCh38.aliases.txt',
        locationType: 'UriLocation',
      },
    },
  },
}
```

  </p>
</details>

<details>
  <summary>tracks.js</summary>
  <p>

```javascript title="tracks.js"
export default [
  {
    type: 'FeatureTrack',
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
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
          locationType: 'UriLocation',
        },
        faiLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz.fai',
          locationType: 'UriLocation',
        },
        gziLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz.gzi',
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

  </p>
</details>
