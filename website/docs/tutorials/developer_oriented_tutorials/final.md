---
id: embed_linear_genome_view2
title: Embed linear genome view
---

import CodeBlock from '@theme/CodeBlock';

<!-- prettier-ignore -->
export const Link = ({ extra, children }) => {
  return <CodeBlock language="html">

{`

<html>
  <head>
    <script src="https:///unpkg.com/@jbrowse/react-linear-genome-view2@${config.customFields.currentVersion}/dist/react-linear-genome-view.umd.development.js" crossorigin></script>
  </head>
  <body>
    <h1>Hello world! We're using JBrowse Linear Genome View!</h1>
    <div id="jbrowse_linear_genome_view"></div>
    <script type="module">
    const { React, createRoot, createViewState, JBrowseLinearGenomeView } =
  JBrowseReactLinearGenomeView

const state = new createViewState({ assembly: { type:'BgzipFastaAdapter',
uri:'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz' },
tracks: [
{type:'FeatureTrack',adapter:{type:'Gff3TabixAdapter',uri:'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz'}}
], location: 'chr1:500,000-510,000', }) const root=
document.getElementById('jbrowse_linear_genome_view'), root.render(
React.createElement(JBrowseLinearGenomeView, { viewState: state }), )

</script>
  </body>
</html>`}
</CodeBlock>

}

import config from '../../../docusaurus.config.json'

import Figure from '../../figure'

## Welcome!

This tutorial will help you embed the JBrowse linear genome view component on
your webpage. It will use a simple script tag, and plain javascript that you can
copy and paste to your webpage.

If you are experienced with installing packages from NPM, you can also see
[our embedded components](/embedded_components) page for demos and storybook
examples

## What you need

- Optional: node.js
- Text editor
- Web server (e.g. nginx, apache2, or running a local server with `npx serve`)

## Create a simple web page

Let's get started! The first thing we're going to do is to create a HTML file
with a `script` tag pointing to the JBrowse react linear genome view script on a
CDN.

Create your "index.html" so matches what's below, then save it, switch over to
your browser, and refresh the page.

<Link/>

This will just say "Hello world!" but won't show anything. we will now add
initialization

## Initialize the genome

Now we need to actually create the view. The code to do so looks like this:

```

  </body>
</html>
```

## Rendering

Now that our state is created, we can add the code that renders it into our
page. This is done using React's `createElement` and `render`.

```html {27-28,34-37} title="index.html"
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
    <div id="jbrowse_linear_genome_view"></div>
    <script type="module">
      import assembly from './assembly.js'
      import tracks from './tracks.js'
      const { createViewState, JBrowseLinearGenomeView } =
        JBrowseReactLinearGenomeView
      const { createElement } = React
      const { render } = ReactDOM
      const state = new createViewState({
        assembly,
        tracks,
        location: '1:100,987,269..100,987,368',
      })
      render(
        createElement(JBrowseLinearGenomeView, { viewState: state }),
        document.getElementById('jbrowse_linear_genome_view'),
      )
    </script>
  </body>
</html>
```

## Try it out!

You've embedded JBrowse Linear Genome View in a web page! Now try it out. You
can open the track selector by clicking "SELECT TRACKS" or by clicking on the
icon on the far left of the navigation area. You can pan with the arrow buttons
or click and drag to move around. You can change chromosome, enter a location to
navigate to, and zoom in and out. There's also a menu button in the top left of
the view that has other display options. If you open a widget that pops up on
the screen, click anywhere outside it to close the widget.

## Controlling the view

Any action taken in the UI can also be performed programmatically. An instance
of JBrowseLinearView has an attribute called "view" that can be used to control
the state of the view. As an example, we will add some buttons on the page that
navigate to the locations of a couple of genes.

Modify "index.html" so that it looks like the following:

```html {18-23,40-48} title="index.html"
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
      const state = new createViewState({
        assembly,
        tracks,
        location: '1:100,987,269..100,987,368',
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
      render(
        createElement(JBrowseLinearGenomeView, { viewState: state }),
        document.getElementById('jbrowse_linear_genome_view'),
      )
    </script>
  </body>
</html>
```

## Now you can navigate to a gene just by clicking one of the buttons

## What is a session?

A session is a way to define what the state of the view is. By providing a
default session, you can have tracks already open when the view loads, have the
overview hidden, or set any other aspect of the state.

:::tip

If you provide "location" when constructing the view, it will override the
location defined in the defaultSession.

:::

## What does a session look like?

To provide a default session, pass an object like this to `defaultSession` in
`createViewState`:

```javascript
{
  name: 'aNameHere', // it doesn't really matter what name you use
  view: { /* view object here */ },
}
```

So how do we know what to put in the view object? We can find this by getting
JBrowse Linear Genome View in the state we want and then using that session as
the default session.

## Getting the current session

The session can be extracted by JSON stringifying the view state's `session`
attribute. We're going to add a button to our page that will show the current
session when clicked. Update "index.html" like this:

```html {49-52,58-59} title="index.html"
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
      const state = new createViewState({
        assembly,
        tracks,
        location: '1:100,987,269..100,987,368',
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
  </body>
</html>
```

Now you can navigate around the view and then click "Show current session" to
show the current state of the view. This object can be used in the
`defaultSession` to have the view show up in this state when loaded. Play around
with the view and see what in the view state of the session changes when you do
certain things.

Some of the view state entries are:

- `bpPerPx` - This is a zoom level. A smaller number is more zoomed in.
- `displayedRegions` - The extent of the areas currently in view. By default it
  will be the full extent of a single chromosome, but you can add multiple
  regions, have the regions cover only part of a chromosome, reverse the
  regions, etc.
- `hideHeader` - Whether or not the header is hidden.

Many of the options in the session you see are the defaults, so you can safely
leave them out when passing the object to `defaultSession`. As an example, add
this `defaultSession` so that the view loads with reference sequence track open
by default:

```html {39-60} title="index.html"
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
      const state = new createViewState({
        assembly,
        tracks,
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
  </body>
</html>
```

This last section covers that basics of a bit less common of a use case, so if
it doesn't apply to you, you can feel free to skip it. In the previous section,
we explored how to control what was in the JBrowse Linear Genome View from other
elements on the page. What if, however, you want an element on the page to react
to what a user does inside the JBrowse Linear Genome View? For example, update a
list of genes when they switch to another chromosome, or they scroll to a
certain position.

This is possible with the JBrowse Linear Genome View by listening to the updates
it emits. This is done with an `onChange` function that is passed to
`createViewState`.

## Set up a change listener

We are going to add a text box that adds each update as it happens. Make the
following changes to "index.html":

```html {35,39-41,86-93} title="index.html"
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

These updates are formatted as [JSON-patches](http://jsonpatch.com/), and they
describe how the session is modified with each change. Play around with the view
and watch the patches that get generated. You can see how the patches match up
with the view state that we can show. In your application, you would probably
have a callback that looks for changes on some "path" that you are interested
in, and reacts to which "op" happens on that path.

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
