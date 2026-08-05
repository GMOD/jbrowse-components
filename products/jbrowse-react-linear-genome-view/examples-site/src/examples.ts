import { findPage, flattenExamples } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage, ExampleSection } from './exampleModel.ts'
export { section } from './exampleModel.ts'

export const pages: ExamplePage[] = [
  // --- Getting started ---
  {
    slug: 'setting-up-the-view',
    title: 'View setup',
    description:
      'Render the component and give it a starting state, declaratively or through the useCreateViewState hook.',
    group: 'Getting started',
    sections: [
      {
        slug: 'one-linear-genome-view',
        title: 'The simplest example',
        description:
          'The whole component in one declarative call: an assembly, tracks, and a starting location.',
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
    title: 'Session & drawer',
    description:
      'Open on a session snapshot, hide the editing UI, or move widgets into a side drawer.',
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
    title: 'Navigate & control',
    description:
      'Navigate to a region, lock down zoom and pan, and toggle tracks from your own code.',
    group: 'Navigation',
    sections: [
      {
        slug: 'external-navigate',
        title: 'External navigation',
        description:
          'Drive the view from your own UI with navToLocString (a location string) or navToLocations (a {refName, start, end} object).',
      },
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
  {
    slug: 'flipping-regions',
    title: 'Flip regions',
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

  // --- Styling & theming ---
  {
    slug: 'theming',
    title: 'Theming & styling',
    description:
      'A custom or dark Material UI theme, styling from the host page, or Shadow DOM isolation.',
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
      {
        slug: 'with-outside-styling',
        title: 'Styling from outside the component',
        description: 'Style the embed from your surrounding page CSS.',
      },
      {
        slug: 'shadow-dom',
        title: 'Package as a custom element',
        description:
          'Register the view as a <jbrowse-linear-view> web component, shadow-isolated from the host page.',
      },
    ],
  },

  // --- Track display & coloring ---
  {
    slug: 'feature-colors-and-labels',
    title: 'Colors & labels',
    description:
      'Color and label features dynamically with jexl callbacks, or quickly with the displayDefaults color shorthand.',
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
    title: 'Alignments',
    description:
      'Open a BAM/CRAM track with a chosen display, group reads by SAM tag, and set the display options up front.',
    group: 'Track display & coloring',
    // the display-options section uses real HG002 nanopore reads (long,
    // modification-tagged), a heavy remote fetch, and modification rendering is
    // a GPU path CI's headless software-WebGL can choke on. Ships in a real
    // browser
    skipSmoke: true,
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
      {
        slug: 'alignments-track-options',
        title: 'Custom alignments display options',
        description:
          'Configure a LinearAlignmentsDisplay up front on real HG002 haplotagged nanopore data.',
      },
    ],
  },
  {
    slug: 'specialized-track-types',
    title: 'Signal, gene, variant',
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
    title: 'Track sizing',
    description:
      'What a feature track does with more rows than fit: grow, or squeeze them into a fixed height.',
    group: 'Track display & coloring',
    sections: [
      {
        slug: 'track-sizing',
        title: 'Track sizing: grow & fit',
      },
    ],
  },

  // --- Sessions & state ---
  {
    slug: 'session-setup',
    title: 'Init & persistence',
    description:
      'A richer initial view with advanced init and highlights, then persisting or sharing the live session.',
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
      {
        slug: 'session-in-url',
        title: 'Put the session in the URL',
        description:
          'Serialize the session with encodeSession and restore it with decodeSession, for a sharable link.',
      },
    ],
  },
  {
    slug: 'multiple-views',
    title: 'Multiple views',
    description:
      'React to the view from your own companion panels, and render several independent views on one page.',
    group: 'Sessions & state',
    sections: [
      {
        slug: 'observe-visible',
        title: 'Observe the visible view',
        description:
          'React to the regions and features currently visible in the view from your own companion panels.',
      },
      {
        slug: 'observe-selection',
        title: 'Observe the selected feature',
        description:
          'Mirror the clicked feature (session.selection) into a companion panel with an observer.',
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
    title: 'Export & errors',
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
    title: 'Text search',
    description:
      'Search by gene name or ID, across all tracks with an aggregate adapter, or per-track.',
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
    title: 'Plugins & accounts',
    description:
      'Plugins loaded at runtime or defined inline, authenticated data via internet accounts, and the web worker RPC.',
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
    title: 'Human exome',
    description: 'A human exome sequencing dataset on hg38.',
    group: 'Real-world demos',
    sections: [
      {
        slug: 'human-exome-example',
        title: 'Human exome example',
      },
    ],
  },
  {
    slug: 'nextstrain-pathogens',
    title: 'Nextstrain pathogens',
    description:
      'Genes, diversity, and a per-sample genotype matrix for SARS-CoV-2, Zika, Ebola, measles, and RSV-A. Pick a pathogen from the dropdown.',
    group: 'Real-world demos',
    // the genotype-matrix GPU render crashes CI's headless software-WebGL
    skipSmoke: true,
    sections: [
      {
        slug: 'nextstrain-pathogens',
        title: 'Nextstrain pathogens',
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
      },
    ],
  },
  {
    slug: 'single-cell-umap',
    title: 'Single-cell UMAP',
    description:
      'A UMAP of 5k PBMCs beside per-cell-type coverage: select clusters to filter rows, click a gene to color cells.',
    group: 'Real-world demos',
    sections: [
      {
        slug: 'single-cell-umap',
        title: 'Single-cell UMAP linked to coverage',
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
      },
    ],
  },
]

export const examples = flattenExamples(pages)

// bound to this site's `pages` so page files call getPage('slug') directly
export const getPage = (slug: string) => findPage(pages, slug)
