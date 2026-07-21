import { flattenExamples } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage, ExampleSection } from './exampleModel.ts'
export { section } from './exampleModel.ts'

export const pages: ExamplePage[] = [
  // --- Getting started ---
  {
    slug: 'basic-example',
    title: 'Basic example',
    description:
      'The whole app in one declarative call: a { name, uri } assembly, one alignments track, opened in a linear genome view.',
    group: 'Getting started',
    sections: [
      {
        slug: 'basic-example',
        title: 'Basic example',
        description:
          'The whole app in one declarative call: a { name, uri } assembly, one alignments track, opened in a linear genome view.',
      },
    ],
  },
  {
    slug: 'customizing-the-app',
    title: 'Customizing the app',
    description:
      'Small tweaks to the app: switch to the dark theme, observe state changes, fit it into a sized container, or offload data parsing to a web worker.',
    group: 'Getting started',
    sections: [
      {
        slug: 'dark-theme',
        title: 'Dark theme',
        description:
          'Use the built-in dark theme via the config theme palette.',
      },
      {
        slug: 'with-on-change',
        title: 'Observe state with onChange',
        description:
          'onChange fires on every MST patch — persist the session, drive undo/redo, or sync external UI.',
      },
      {
        slug: 'fit-to-container',
        title: 'Fit the app to a container',
        description:
          'By default the app fills the viewport (100vh). Set the --jbrowse-app-height CSS variable to make it fit a sized container instead — e.g. below your own header bar.',
      },
      {
        slug: 'with-web-worker',
        title: 'Web worker RPC',
        description:
          'Pass makeWorkerInstance to createViewState to offload data parsing/rendering to a web worker.',
      },
    ],
  },

  // --- Loading config ---
  {
    slug: 'loading-config',
    title: 'Loading configuration',
    description:
      'Get a JBrowse config into the app: bundle it at build time, fetch it at runtime, add tracks programmatically, or launch a view imperatively.',
    group: 'Loading config',
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

  // --- View types ---
  {
    slug: 'comparative-views',
    title: 'Comparative views',
    description:
      'Compare assemblies: a linear synteny view (declaratively or via the imperative mount), a dotplot, and a stacked multi-way synteny view.',
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
          'Mount the app with createApp() — the framework-agnostic primitive non-React hosts (anywidget, htmlwidgets) use — and open a synteny view declaratively.',
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
      'Inspect structural variants in volvox: a circular overview, a breakpoint split view, a VCF spreadsheet, the SV inspector, and several of these stacked in one session.',
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

  // --- Plugins ---
  {
    slug: 'plugins',
    title: 'Plugins',
    description:
      'Extend the app with plugins — defined inline in your bundle, or loaded at runtime from a URL.',
    group: 'Plugins',
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

  // --- Real-world demos ---
  {
    slug: 'human-demo',
    title: 'Human demo (hg38)',
    description:
      'A richer hg38 session: genes, repeats, exome alignments, variants, and conservation.',
    group: 'Real-world demos',
    // section break: how-to examples above, real-data demo below
    dividerBefore: true,
    sections: [
      {
        slug: 'human-demo',
        title: 'Human demo (hg38)',
        description:
          'A richer hg38 session: genes, repeats, exome alignments, variants, and conservation.',
      },
    ],
  },
]

export const examples = flattenExamples(pages)
