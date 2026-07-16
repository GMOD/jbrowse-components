// A section is one live demo: it maps to src/examples/<name>.tsx (component +
// ?raw source) and an optional src/docs/<slug>.md prose file.
export interface ExampleSection {
  slug: string
  name: string
  title: string
  description: string
}

// A page is one sidebar entry / one URL. Most pages hold a single section, but
// closely-related demos are grouped onto one page (several sections) to keep the
// sidebar short. Each section keeps its own slug, so its doc/source and any
// `../<slug>/#<slug>` cross-links still resolve.
export interface ExamplePage {
  slug: string
  title: string
  description: string
  group: string
  sections: ExampleSection[]
}

export const pages: ExamplePage[] = [
  // --- Getting started ---
  {
    slug: 'basic-example',
    title: 'Basic example',
    description:
      'A minimal app: one assembly, one alignments track, opened in a linear genome view, via the managed JBrowse component.',
    group: 'Getting started',
    sections: [
      {
        slug: 'basic-example',
        name: 'BasicExample',
        title: 'Basic example',
        description:
          'A minimal app: one assembly, one alignments track, opened in a linear genome view, via the managed JBrowse component.',
      },
    ],
  },
  {
    slug: 'customizing-the-app',
    title: 'Customizing the app',
    description:
      'Small tweaks to the managed app: switch to the dark theme, observe state changes, or fit it into a sized container.',
    group: 'Getting started',
    sections: [
      {
        slug: 'dark-theme',
        name: 'DarkTheme',
        title: 'Dark theme',
        description: 'Use the built-in dark theme via the config theme palette.',
      },
      {
        slug: 'with-on-change',
        name: 'WithOnChange',
        title: 'Observe state with onChange',
        description:
          'onChange fires on every MST patch — persist the session, drive undo/redo, or sync external UI.',
      },
      {
        slug: 'fit-to-container',
        name: 'FitToContainer',
        title: 'Fit the app to a container',
        description:
          'By default the app fills the viewport (100vh). Set the --jbrowse-app-height CSS variable to make it fit a sized container instead — e.g. below your own header bar.',
      },
    ],
  },

  // --- Loading config ---
  {
    slug: 'loading-config',
    title: 'Loading configuration',
    description:
      'Three ways to get a JBrowse config into the app: bundle it at build time, fetch it at runtime, or add tracks programmatically.',
    group: 'Loading config',
    sections: [
      {
        slug: 'with-import-config-json',
        name: 'WithImportConfigJson',
        title: 'Import a config.json',
        description:
          'Bundle a config.json at build time and pass it to createViewState.',
      },
      {
        slug: 'with-fetch-config-json',
        name: 'WithFetchConfigJson',
        title: 'Fetch a config.json',
        description: 'Fetch a config.json at runtime, then build the view state.',
      },
      {
        slug: 'add-tracks-programmatically',
        name: 'AddTracksProgrammatically',
        title: 'Add tracks programmatically',
        description:
          'Add a track config at runtime with addTrackConf + showTrack.',
      },
    ],
  },

  // --- View types ---
  {
    slug: 'with-launch-linear-genome-view',
    title: 'Launch a linear genome view',
    description:
      'Open a linear genome view imperatively via the LaunchView extension point.',
    group: 'View types',
    sections: [
      {
        slug: 'with-launch-linear-genome-view',
        name: 'WithLaunchLinearGenomeView',
        title: 'Launch a linear genome view',
        description:
          'Open a linear genome view imperatively via the LaunchView extension point.',
      },
    ],
  },
  {
    slug: 'circular-example',
    title: 'Circular view',
    description: 'Show structural variants in a circular view.',
    group: 'View types',
    sections: [
      {
        slug: 'circular-example',
        name: 'CircularExample',
        title: 'Circular view',
        description: 'Show structural variants in a circular view.',
      },
    ],
  },
  {
    slug: 'dotplot-example',
    title: 'Dotplot view',
    description: 'A self-vs-self volvox dotplot.',
    group: 'View types',
    sections: [
      {
        slug: 'dotplot-example',
        name: 'DotplotExample',
        title: 'Dotplot view',
        description: 'A self-vs-self volvox dotplot.',
      },
    ],
  },
  {
    slug: 'synteny-views',
    title: 'Synteny views',
    description:
      'Compare assemblies with linear synteny — declaratively, via the imperative mount, or stacked multi-way.',
    group: 'View types',
    sections: [
      {
        slug: 'synteny-example',
        name: 'SyntenyExample',
        title: 'Linear synteny view',
        description: 'Compare two assemblies with a PAF synteny track.',
      },
      {
        slug: 'embedded-app-synteny',
        name: 'EmbeddedAppSynteny',
        title: 'Synteny via the imperative mount',
        description:
          'Mount the full app with createApp() — the framework-agnostic primitive non-React hosts (anywidget, htmlwidgets) use — and open a synteny view declaratively.',
      },
      {
        slug: 'multiway-synteny-example',
        name: 'MultiwaySyntenyExample',
        title: 'Multi-way linear synteny view',
        description:
          'Stack four E. coli strains in one synteny view, all backed by a single all-vs-all PAF.',
      },
    ],
  },
  {
    slug: 'breakpoint-split-example',
    title: 'Breakpoint split view',
    description: 'Visualize a structural variant across two regions.',
    group: 'View types',
    sections: [
      {
        slug: 'breakpoint-split-example',
        name: 'BreakpointSplitExample',
        title: 'Breakpoint split view',
        description: 'Visualize a structural variant across two regions.',
      },
    ],
  },
  {
    slug: 'spreadsheet-example',
    title: 'Spreadsheet view',
    description: 'Load a VCF into a sortable, filterable spreadsheet.',
    group: 'View types',
    sections: [
      {
        slug: 'spreadsheet-example',
        name: 'SpreadsheetExample',
        title: 'Spreadsheet view',
        description: 'Load a VCF into a sortable, filterable spreadsheet.',
      },
    ],
  },
  {
    slug: 'sv-inspector-example',
    title: 'SV inspector',
    description:
      'Inspect a structural-variant VCF with a paired spreadsheet + circular view.',
    group: 'View types',
    sections: [
      {
        slug: 'sv-inspector-example',
        name: 'SvInspectorExample',
        title: 'SV inspector',
        description:
          'Inspect a structural-variant VCF with a paired spreadsheet + circular view.',
      },
    ],
  },
  {
    slug: 'multi-view-session',
    title: 'Multiple views in one session',
    description:
      'Stack a circular SV overview and a linear detail view — the app manages both at once.',
    group: 'View types',
    sections: [
      {
        slug: 'multi-view-session',
        name: 'MultiViewSession',
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
        name: 'EmbeddedPlugin',
        title: 'Embedded (inline) plugin',
        description:
          'Register a plugin defined inline in your code — here adding a rubber-band menu item.',
      },
      {
        slug: 'with-external-plugin',
        name: 'WithExternalPlugin',
        title: 'External plugin',
        description: 'Load a plugin at runtime from a URL with loadPlugins.',
      },
    ],
  },
  {
    slug: 'with-web-worker',
    title: 'Web worker RPC',
    description: 'Offload data parsing/rendering to a web worker.',
    group: 'Plugins',
    sections: [
      {
        slug: 'with-web-worker',
        name: 'WithWebWorker',
        title: 'Web worker RPC',
        description: 'Offload data parsing/rendering to a web worker.',
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
    sections: [
      {
        slug: 'human-demo',
        name: 'HumanDemo',
        title: 'Human demo (hg38)',
        description:
          'A richer hg38 session: genes, repeats, exome alignments, variants, and conservation.',
      },
    ],
  },
]

// look up a section by slug within a page — used by the multi-section pages to
// pass each section's title/description into <ExampleSection> type-safely
export function section(page: ExamplePage, slug: string): ExampleSection {
  const found = page.sections.find(s => s.slug === slug)
  if (!found) {
    throw new Error(`no section "${slug}" on page "${page.slug}"`)
  }
  return found
}

// flat, one-entry-per-page list for the shared Shell sidebar + Gallery grid and
// the build smoke test, which only need {slug, title, description, group}
export const examples = pages.map(({ slug, title, description, group }) => ({
  slug,
  title,
  description,
  group,
}))
