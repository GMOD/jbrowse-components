import { findPage, flattenExamples } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage, ExampleSection } from './exampleModel.ts'
export { section } from './exampleModel.ts'

export const pages: ExamplePage[] = [
  {
    slug: 'basic-example',
    title: 'Basic example',
    description: 'The whole app, one assembly, one track.',
    group: 'Getting started',
    sections: [{ slug: 'basic-example', title: 'Basic example' }],
  },
  {
    slug: 'with-track-shorthand',
    title: 'Tracks as an id and a uri',
    description: 'The extension picks the track type and the adapter.',
    group: 'Getting started',
    sections: [
      { slug: 'with-track-shorthand', title: 'Tracks as an id and a uri' },
    ],
  },
  {
    slug: 'customizing-the-app',
    title: 'Customizing the app',
    description: 'Theme, sizing and the web worker.',
    group: 'Getting started',
    sections: [
      {
        slug: 'dark-theme',
        title: 'Dark theme',
        description: 'palette.mode: dark.',
      },
      {
        slug: 'fit-to-container',
        title: 'Fit the app to a container',
        description: 'The --jbrowse-app-height CSS variable.',
      },
      {
        slug: 'with-web-worker',
        title: 'Web worker RPC',
        description: 'Move parsing and rendering off the main thread.',
      },
    ],
  },
  {
    slug: 'sessions',
    title: 'Sessions',
    description: 'Read the open views, share them as a link, open several.',
    group: 'Getting started',
    sections: [
      {
        slug: 'observe-session',
        title: 'Observe the session',
        description: 'An observer reading the open views.',
      },
      {
        slug: 'session-in-url',
        title: 'Put the session in the URL',
        description: 'encodeSession / decodeSession, for a sharable link.',
      },
      {
        slug: 'multi-view-session',
        title: 'Multiple views in one session',
        description: 'A circular overview above a linear detail view.',
      },
    ],
  },

  {
    slug: 'loading-config',
    title: 'Loading configuration',
    description:
      'Import or fetch a config.json, or add tracks and views later.',
    group: 'Getting started',
    sections: [
      {
        slug: 'with-import-config-json',
        title: 'Import a config.json',
        description: 'Bundled at build time.',
      },
      {
        slug: 'with-fetch-config-json',
        title: 'Fetch a config.json',
        description: 'Fetched at runtime.',
      },
      {
        slug: 'add-tracks-programmatically',
        title: 'Add tracks programmatically',
        description: 'addTrackConf, then launchTrack.',
      },
      {
        slug: 'with-launch-linear-genome-view',
        title: 'Launch a view imperatively',
        description: 'The LaunchView extension point, after mount.',
      },
    ],
  },
  {
    slug: 'plugins',
    title: 'Plugins',
    description: 'Plugins defined inline or loaded from a URL.',
    group: 'Getting started',
    sections: [
      {
        slug: 'embedded-plugin',
        title: 'Embedded (inline) plugin',
        description: 'A Plugin class from your own source.',
      },
      {
        slug: 'with-external-plugin',
        title: 'External plugin',
        description: 'loadPlugins fetches a bundle at runtime.',
      },
    ],
  },

  {
    slug: 'comparative-views',
    title: 'Comparative views',
    description: 'Synteny and dotplot views.',
    group: 'View types',
    sections: [
      {
        slug: 'synteny-example',
        title: 'Linear synteny view',
        description: 'Two assemblies and a PAF.',
      },
      {
        slug: 'dotplot-example',
        title: 'Dotplot view',
        description: 'A self-vs-self volvox dotplot.',
      },
      {
        slug: 'create-app-synteny',
        title: 'Synteny via the imperative mount',
        description: 'createApp, the mount non-React hosts wrap.',
      },
      {
        slug: 'multiway-synteny-example',
        title: 'Multi-way linear synteny view',
        description: 'Four E. coli strains from one all-vs-all PAF.',
      },
    ],
  },
  {
    slug: 'structural-variant-views',
    title: 'Structural variant views',
    description:
      'Circular, breakpoint split, spreadsheet and SV inspector views.',
    group: 'View types',
    sections: [
      {
        slug: 'circular-example',
        title: 'Circular view',
        description: 'Structural variants around the genome.',
      },
      {
        slug: 'breakpoint-split-example',
        title: 'Breakpoint split view',
        description: 'One structural variant across two regions.',
      },
      {
        slug: 'spreadsheet-example',
        title: 'Spreadsheet view',
        description: 'A VCF as a sortable, filterable table.',
      },
      {
        slug: 'sv-inspector-example',
        title: 'SV inspector',
        description: 'A spreadsheet paired with a circular view.',
      },
    ],
  },

  {
    slug: 'human-demo',
    title: 'Human demo (hg38)',
    description:
      'Genes, repeats, exome reads, variants and conservation on hg38.',
    group: 'Real-world demos',
    sections: [{ slug: 'human-demo', title: 'Human demo (hg38)' }],
  },
]

export const examples = flattenExamples(pages)

export const getPage = (slug: string) => findPage(pages, slug)
