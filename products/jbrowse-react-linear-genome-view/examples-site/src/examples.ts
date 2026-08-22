import { findPage, flattenExamples } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage, ExampleSection } from './exampleModel.ts'
export { section } from './exampleModel.ts'

// Five groups on purpose. Every one-page group is a sidebar heading that costs a
// line and earns nothing, so text search sits under Navigation and theming under
// Tracks rather than each holding a heading of its own.
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
        description: 'One component, three props: assembly, tracks, init.',
      },
      {
        slug: 'with-init',
        title: 'Declarative init',
        description: 'The same call against a real assembly (hg38).',
      },
      {
        slug: 'use-create-view-state',
        title: 'useCreateViewState',
        description: 'Hold the view state yourself, stable across re-renders.',
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
        description: 'The full snapshot form, for when init is not enough.',
      },
      {
        slug: 'disable-add-track',
        title: 'Disable the add-track UI',
        description: 'Hide the "add track" UI for a locked-down embed.',
      },
      {
        slug: 'with-drawer-widget',
        title: 'Widgets in a side drawer',
        description: 'Put the track selector and feature details in a drawer.',
      },
      {
        slug: 'fixed-height',
        title: 'Fitting the view in a fixed-height box',
        description:
          'What a host box does to a view that is taller than it, and what drawerViewHeight does.',
      },
    ],
  },

  // --- Navigation & search ---
  {
    slug: 'navigate-to-location',
    title: 'Navigate & control',
    description:
      'Navigate to a region, lock down zoom and pan, and toggle tracks from your own code.',
    group: 'Navigation & search',
    sections: [
      {
        slug: 'external-navigate',
        title: 'External navigation',
        description:
          'navToLocString for a locstring, navToLocations for coordinates.',
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
    group: 'Navigation & search',
    sections: [
      {
        slug: 'horizontally-flip',
        title: 'Horizontally flip the view',
        description: 'A horizontallyFlip() button, or a [rev] locstring.',
      },
      {
        slug: 'with-multiple-displayed-regions-flipped',
        title: 'Multiple displayed regions, some flipped',
        description: 'Several regions at once, individually reversed.',
      },
    ],
  },
  {
    slug: 'text-searching',
    title: 'Text search',
    description:
      'Search by gene name or ID, across all tracks with an aggregate adapter, or per-track.',
    group: 'Navigation & search',
    sections: [
      {
        slug: 'with-aggregate-text-searching',
        title: 'Aggregate text searching',
        description: 'One trix index spanning every track.',
      },
      {
        slug: 'with-per-track-text-searching',
        title: 'Per-track text searching',
        description: 'An index attached to one track config.',
      },
    ],
  },

  // --- Tracks & styling ---
  {
    slug: 'feature-colors-and-labels',
    title: 'Colors, labels & sizing',
    description:
      'How a feature track looks: color and label per feature with jexl, what it does when rows overflow, and marking one feature.',
    group: 'Tracks & styling',
    sections: [
      {
        slug: 'with-track-color-shorthand',
        title: 'Track color shorthand',
        description: 'displayDefaults routes a setting to the right display.',
      },
      {
        slug: 'with-jexl-feature-colors-and-labels',
        title: 'Jexl feature colors and labels',
        description: 'Color and re-label each feature from its own attributes.',
      },
      {
        slug: 'track-sizing',
        title: 'Track sizing: grow & fit',
        description: 'heightMode, with the same crowded locus opened twice.',
      },
      {
        slug: 'with-feature-highlights',
        title: 'Highlight a feature, and sort it to the top',
        description: 'featureHighlights boxes one feature and pins its row.',
      },
    ],
  },
  {
    slug: 'alignments-tracks',
    title: 'Alignments',
    description:
      'Open a BAM/CRAM track with a chosen display, group reads by SAM tag, and set the display options up front.',
    group: 'Tracks & styling',
    // the display-options section uses real HG002 nanopore reads (long,
    // modification-tagged), a heavy remote fetch, and modification rendering is
    // a GPU path CI's headless software-WebGL can choke on. Ships in a real
    // browser
    skipSmoke: true,
    sections: [
      {
        slug: 'with-init-alignments-display',
        title: 'Initialize an alignments display',
        description: 'A displaySnapshot on an init.tracks entry.',
      },
      {
        slug: 'with-group-by-tag',
        title: 'Group alignments by tag',
        description: 'groupBy splits the pileup into labeled lanes.',
      },
      {
        slug: 'alignments-track-options',
        title: 'Custom alignments display options',
        description: 'The slots worth knowing, on real haplotagged ONT reads.',
      },
    ],
  },
  {
    slug: 'specialized-track-types',
    title: 'Signal, gene, variant',
    description:
      'Quantitative signal from a BigWig, gene models from a GTF, and a multi-sample VCF as a matrix.',
    group: 'Tracks & styling',
    sections: [
      {
        slug: 'with-wiggle-track',
        title: 'Quantitative (BigWig) track',
        description: 'A wiggle display, configured through displayDefaults.',
      },
      {
        slug: 'with-gtf-track',
        title: 'GTF gene model track',
        description: 'Genes and transcripts built from per-feature lines.',
      },
      {
        slug: 'with-multi-sample-variant-display',
        title: 'Multi-sample variant display',
        description: 'One row per sample, grouped by a samples TSV column.',
      },
    ],
  },
  {
    slug: 'theming',
    title: 'Theming & styling',
    description:
      'A custom or dark Material UI theme, styling from the host page, or Shadow DOM isolation.',
    group: 'Tracks & styling',
    sections: [
      {
        slug: 'with-custom-theme',
        title: 'Custom theme',
        description: 'Four named palette colors drive most of the chrome.',
      },
      {
        slug: 'with-dark-theme',
        title: 'Dark theme',
        description: 'palette.mode: dark.',
      },
      {
        slug: 'with-outside-styling',
        title: 'Styling from outside the component',
        description: 'The view inherits CSS from its host by default.',
      },
      {
        slug: 'shadow-dom',
        title: 'Package as a custom element',
        description: 'A <jbrowse-linear-view> tag, shadow-isolated.',
      },
    ],
  },

  // --- Sessions & integration ---
  {
    slug: 'session-setup',
    title: 'Init & persistence',
    description:
      'A richer initial view with advanced init and highlights, then persisting or sharing the live session.',
    group: 'Sessions & integration',
    sections: [
      {
        slug: 'with-init-advanced',
        title: 'Advanced init',
        description:
          'displaySnapshot, trackSnapshot, tracklist, nav, highlight.',
      },
      {
        slug: 'with-session-highlights',
        title: 'Session highlights',
        description: 'Painted regions that carry a color and a label.',
      },
      {
        slug: 'with-session-persistence',
        title: 'Persist & restore the session',
        description: 'onSnapshot out, defaultSession back in.',
      },
      {
        slug: 'session-in-url',
        title: 'Put the session in the URL',
        description: 'encodeSession / decodeSession, for a sharable link.',
      },
    ],
  },
  {
    slug: 'multiple-views',
    title: 'Multiple views',
    description:
      'React to the view from your own companion panels, and render several independent views on one page.',
    group: 'Sessions & integration',
    sections: [
      {
        slug: 'observe-visible',
        title: 'Observe the visible view',
        description: 'An observer reading the regions currently on screen.',
      },
      {
        slug: 'observe-selection',
        title: 'Observe the selected feature',
        description: 'Mirror session.selection into your own panel.',
      },
      {
        slug: 'with-two-linear-genome-views',
        title: 'Two linear genome views',
        description: 'Two independent views on one page.',
      },
    ],
  },
  {
    slug: 'export-and-errors',
    title: 'Export & errors',
    description:
      'Render the whole view to a vector SVG (or rasterized PNG), and catch and render view errors with your own UI.',
    group: 'Sessions & integration',
    // exportSvg re-renders every track's GPU layer through the SVG path, which
    // crashes CI's headless software-WebGL
    skipSmoke: true,
    sections: [
      {
        slug: 'export-svg',
        title: 'Export the view (SVG/PNG)',
        description: 'The exportSvg action, through a ref.',
      },
      {
        slug: 'with-error-handler',
        title: 'Custom error handling',
        description:
          'Construction errors throw; runtime errors go on view.error.',
      },
    ],
  },
  {
    slug: 'plugins',
    title: 'Plugins & accounts',
    description:
      'Plugins loaded at runtime or defined inline, authenticated data via internet accounts, and the web worker RPC.',
    group: 'Sessions & integration',
    sections: [
      {
        slug: 'with-external-plugin',
        title: 'External plugin',
        description: 'loadPlugins fetches a bundle at runtime.',
      },
      {
        slug: 'with-inline-plugins',
        title: 'Inline plugins',
        description: 'Pass a Plugin subclass from your own source.',
      },
      {
        slug: 'with-internet-accounts',
        title: 'Internet accounts (authentication)',
        description: 'A per-track fetch override, usually a bearer token.',
      },
      {
        slug: 'with-web-worker',
        title: 'Web worker RPC',
        description: 'Move parsing and rendering off the main thread.',
      },
    ],
  },

  {
    slug: 'local-files',
    title: 'Files from your host process',
    description:
      'Open a track on bytes your host already holds — a notebook kernel, an R session — with no web server and no CORS.',
    group: 'Sessions & integration',
    sections: [
      {
        slug: 'with-local-files',
        title: 'Local files',
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
      'Genes, diversity, and a per-sample genotype matrix for SARS-CoV-2, Zika, Ebola, measles, and RSV-A.',
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
