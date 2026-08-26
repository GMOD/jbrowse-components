import { findPage, flattenExamples } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage, ExampleSection } from './exampleModel.ts'
export { section } from './exampleModel.ts'

// Three groups on purpose. Loading config and Plugins each used to be a sidebar
// heading over a single page, which costs a line and earns nothing.
export const pages: ExamplePage[] = [
  // --- Getting started ---
  {
    slug: 'basic-example',
    title: 'Basic example',
    description:
      'The whole app in one declarative call: a { name, uri } assembly, one alignments track, opened in a linear genome view.',
    group: 'Getting started',
    sections: [{ slug: 'basic-example', title: 'Basic example' }],
  },
  {
    slug: 'with-track-shorthand',
    title: 'Tracks as an id and a uri',
    description:
      'Three tracks written as a trackId and a data file, with the track type and the adapter read off each extension.',
    group: 'Getting started',
    sections: [
      { slug: 'with-track-shorthand', title: 'Tracks as an id and a uri' },
    ],
  },
  {
    slug: 'customizing-the-app',
    title: 'Customizing the app',
    description:
      'Dark theme, state observation, session URLs, container sizing, and the web worker RPC.',
    group: 'Getting started',
    sections: [
      {
        slug: 'dark-theme',
        title: 'Dark theme',
        description:
          'Use the built-in dark theme via the config theme palette.',
      },
      {
        slug: 'observe-session',
        title: 'Observe the session',
        description:
          'Wrap in mobx-react observer and read the session getters — which views are open, where each is looking.',
      },
      {
        slug: 'session-in-url',
        title: 'Put the session in the URL',
        description:
          'Serialize the session with encodeSession and restore it with decodeSession, for a sharable link.',
      },
      {
        slug: 'fit-to-container',
        title: 'Fit the app to a container',
        description:
          'Set the --jbrowse-app-height CSS variable to fit the app into a sized container.',
      },
      {
        slug: 'with-web-worker',
        title: 'Web worker RPC',
        description:
          'Pass makeWorkerInstance to createViewState to offload data parsing/rendering to a web worker.',
      },
    ],
  },

  {
    slug: 'loading-config',
    title: 'Loading configuration',
    description:
      'Bundle a config at build time, fetch one at runtime, or add tracks and views after mount.',
    group: 'Getting started',
    sections: [
      {
        slug: 'with-import-config-json',
        title: 'Import a config.json',
        description:
          'Bundle a config.json at build time and pass it to createViewState.',
      },
      {
        slug: 'with-fetch-config-json',
        title: 'Fetch a config.json',
        description:
          'Fetch a config.json at runtime, then build the view state.',
      },
      {
        slug: 'add-tracks-programmatically',
        title: 'Add tracks programmatically',
        description:
          'Add a track config at runtime with addTrackConf + showTrack.',
      },
      {
        slug: 'with-launch-linear-genome-view',
        title: 'Launch a view imperatively',
        description:
          'Open a linear genome view after mount via the LaunchView extension point, instead of the declarative views prop.',
      },
    ],
  },
  {
    slug: 'plugins',
    title: 'Plugins',
    description:
      'Extend the app with plugins — defined inline in your bundle, or loaded at runtime from a URL.',
    group: 'Getting started',
    sections: [
      {
        slug: 'embedded-plugin',
        title: 'Embedded (inline) plugin',
        description:
          'Register a plugin defined inline in your code — here adding a rubber-band menu item.',
      },
      {
        slug: 'with-external-plugin',
        title: 'External plugin',
        description: 'Load a plugin at runtime from a URL with loadPlugins.',
      },
    ],
  },

  // --- View types ---
  {
    slug: 'comparative-views',
    title: 'Comparative views',
    description:
      'Synteny and dotplot views, declaratively and through the imperative mount.',
    group: 'View types',
    sections: [
      {
        slug: 'synteny-example',
        title: 'Linear synteny view',
        description: 'Compare two assemblies with a PAF synteny track.',
      },
      {
        slug: 'dotplot-example',
        title: 'Dotplot view',
        description: 'A self-vs-self volvox dotplot.',
      },
      {
        slug: 'create-app-synteny',
        title: 'Synteny via the imperative mount',
        description:
          'Mount the app imperatively with createApp(), the primitive non-React hosts wrap.',
      },
      {
        slug: 'multiway-synteny-example',
        title: 'Multi-way linear synteny view',
        description:
          'Stack four E. coli strains in one synteny view, all backed by a single all-vs-all PAF.',
      },
    ],
  },
  {
    slug: 'structural-variant-views',
    title: 'Structural variant views',
    description:
      'Circular, breakpoint-split, spreadsheet and SV-inspector views over a volvox SV VCF.',
    group: 'View types',
    sections: [
      {
        slug: 'circular-example',
        title: 'Circular view',
        description: 'Show structural variants in a circular view.',
      },
      {
        slug: 'breakpoint-split-example',
        title: 'Breakpoint split view',
        description: 'Visualize a structural variant across two regions.',
      },
      {
        slug: 'spreadsheet-example',
        title: 'Spreadsheet view',
        description: 'Load a VCF into a sortable, filterable spreadsheet.',
      },
      {
        slug: 'sv-inspector-example',
        title: 'SV inspector',
        description:
          'Inspect a structural-variant VCF with a paired spreadsheet + circular view.',
      },
      {
        slug: 'multi-view-session',
        title: 'Multiple views in one session',
        description:
          'Stack a circular SV overview and a linear detail view — the app manages both at once.',
      },
    ],
  },

  // --- Real-world demos ---
  {
    slug: 'human-demo',
    title: 'Human demo (hg38)',
    description:
      'A richer hg38 session: genes, repeats, exome alignments, variants, and conservation.',
    group: 'Real-world demos',
    sections: [{ slug: 'human-demo', title: 'Human demo (hg38)' }],
  },
]

export const examples = flattenExamples(pages)

// bound to this site's `pages` so page files call getPage('slug') directly
export const getPage = (slug: string) => findPage(pages, slug)
