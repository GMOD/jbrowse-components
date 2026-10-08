import { findPage } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage } from './exampleModel.ts'

export const pages: ExamplePage[] = [
  {
    slug: 'one-linear-genome-view',
    title: 'The simplest example',
    description: 'One component, three props: assembly, tracks, view.',
    group: 'Getting started',
  },
  {
    slug: 'track-shorthand',
    title: 'Tracks as an id and a uri',
    description: 'The extension picks the track type and the adapter.',
    group: 'Getting started',
  },
  {
    slug: 'view-prop',
    title: 'The view to open',
    description: 'The view prop against a real assembly (hg38).',
    group: 'Getting started',
  },
  {
    slug: 'use-create-view-state',
    title: 'useCreateViewState',
    description: 'Hold the view state yourself, stable across re-renders.',
    group: 'Getting started',
  },
  {
    slug: 'genome-by-name',
    title: 'A hosted genome',
    description:
      'jbrowseHub fetches a genome, its tracks and its gene search by name.',
    group: 'Getting started',
  },
  {
    slug: 'default-session',
    title: 'Open on a default session',
    description: 'A session carries what view cannot: a track of its own.',
    group: 'Layout and chrome',
  },
  {
    slug: 'disable-add-track',
    title: 'Disable the add-track UI',
    description: 'Hide the "add track" UI for a locked-down embed.',
    group: 'Layout and chrome',
  },
  {
    slug: 'drawer-widget',
    title: 'Widgets in a side drawer',
    description: 'Put the track selector and feature details in a drawer.',
    group: 'Layout and chrome',
  },
  {
    slug: 'fixed-height',
    title: 'Fitting the view in a fixed-height box',
    description: 'The height prop, or a host box of your own.',
    group: 'Layout and chrome',
  },
  {
    slug: 'external-navigate',
    title: 'External navigation',
    description:
      'navToLocString for a locstring, navToLocations for coordinates.',
    group: 'Navigation and search',
  },
  {
    slug: 'disable-zoom-and-side-scroll',
    title: 'Disable zoom and side scroll',
    description: 'Lock the view so users cannot zoom or pan.',
    group: 'Navigation and search',
  },
  {
    slug: 'show-track',
    title: 'Show a track programmatically',
    description: 'Show and hide a track from your own button.',
    group: 'Navigation and search',
  },
  {
    slug: 'flipped-regions',
    title: 'Flipped regions',
    description:
      'Several regions, some reversed, and a horizontallyFlip() button.',
    group: 'Navigation and search',
  },
  {
    slug: 'aggregate-text-search',
    title: 'Aggregate text searching',
    description: 'One trix index spanning every track.',
    group: 'Navigation and search',
  },
  {
    slug: 'per-track-text-search',
    title: 'Per-track text searching',
    description: 'An index attached to one track config.',
    group: 'Navigation and search',
  },
  {
    slug: 'jexl-colors-and-labels',
    title: 'Jexl feature colors and labels',
    description: 'Color and re-label each feature from its own attributes.',
    group: 'Tracks',
  },
  {
    slug: 'track-sizing',
    title: 'Track sizing: grow & fit',
    description: 'heightMode, with the same crowded locus opened twice.',
    group: 'Tracks',
  },
  {
    slug: 'feature-highlights',
    title: 'Highlight a feature, and sort it to the top',
    description: 'featureHighlights boxes one feature and pins its row.',
    group: 'Tracks',
  },
  {
    slug: 'alignments-display',
    title: 'Initialize an alignments display',
    description: 'A displaySnapshot on a view.tracks entry.',
    group: 'Tracks',
  },
  {
    slug: 'group-by-tag',
    title: 'Group alignments by tag',
    description: 'facet splits the pileup into labeled lanes.',
    group: 'Tracks',
  },
  {
    slug: 'reads-as-marks',
    title: 'Haplotagged reads, declared as marks',
    description: 'A formula, a facet and a span mark over haplotagged reads.',
    group: 'Tracks',
  },
  {
    slug: 'wiggle-track',
    title: 'Quantitative (BigWig) track',
    description: 'A wiggle display, configured through displayDefaults.',
    group: 'Tracks',
  },
  {
    slug: 'gtf-track',
    title: 'GTF gene model track',
    description: 'Genes and transcripts built from per-feature lines.',
    group: 'Tracks',
  },
  {
    slug: 'multi-sample-variants',
    title: 'Multi-sample variant display',
    description: 'One row per sample, colored by a samples TSV column.',
    group: 'Tracks',
  },
  {
    slug: 'custom-theme',
    title: 'Custom theme',
    description: 'Four named palette colors drive most of the chrome.',
    group: 'Theming',
  },
  {
    slug: 'dark-theme',
    title: 'Dark theme',
    description: 'palette.mode: dark.',
    group: 'Theming',
  },
  {
    slug: 'outside-styling',
    title: 'Styling from outside the component',
    description: 'The view inherits CSS from its host by default.',
    group: 'Theming',
  },
  {
    slug: 'shadow-dom',
    title: 'Package as a custom element',
    description: 'A <jbrowse-linear-view> tag, shadow-isolated.',
    group: 'Theming',
  },
  {
    slug: 'view-spelled-out',
    title: 'A view spelled out',
    description: 'displaySnapshot, tracklist, nav, and labeled highlights.',
    group: 'Sessions',
  },
  {
    slug: 'session-persistence',
    title: 'Persist & restore the session',
    description: 'onSnapshot out, session back in.',
    group: 'Sessions',
  },
  {
    slug: 'session-in-url',
    title: 'Put the session in the URL',
    description: 'encodeSession / decodeSession, for a sharable link.',
    group: 'Sessions',
  },
  {
    slug: 'observe-visible',
    title: 'Observe the visible view',
    description: 'An observer reading the regions currently on screen.',
    group: 'Sessions',
  },
  {
    slug: 'observe-selection',
    title: 'Observe the selected feature',
    description: 'Mirror session.selection into your own panel.',
    group: 'Sessions',
  },
  {
    slug: 'two-views',
    title: 'Two linear genome views',
    description: 'Two independent views on one page.',
    group: 'Sessions',
  },
  {
    slug: 'export-svg',
    title: 'Export the view (SVG/PNG)',
    description: 'The exportSvg action, through a ref.',
    group: 'Integration',
    skipSmoke: true,
  },
  {
    slug: 'error-handler',
    title: 'Custom error handling',
    description: 'createViewState throws on a config it cannot build.',
    group: 'Integration',
    skipSmoke: true,
  },
  {
    slug: 'external-plugin',
    title: 'External plugin',
    description: 'loadPlugins fetches a bundle at runtime.',
    group: 'Integration',
  },
  {
    slug: 'inline-plugin',
    title: 'Inline plugin',
    description: 'Pass a Plugin subclass from your own source.',
    group: 'Integration',
  },
  {
    slug: 'internet-accounts',
    title: 'Internet accounts (authentication)',
    description: 'A per-track fetch override, usually a bearer token.',
    group: 'Integration',
  },
  {
    slug: 'web-worker',
    title: 'Web worker',
    description: 'Move parsing and rendering off the main thread.',
    group: 'Integration',
  },
  {
    slug: 'local-files',
    title: 'Files from your host process',
    description:
      'Open a track on bytes your host process holds, with no web server.',
    group: 'Integration',
  },
  {
    slug: 'without-react',
    title: 'Without React',
    description:
      'createLinearGenomeView mounts into an element and hands back a controller.',
    group: 'Integration',
  },
  {
    slug: 'methylation-by-haplotype',
    title: 'Methylation by haplotype',
    description:
      'Nanopore reads at SNRPN: one haplotype methylated, the other not.',
    group: 'Real-world demos',
  },
  {
    slug: 'nextstrain-pathogens',
    title: 'Nextstrain pathogens',
    description: 'Genes, diversity and genotypes for five viral genomes.',
    group: 'Real-world demos',
    skipSmoke: true,
  },
  {
    slug: 'locus-zoom-ld',
    title: 'LocusZoom-style LD',
    description: 'GWAS summary statistics colored by LD to the lead SNP.',
    group: 'Real-world demos',
  },
  {
    slug: 'single-cell-umap',
    title: 'Single-cell UMAP',
    description:
      'Select clusters to filter coverage rows; click a gene to color cells.',
    group: 'Real-world demos',
  },
  {
    slug: 'pan-ukb-gwas',
    title: 'Pan-UKB GWAS',
    description: 'Pan-UK Biobank GWAS summary statistics across phenotypes.',
    group: 'Real-world demos',
  },
]

export function getPage(slug: string) {
  return findPage(pages, slug)
}
