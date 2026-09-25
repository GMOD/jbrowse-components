import { findPage, flattenExamples } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage, ExampleSection } from './exampleModel.ts'
export { section } from './exampleModel.ts'

export const pages: ExamplePage[] = [
  {
    slug: 'setting-up-the-view',
    title: 'View setup',
    description: 'Render the component and give it a starting state.',
    group: 'Getting started',
    sections: [
      {
        slug: 'one-linear-genome-view',
        title: 'The simplest example',
        description: 'One component, three props: assembly, tracks, view.',
      },
      {
        slug: 'with-track-shorthand',
        title: 'Tracks as an id and a uri',
        description: 'The extension picks the track type and the adapter.',
      },
      {
        slug: 'with-init',
        title: 'The view to open',
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
    slug: 'genome-by-name',
    title: 'A hosted genome',
    description:
      'jbrowseHub fetches a genome, its tracks and its gene search by name.',
    group: 'Getting started',
    sections: [
      {
        slug: 'genome-by-name',
        title: 'jbrowseHub, a gene as the location, tracks by id',
      },
    ],
  },
  {
    slug: 'default-session',
    title: 'Session & drawer',
    description:
      'Session snapshots, a locked-down UI, a drawer and a fixed height.',
    group: 'Getting started',
    sections: [
      {
        slug: 'default-session',
        title: 'Open on a default session',
        description: 'The full snapshot form, for when view is not enough.',
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
        description: 'The height prop, or a host box of your own.',
      },
    ],
  },

  {
    slug: 'navigate-to-location',
    title: 'Navigate & control',
    description: 'Drive the view from your own code.',
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
        description: 'Show and hide a track from your own button.',
      },
    ],
  },
  {
    slug: 'flipping-regions',
    title: 'Flip regions',
    description: 'Reverse the whole view, or some of its regions.',
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
    description: 'Search by feature name, across every track or per track.',
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

  {
    slug: 'feature-colors-and-labels',
    title: 'Colors, labels & sizing',
    description: 'Color, label, size and highlight a feature track.',
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
    description: 'BAM/CRAM tracks with their display options set up front.',
    group: 'Tracks & styling',
    skipSmoke: true,
    sections: [
      {
        slug: 'with-init-alignments-display',
        title: 'Initialize an alignments display',
        description: 'A displaySnapshot on a view.tracks entry.',
      },
      {
        slug: 'with-group-by-tag',
        title: 'Group alignments by tag',
        description: 'facet splits the pileup into labeled lanes.',
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
    description: 'BigWig signal, GTF gene models and a multi-sample VCF.',
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
        description: 'One row per sample, colored by a samples TSV column.',
      },
    ],
  },
  {
    slug: 'theming',
    title: 'Theming & styling',
    description: 'Material UI themes, host page CSS and Shadow DOM.',
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

  {
    slug: 'session-setup',
    title: 'Opening state & persistence',
    description: 'A richer initial view, then saving or sharing the session.',
    group: 'Sessions & integration',
    sections: [
      {
        slug: 'with-init-advanced',
        title: 'A view spelled out',
        description: 'displaySnapshot, tracklist, nav and highlight.',
      },
      {
        slug: 'with-session-highlights',
        title: 'Session highlights',
        description: 'Painted regions that carry a color and a label.',
      },
      {
        slug: 'with-session-persistence',
        title: 'Persist & restore the session',
        description: 'onSnapshot out, session back in.',
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
      'Companion panels that follow the view, and two views on one page.',
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
      'Export the view to SVG or PNG, and render its errors yourself.',
    group: 'Sessions & integration',
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
        description: 'createViewState throws on a config it cannot build.',
      },
    ],
  },
  {
    slug: 'plugins',
    title: 'Plugins & accounts',
    description: 'Plugins, authenticated data and the web worker.',
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
      'Open a track on bytes your host process holds, with no web server.',
    group: 'Sessions & integration',
    sections: [
      {
        slug: 'with-local-files',
        title: 'Local files',
      },
    ],
  },

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
    description: 'Genes, diversity and genotypes for five viral genomes.',
    group: 'Real-world demos',
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
    description: 'GWAS summary statistics colored by LD to the lead SNP.',
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
      'Select clusters to filter coverage rows; click a gene to color cells.',
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
    description: 'Pan-UK Biobank GWAS summary statistics across phenotypes.',
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

export const getPage = (slug: string) => findPage(pages, slug)
