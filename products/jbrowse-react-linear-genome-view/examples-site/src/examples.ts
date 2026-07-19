import { type ExamplePage, flattenExamples } from './exampleModel.ts'

export type { ExamplePage, ExampleSection } from './exampleModel.ts'
export { section } from './exampleModel.ts'

export const pages: ExamplePage[] = [
  // --- Getting started ---
  {
    slug: 'setting-up-the-view',
    title: 'Setting up the view',
    description:
      'The core ways to render the component and give it a starting state: the declarative props, the createViewState hook, and the minimal end-to-end example.',
    group: 'Getting started',
    sections: [
      {
        slug: 'one-linear-genome-view',
        title: 'The simplest example',
        description:
          'The simplest example: an assembly, tracks, an initial location, and an onChange handler.',
      },
      {
        slug: 'with-init',
        title: 'Declarative init',
        description:
          'Initialize the view with an assembly, a track, and a starting location.',
      },
      {
        slug: 'use-create-view-state',
        title: 'useCreateViewState',
        description:
          'useCreateViewState keeps view state stable across parent re-renders.',
      },
    ],
  },
  {
    slug: 'default-session',
    title: 'Default session, embeds & the drawer',
    description:
      'Open on a predefined session snapshot, hide editing UI for a locked-down embed, and show widgets (track selector, feature details) in a side drawer.',
    group: 'Getting started',
    sections: [
      {
        slug: 'default-session',
        title: 'Open on a default session',
        description:
          'Open the view on a predefined session that shows specific tracks.',
      },
      {
        slug: 'disable-add-track',
        title: 'Disable the add-track UI',
        description: 'Hide the "add track" UI for a locked-down embed.',
      },
      {
        slug: 'with-drawer-widget',
        title: 'Widgets in a side drawer',
        description:
          'Render widgets (track selector, feature details) in a resizable side drawer via drawerViewHeight.',
      },
    ],
  },

  // --- Navigation ---
  {
    slug: 'navigate-to-location',
    title: 'Navigating to a location',
    description:
      'Drive the view to a region from your own UI, or with a {refName, start, end} location object.',
    group: 'Navigation',
    sections: [
      {
        slug: 'external-navigate',
        title: 'External navigation',
        description:
          'Drive the view from your own UI with navToLocString (a location string) or navToLocations (a {refName, start, end} object).',
      },
      {
        slug: 'using-loc-object',
        title: 'Using a location object',
        description:
          'Initialize the starting location with a {refName, start, end} object.',
      },
    ],
  },
  {
    slug: 'flipping-regions',
    title: 'Flipping regions',
    description:
      'Reverse-complement the whole view, or mix orientations across multiple displayed regions.',
    group: 'Navigation',
    sections: [
      {
        slug: 'horizontally-flip',
        title: 'Horizontally flip the view',
        description:
          'Reverse-complement the view, either imperatively with a button or by opening on a [rev] location string.',
      },
      {
        slug: 'with-multiple-displayed-regions-flipped',
        title: 'Multiple displayed regions, some flipped',
        description:
          'Show several regions at once, with individual regions reverse-complemented.',
      },
    ],
  },
  {
    slug: 'controlling-the-view',
    title: 'Controlling the view',
    description:
      'Lock down interaction, or toggle tracks on from your own code.',
    group: 'Navigation',
    sections: [
      {
        slug: 'with-disable-zoom-and-side-scroll',
        title: 'Disable zoom and side scroll',
        description: 'Lock the view so users cannot zoom or pan.',
      },
      {
        slug: 'with-show-track',
        title: 'Show a track programmatically',
        description: 'Turn a track on from code via showTrack.',
      },
    ],
  },

  // --- Styling & theming ---
  {
    slug: 'theming',
    title: 'Theming',
    description:
      'Apply a custom Material UI theme, or switch on the built-in dark theme.',
    group: 'Styling & theming',
    sections: [
      {
        slug: 'with-custom-theme',
        title: 'Custom theme',
        description: 'Apply a custom Material UI theme to the view.',
      },
      {
        slug: 'with-dark-theme',
        title: 'Dark theme',
        description: 'Use the built-in dark theme.',
      },
    ],
  },
  {
    slug: 'style-isolation',
    title: 'Styling & isolation',
    description:
      'Style the embed from your surrounding page, or isolate it entirely inside a Shadow DOM.',
    group: 'Styling & theming',
    sections: [
      {
        slug: 'with-outside-styling',
        title: 'Styling from outside the component',
        description: 'Style the embed from your surrounding page CSS.',
      },
      {
        slug: 'shadow-dom',
        title: 'Render inside a Shadow DOM',
        description:
          'Isolate the view inside a shadow root with its own emotion cache and MUI portal containers.',
      },
    ],
  },

  // --- Track display & coloring ---
  {
    slug: 'feature-colors-and-labels',
    title: 'Feature colors & labels',
    description:
      'Color and label features — dynamically with jexl callbacks, or quickly with the displayDefaults color shorthand.',
    group: 'Track display & coloring',
    sections: [
      {
        slug: 'with-jexl-feature-colors-and-labels',
        title: 'Jexl feature colors and labels',
        description:
          'Color and label features dynamically with jexl callback expressions.',
      },
      {
        slug: 'with-track-color-shorthand',
        title: 'Track color shorthand',
        description:
          'Set a track color with the displayDefaults color shorthand.',
      },
    ],
  },
  {
    slug: 'alignments-tracks',
    title: 'Alignments tracks',
    description:
      'Open an alignments (BAM/CRAM) track with a chosen display, and group reads by a SAM tag.',
    group: 'Track display & coloring',
    sections: [
      {
        slug: 'with-init-alignments-display',
        title: 'Initialize an alignments display',
        description:
          'Open an alignments (BAM/CRAM) track with a chosen display.',
      },
      {
        slug: 'with-group-by-tag',
        title: 'Group alignments by tag',
        description: 'Group reads in an alignments track by a SAM tag.',
      },
    ],
  },
  {
    slug: 'alignments-track-options',
    title: 'Custom alignments display options',
    description:
      'Configure a LinearAlignmentsDisplay up front — color by modifications, group by haplotype, filter by SAM flags — on real HG002 methylation data, with links to the full option reference.',
    group: 'Track display & coloring',
    // real HG002 nanopore reads (long, modification-tagged) are a heavy remote
    // fetch and modification rendering is a GPU path that CI's headless
    // software-WebGL can choke on; the page ships and works in a real browser
    skipSmoke: true,
    sections: [
      {
        slug: 'alignments-track-options',
        title: 'Custom alignments display options',
        description:
          'Configure a LinearAlignmentsDisplay up front — color by modifications, group by haplotype, filter by SAM flags — on real HG002 methylation data, with links to the full option reference.',
      },
    ],
  },
  {
    slug: 'specialized-track-types',
    title: 'Quantitative, gene & variant tracks',
    description:
      'Load specific data types: quantitative signal from a BigWig, gene models from a GTF, and a multi-sample VCF as a matrix.',
    group: 'Track display & coloring',
    sections: [
      {
        slug: 'with-wiggle-track',
        title: 'Quantitative (BigWig) track',
        description:
          'Render quantitative signal from a BigWig as a wiggle display, configured via the displayDefaults shorthand.',
      },
      {
        slug: 'with-gtf-track',
        title: 'GTF gene model track',
        description:
          'Load gene models from a GTF file, with genes/transcripts built from per-feature lines via aggregateField.',
      },
      {
        slug: 'with-multi-sample-variant-display',
        title: 'Multi-sample variant display',
        description: 'Show a multi-sample VCF as a matrix display.',
      },
    ],
  },
  {
    slug: 'track-sizing',
    title: 'Track sizing: grow & fit',
    description:
      'Choose what a feature track does when it has more rows than fit: grow the track to show them all, or squeeze the rows into a fixed height.',
    group: 'Track display & coloring',
    sections: [
      {
        slug: 'track-sizing',
        title: 'Track sizing: grow & fit',
        description:
          'Choose what a feature track does when it has more rows than fit: grow the track to show them all, or squeeze the rows into a fixed height.',
      },
    ],
  },

  // --- Sessions & state ---
  {
    slug: 'session-setup',
    title: 'Advanced init, highlights & persistence',
    description:
      'Use the advanced init blob for a richer initial view, add highlighted regions to the session, and persist the live session to localStorage and restore it on reload.',
    group: 'Sessions & state',
    sections: [
      {
        slug: 'with-init-advanced',
        title: 'Advanced init',
        description:
          'Use the advanced init blob to set up a richer initial view.',
      },
      {
        slug: 'with-session-highlights',
        title: 'Session highlights',
        description: 'Add highlighted regions to the session.',
      },
      {
        slug: 'with-session-persistence',
        title: 'Persist & restore the session',
        description:
          'Mirror the live session to localStorage with onSnapshot, and restore it as defaultSession on reload.',
      },
    ],
  },
  {
    slug: 'multiple-views',
    title: 'Observing & multiple views',
    description:
      'React to the regions and features currently visible from your own companion panels, and render several independent views on one page.',
    group: 'Sessions & state',
    sections: [
      {
        slug: 'observe-visible',
        title: 'Observe the visible view',
        description:
          'React to the regions and features currently visible in the view from your own companion panels.',
      },
      {
        slug: 'with-two-linear-genome-views',
        title: 'Two linear genome views',
        description: 'Render two independent views on one page.',
      },
    ],
  },
  {
    slug: 'export-and-errors',
    title: 'Export & error handling',
    description:
      'Render the whole view to a vector SVG (or rasterized PNG), and catch and render view errors with your own UI.',
    group: 'Sessions & state',
    // exportSvg re-renders every track's GPU layer through the SVG path, which
    // crashes CI's headless software-WebGL
    skipSmoke: true,
    sections: [
      {
        slug: 'export-svg',
        title: 'Export the view (SVG/PNG)',
        description:
          'Render the whole view to a vector SVG (or rasterized PNG) with the exportSvg action.',
      },
      {
        slug: 'with-error-handler',
        title: 'Custom error handling',
        description: 'Catch and render view errors with your own UI.',
      },
    ],
  },

  // --- Text searching ---
  {
    slug: 'text-searching',
    title: 'Text searching',
    description:
      'Search by gene name or ID — across all tracks with an aggregate adapter, or per-track.',
    group: 'Text searching',
    sections: [
      {
        slug: 'with-aggregate-text-searching',
        title: 'Aggregate text searching',
        description:
          'Search across tracks with an aggregate text-search adapter.',
      },
      {
        slug: 'with-per-track-text-searching',
        title: 'Per-track text searching',
        description: 'Attach a text-search adapter to an individual track.',
      },
    ],
  },

  // --- Plugins & accounts ---
  {
    slug: 'plugins',
    title: 'Plugins',
    description:
      'Extend the view with plugins — loaded at runtime from a URL, or defined inline in your own code.',
    group: 'Plugins & accounts',
    sections: [
      {
        slug: 'with-external-plugin',
        title: 'External plugin',
        description: 'Load a plugin at runtime from a URL.',
      },
      {
        slug: 'with-inline-plugins',
        title: 'Inline plugins',
        description: 'Register a plugin defined inline in your own code.',
      },
    ],
  },
  {
    slug: 'accounts-and-workers',
    title: 'Internet accounts & web workers',
    description:
      'Access authenticated data sources via internet accounts, and offload data parsing/rendering to a web worker.',
    group: 'Plugins & accounts',
    sections: [
      {
        slug: 'with-internet-accounts',
        title: 'Internet accounts (authentication)',
        description: 'Access authenticated data sources via internet accounts.',
      },
      {
        slug: 'with-web-worker',
        title: 'Web worker RPC',
        description: 'Offload data parsing/rendering to a web worker.',
      },
    ],
  },

  // --- Real-world demos ---
  {
    slug: 'human-exome-example',
    title: 'Human exome example',
    description: 'A human exome sequencing dataset on hg38.',
    group: 'Real-world demos',
    sections: [
      {
        slug: 'human-exome-example',
        title: 'Human exome example',
        description: 'A human exome sequencing dataset on hg38.',
      },
    ],
  },
  {
    slug: 'nextstrain-pathogens',
    title: 'Nextstrain pathogens',
    description:
      'Genes, diversity, and a per-sample genotype matrix for SARS-CoV-2, Zika, Ebola, measles, and RSV-A — pick a pathogen from the dropdown.',
    group: 'Real-world demos',
    // the genotype-matrix GPU render crashes CI's headless software-WebGL
    skipSmoke: true,
    sections: [
      {
        slug: 'nextstrain-pathogens',
        title: 'Nextstrain pathogens',
        description:
          'Genes, diversity, and a per-sample genotype matrix for SARS-CoV-2, Zika, Ebola, measles, and RSV-A — pick a pathogen from the dropdown.',
      },
    ],
  },
  {
    slug: 'nextstrain-msa',
    title: 'Nextstrain MSA + tree',
    description:
      'The Nextstrain tree + reconstructed reference-coordinate MSA, embedded with react-msaview.',
    group: 'Real-world demos',
    sections: [
      {
        slug: 'nextstrain-msa',
        title: 'Nextstrain MSA + tree',
        description:
          'The Nextstrain tree + reconstructed reference-coordinate MSA, embedded with react-msaview.',
      },
    ],
  },
  {
    slug: 'locus-zoom-ld',
    title: 'LocusZoom-style LD',
    description:
      'GWAS summary stats colored by LD r² to the lead SNP, LocusZoom-style.',
    group: 'Real-world demos',
    sections: [
      {
        slug: 'locus-zoom-ld',
        title: 'LocusZoom-style LD',
        description:
          'GWAS summary stats colored by LD r² to the lead SNP, LocusZoom-style.',
      },
    ],
  },
  {
    slug: 'pan-ukb-gwas',
    title: 'Pan-UKB GWAS',
    description:
      'Browse Pan-UK Biobank GWAS summary statistics across phenotypes.',
    group: 'Real-world demos',
    sections: [
      {
        slug: 'pan-ukb-gwas',
        title: 'Pan-UKB GWAS',
        description:
          'Browse Pan-UK Biobank GWAS summary statistics across phenotypes.',
      },
    ],
  },
]

export const examples = flattenExamples(pages)
