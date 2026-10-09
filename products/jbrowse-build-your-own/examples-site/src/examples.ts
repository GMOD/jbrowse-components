import { findPage } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage } from './exampleModel.ts'

export const pages: ExamplePage[] = [
  {
    slug: 'ultraminimal',
    title: 'Ultraminimal',
    description:
      'TrackStack draws one track. Drag to pan, ctrl or cmd + wheel to zoom.',
    group: 'First view',
  },
  {
    slug: 'multiple-tracks',
    title: 'Multiple tracks',
    description:
      "A wiggle, genes and reads, with JBrowse's default Material UI overlays.",
    group: 'First view',
  },
  {
    slug: 'view-controls',
    title: 'Location box, zoom and track toggles',
    description:
      'A location box, zoom buttons and track toggles call methods on the view.',
    group: 'Navigation',
  },
  {
    slug: 'search-by-name',
    title: 'Searching by name',
    description:
      'A location box looks up gene names in a text index and navigates to the match.',
    group: 'Navigation',
  },
  {
    slug: 'search-results',
    title: 'Search results as a list',
    description:
      'fetchResults returns the matches, and the page lists them as buttons.',
    group: 'Navigation',
  },
  {
    slug: 'scalebar-and-gridlines',
    title: 'Scalebar and gridlines',
    description: 'Drag across the scalebar to zoom, hover to read the base.',
    group: 'Navigation',
  },
  {
    slug: 'highlight-a-region',
    title: 'Highlighting a region',
    description:
      'Mark the region a link points at, and keep it marked while panning.',
    group: 'Navigation',
  },
  {
    slug: 'track-labels',
    title: 'Track labels and resize bars',
    description: 'Labels beside the tracks, and a bar to resize each.',
    group: 'Tracks',
  },
  {
    slug: 'track-selector',
    title: 'A track selector sidebar',
    description:
      'A sidebar groups session.tracks by category, with a checkbox per track.',
    group: 'Tracks',
  },
  {
    slug: 'track-settings',
    title: 'Track settings',
    description: 'A Color by menu, a legend toggle and a read-height slider.',
    group: 'Tracks',
  },
  {
    slug: 'feature-details',
    title: 'Feature details on click',
    description:
      'A panel lists the attributes of the feature in session.selection.',
    group: 'Tracks',
  },
  {
    slug: 'track-loading-and-errors',
    title: 'Track loading and error states',
    description:
      'DisplayUIProvider swaps the overlay a track draws while it loads or fails.',
    group: 'Loading, errors and theme',
  },
  {
    slug: 'view-loading-and-errors',
    title: 'View loading and error states',
    description:
      "The page draws the view's loading, error, no-location and notification states.",
    group: 'Loading, errors and theme',
  },
  {
    slug: 'dark-theme',
    title: 'Dark theme',
    description: "The mode option sets light or dark from your app's state.",
    group: 'Loading, errors and theme',
  },
  {
    slug: 'genome-by-name',
    title: 'A hosted genome',
    description:
      'jbrowseHub fetches a genome, its tracks and its gene search by name.',
    group: 'Data sources',
  },
  {
    slug: 'local-files',
    title: 'Local files',
    description: 'A file picker opens a data file and its index from disk.',
    group: 'Data sources',
  },
  {
    slug: 'table-of-calls',
    title: 'Navigating from a table of calls',
    description: 'Click a structural variant call to open and mark it.',
    group: 'Data sources',
  },
  {
    slug: 'color-and-group-by-a-field',
    title: 'Coloring and grouping by a field',
    description:
      'Two menus set the color and the row facet from any attribute, with a Legend.',
    group: 'Custom plots',
  },
  {
    slug: 'plot-from-json',
    title: 'A plot declared in JSON',
    description: 'Alu copies as bars: height is age, color is lineage.',
    group: 'Custom plots',
  },
  {
    slug: 'every-chromosome',
    title: 'Every chromosome in one view',
    description: 'One view shows the 24 human chromosomes side by side.',
    group: 'Several regions and genomes',
  },
  {
    slug: 'synteny',
    title: 'Comparing two genomes',
    description: 'Human and mouse at BRCA1, joined by synteny ribbons.',
    group: 'Several regions and genomes',
  },
  {
    slug: 'gene-lanes',
    title: 'Gene lanes across genomes',
    description:
      'Twelve E. coli genomes under one view, joined on gene symbol.',
    group: 'Several regions and genomes',
  },
  {
    slug: 'web-worker',
    title: 'Web worker',
    description: 'Fetch and parse off the main thread with one option.',
    group: 'Workers, links and export',
  },
  {
    slug: 'session-in-url',
    title: 'Session in the URL',
    description: 'Save the view to a link and restore it on load.',
    group: 'Workers, links and export',
  },
  {
    slug: 'svg-figures',
    title: 'SVG figures',
    description:
      'The page redraws an SVG figure of the view after each navigation.',
    group: 'Workers, links and export',
  },
]

export function getPage(slug: string) {
  return findPage(pages, slug)
}
