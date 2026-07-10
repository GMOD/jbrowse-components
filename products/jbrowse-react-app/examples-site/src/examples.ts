export interface ExampleMeta {
  slug: string
  name: string
  title: string
  description: string
  group: string
}

// single source of truth for the gallery index and each example page's
// title/description. each `slug` has a matching src/pages/<slug>.astro and
// src/examples/<name>.tsx
export const examples: ExampleMeta[] = [
  // --- Getting started ---
  {
    slug: 'basic-example',
    name: 'BasicExample',
    title: 'Basic example',
    description:
      'A minimal app: one assembly, one alignments track, opened in a linear genome view, via the managed JBrowse component.',
    group: 'Getting started',
  },
  {
    slug: 'dark-theme',
    name: 'DarkTheme',
    title: 'Dark theme',
    description: 'Use the built-in dark theme via the config theme palette.',
    group: 'Getting started',
  },
  {
    slug: 'with-on-change',
    name: 'WithOnChange',
    title: 'Observe state with onChange',
    description:
      'onChange fires on every MST patch — persist the session, drive undo/redo, or sync external UI.',
    group: 'Getting started',
  },
  {
    slug: 'fit-to-container',
    name: 'FitToContainer',
    title: 'Fit the app to a container',
    description:
      'By default the app fills the viewport (100vh). Set the --jbrowse-app-height CSS variable to make it fit a sized container instead — e.g. below your own header bar.',
    group: 'Getting started',
  },

  // --- Loading config ---
  {
    slug: 'with-import-config-json',
    name: 'WithImportConfigJson',
    title: 'Import a config.json',
    description:
      'Bundle a config.json at build time and pass it to createViewState.',
    group: 'Loading config',
  },
  {
    slug: 'with-fetch-config-json',
    name: 'WithFetchConfigJson',
    title: 'Fetch a config.json',
    description: 'Fetch a config.json at runtime, then build the view state.',
    group: 'Loading config',
  },
  {
    slug: 'add-tracks-programmatically',
    name: 'AddTracksProgrammatically',
    title: 'Add tracks programmatically',
    description: 'Add a track config at runtime with addTrackConf + showTrack.',
    group: 'Loading config',
  },

  // --- View types ---
  {
    slug: 'with-launch-linear-genome-view',
    name: 'WithLaunchLinearGenomeView',
    title: 'Launch a linear genome view',
    description:
      'Open a linear genome view imperatively via the LaunchView extension point.',
    group: 'View types',
  },
  {
    slug: 'circular-example',
    name: 'CircularExample',
    title: 'Circular view',
    description: 'Show structural variants in a circular view.',
    group: 'View types',
  },
  {
    slug: 'dotplot-example',
    name: 'DotplotExample',
    title: 'Dotplot view',
    description: 'A self-vs-self volvox dotplot.',
    group: 'View types',
  },
  {
    slug: 'synteny-example',
    name: 'SyntenyExample',
    title: 'Linear synteny view',
    description: 'Compare two assemblies with a PAF synteny track.',
    group: 'View types',
  },
  {
    slug: 'multiway-synteny-example',
    name: 'MultiwaySyntenyExample',
    title: 'Multi-way linear synteny view',
    description:
      'Stack three assemblies in one synteny view — each adjacent pair connected by its own PAF track.',
    group: 'View types',
  },
  {
    slug: 'breakpoint-split-example',
    name: 'BreakpointSplitExample',
    title: 'Breakpoint split view',
    description: 'Visualize a structural variant across two regions.',
    group: 'View types',
  },
  {
    slug: 'spreadsheet-example',
    name: 'SpreadsheetExample',
    title: 'Spreadsheet view',
    description: 'Load a VCF into a sortable, filterable spreadsheet.',
    group: 'View types',
  },
  {
    slug: 'sv-inspector-example',
    name: 'SvInspectorExample',
    title: 'SV inspector',
    description:
      'Inspect a structural-variant VCF with a paired spreadsheet + circular view.',
    group: 'View types',
  },
  {
    slug: 'multi-view-session',
    name: 'MultiViewSession',
    title: 'Multiple views in one session',
    description:
      'Stack a circular SV overview and a linear detail view — the app manages both at once.',
    group: 'View types',
  },

  // --- Plugins ---
  {
    slug: 'embedded-plugin',
    name: 'EmbeddedPlugin',
    title: 'Embedded (inline) plugin',
    description:
      'Register a plugin defined inline in your code — here adding a rubber-band menu item.',
    group: 'Plugins',
  },
  {
    slug: 'with-external-plugin',
    name: 'WithExternalPlugin',
    title: 'External plugin',
    description: 'Load a plugin at runtime from a URL with loadPlugins.',
    group: 'Plugins',
  },
  {
    slug: 'with-web-worker',
    name: 'WithWebWorker',
    title: 'Web worker RPC',
    description: 'Offload data parsing/rendering to a web worker.',
    group: 'Plugins',
  },

  // --- Real-world demos ---
  {
    slug: 'human-demo',
    name: 'HumanDemo',
    title: 'Human demo (hg38)',
    description:
      'A richer hg38 session: genes, repeats, exome alignments, variants, and conservation.',
    group: 'Real-world demos',
  },
]
