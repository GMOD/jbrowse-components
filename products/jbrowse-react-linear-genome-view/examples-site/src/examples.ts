export interface ExampleMeta {
  slug: string
  name: string
  title: string
  description: string
  group: string
  // exclude from the examples-site smoke test (scripts/smoke.mjs). The page
  // still ships and works in a real browser; it's only skipped in CI's headless
  // software-WebGL (swiftshader), where its rendering crashes the renderer.
  skipSmoke?: boolean
}

// single source of truth for the gallery index and each example page's
// title/description. each `slug` has a matching src/pages/<slug>.astro and
// src/examples/<name>.tsx
export const examples: ExampleMeta[] = [
  // --- Getting started ---
  {
    slug: 'with-init',
    name: 'WithInit',
    title: 'WithInit',
    description:
      'Initialize the view with an assembly, a track, and a starting location.',
    group: 'Getting started',
  },
  {
    slug: 'default-session',
    name: 'DefaultSession',
    title: 'DefaultSession',
    description:
      'Open the view on a predefined session that shows specific tracks.',
    group: 'Getting started',
  },
  {
    slug: 'one-linear-genome-view',
    name: 'OneLinearGenomeView',
    title: 'OneLinearGenomeView',
    description:
      'The simplest example: an assembly, tracks, an initial location, and an onChange handler.',
    group: 'Getting started',
  },
  {
    slug: 'use-create-view-state',
    name: 'UseCreateViewState',
    title: 'useCreateViewState',
    description:
      'useCreateViewState keeps view state stable across parent re-renders.',
    group: 'Getting started',
  },
  {
    slug: 'disable-add-track',
    name: 'DisableAddTrack',
    title: 'DisableAddTrack',
    description: 'Hide the "add track" UI for a locked-down embed.',
    group: 'Getting started',
  },

  // --- Navigation ---
  {
    slug: 'external-navigate',
    name: 'ExternalNavigate',
    title: 'External navigation',
    description:
      'Drive the view from your own UI with navToLocString (a location string) or navToLocations (a {refName, start, end} object).',
    group: 'Navigation',
  },
  {
    slug: 'using-loc-object',
    name: 'UsingLocObject',
    title: 'Using a location object',
    description:
      'Initialize the starting location with a {refName, start, end} object.',
    group: 'Navigation',
  },
  {
    slug: 'horizontally-flip',
    name: 'HorizontallyFlip',
    title: 'Horizontally flip the view',
    description:
      'Reverse-complement the view, either imperatively with a button or by opening on a [rev] location string.',
    group: 'Navigation',
  },
  {
    slug: 'with-multiple-displayed-regions-flipped',
    name: 'WithMultipleDisplayedRegionsFlipped',
    title: 'Multiple displayed regions, some flipped',
    description:
      'Show several regions at once, with individual regions reverse-complemented.',
    group: 'Navigation',
  },
  {
    slug: 'with-disable-zoom-and-side-scroll',
    name: 'WithDisableZoomAndSideScroll',
    title: 'Disable zoom and side scroll',
    description: 'Lock the view so users cannot zoom or pan.',
    group: 'Navigation',
  },
  {
    slug: 'with-show-track',
    name: 'WithShowTrack',
    title: 'Show a track programmatically',
    description: 'Turn a track on from code via showTrack.',
    group: 'Navigation',
  },

  // --- Styling & theming ---
  {
    slug: 'with-custom-theme',
    name: 'WithCustomTheme',
    title: 'Custom theme',
    description: 'Apply a custom Material UI theme to the view.',
    group: 'Styling & theming',
  },
  {
    slug: 'with-dark-theme',
    name: 'WithDarkTheme',
    title: 'Dark theme',
    description: 'Use the built-in dark theme.',
    group: 'Styling & theming',
  },
  {
    slug: 'with-outside-styling',
    name: 'WithOutsideStyling',
    title: 'Styling from outside the component',
    description: 'Style the embed from your surrounding page CSS.',
    group: 'Styling & theming',
  },
  {
    slug: 'shadow-dom',
    name: 'ShadowDOMOneLinearGenomeView',
    title: 'Render inside a Shadow DOM',
    description:
      'Isolate the view inside a shadow root with its own emotion cache and MUI portal containers.',
    group: 'Styling & theming',
  },

  // --- Track display & coloring ---
  {
    slug: 'with-jexl-feature-colors-and-labels',
    name: 'WithJexlFeatureColorsAndLabels',
    title: 'Jexl feature colors and labels',
    description:
      'Color and label features dynamically with jexl callback expressions.',
    group: 'Track display & coloring',
  },
  {
    slug: 'with-track-color-shorthand',
    name: 'WithTrackColorShorthand',
    title: 'Track color shorthand',
    description: 'Set a track color with the displayDefaults color shorthand.',
    group: 'Track display & coloring',
  },
  {
    slug: 'with-wiggle-track',
    name: 'WithWiggleTrack',
    title: 'Quantitative (BigWig) track',
    description:
      'Render quantitative signal from a BigWig as a wiggle display, configured via the displayDefaults shorthand.',
    group: 'Track display & coloring',
  },
  {
    slug: 'with-gtf-track',
    name: 'WithGtfTrack',
    title: 'GTF gene model track',
    description:
      'Load gene models from a GTF file, with genes/transcripts built from per-feature lines via aggregateField.',
    group: 'Track display & coloring',
  },
  {
    slug: 'with-init-alignments-display',
    name: 'WithInitAlignmentsDisplay',
    title: 'Initialize an alignments display',
    description: 'Open an alignments (BAM/CRAM) track with a chosen display.',
    group: 'Track display & coloring',
  },
  {
    slug: 'with-group-by-tag',
    name: 'WithGroupByTag',
    title: 'Group alignments by tag',
    description: 'Group reads in an alignments track by a SAM tag.',
    group: 'Track display & coloring',
  },
  {
    slug: 'with-multi-sample-variant-display',
    name: 'WithMultiSampleVariantDisplay',
    title: 'Multi-sample variant display',
    description: 'Show a multi-sample VCF as a matrix display.',
    group: 'Track display & coloring',
  },

  // --- Sessions & state ---
  {
    slug: 'with-init-advanced',
    name: 'WithInitAdvanced',
    title: 'Advanced init',
    description: 'Use the advanced init blob to set up a richer initial view.',
    group: 'Sessions & state',
  },
  {
    slug: 'with-session-highlights',
    name: 'WithSessionHighlights',
    title: 'Session highlights',
    description: 'Add highlighted regions to the session.',
    group: 'Sessions & state',
  },
  {
    slug: 'observe-visible',
    name: 'ObserveVisible',
    title: 'Observe the visible view',
    description:
      'React to the regions and features currently visible in the view from your own companion panels.',
    group: 'Sessions & state',
  },
  {
    slug: 'with-two-linear-genome-views',
    name: 'WithTwoLinearGenomeViews',
    title: 'Two linear genome views',
    description: 'Render two independent views on one page.',
    group: 'Sessions & state',
  },
  {
    slug: 'with-error-handler',
    name: 'WithErrorHandler',
    title: 'Custom error handling',
    description: 'Catch and render view errors with your own UI.',
    group: 'Sessions & state',
  },

  // --- Text searching ---
  {
    slug: 'with-aggregate-text-searching',
    name: 'WithAggregateTextSearching',
    title: 'Aggregate text searching',
    description: 'Search across tracks with an aggregate text-search adapter.',
    group: 'Text searching',
  },
  {
    slug: 'with-per-track-text-searching',
    name: 'WithPerTrackTextSearching',
    title: 'Per-track text searching',
    description: 'Attach a text-search adapter to an individual track.',
    group: 'Text searching',
  },

  // --- Plugins & accounts ---
  {
    slug: 'with-external-plugin',
    name: 'WithExternalPlugin',
    title: 'External plugin',
    description: 'Load a plugin at runtime from a URL.',
    group: 'Plugins & accounts',
  },
  {
    slug: 'with-inline-plugins',
    name: 'WithInlinePlugins',
    title: 'Inline plugins',
    description: 'Register a plugin defined inline in your own code.',
    group: 'Plugins & accounts',
  },
  {
    slug: 'with-internet-accounts',
    name: 'WithInternetAccounts',
    title: 'Internet accounts (authentication)',
    description: 'Access authenticated data sources via internet accounts.',
    group: 'Plugins & accounts',
  },
  {
    slug: 'with-web-worker',
    name: 'WithWebWorker',
    title: 'Web worker RPC',
    description: 'Offload data parsing/rendering to a web worker.',
    group: 'Plugins & accounts',
  },
  {
    slug: 'with-drawer-widget',
    name: 'WithDrawerWidget',
    title: 'Drawer widget',
    description: 'Show feature details and other widgets in the drawer.',
    group: 'Plugins & accounts',
  },

  // --- Real-world demos ---
  {
    slug: 'human-exome-example',
    name: 'HumanExomeExample',
    title: 'Human exome example',
    description: 'A human exome sequencing dataset on hg38.',
    group: 'Real-world demos',
  },
  {
    slug: 'nextstrain-pathogens',
    name: 'NextstrainPathogens',
    title: 'Nextstrain pathogens',
    description:
      'Genes, diversity, and a per-sample genotype matrix for SARS-CoV-2, Zika, Ebola, measles, and RSV-A — pick a pathogen from the dropdown.',
    group: 'Real-world demos',
    // the genotype-matrix GPU render crashes CI's headless software-WebGL
    skipSmoke: true,
  },
  {
    slug: 'nextstrain-msa',
    name: 'NextstrainMsa',
    title: 'Nextstrain MSA + tree',
    description:
      'The Nextstrain tree + reconstructed reference-coordinate MSA, embedded with react-msaview.',
    group: 'Real-world demos',
  },
  {
    slug: 'locus-zoom-ld',
    name: 'LocusZoomLD',
    title: 'LocusZoom-style LD',
    description:
      'GWAS summary stats colored by LD r² to the lead SNP, LocusZoom-style.',
    group: 'Real-world demos',
  },
  {
    slug: 'pan-ukb-gwas',
    name: 'PanUKBGWAS',
    title: 'Pan-UKB GWAS',
    description:
      'Browse Pan-UK Biobank GWAS summary statistics across phenotypes.',
    group: 'Real-world demos',
  },
]
