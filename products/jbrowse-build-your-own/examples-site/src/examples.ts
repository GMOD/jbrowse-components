import { findPage } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage } from './exampleModel.ts'

export const pages: ExamplePage[] = [
  {
    slug: 'ultraminimal',
    title: 'Ultraminimal',
    description: 'One track. Drag to pan, ctrl or cmd + wheel to zoom.',
    group: 'Basics',
  },
  {
    slug: 'multiple-tracks',
    title: 'Multiple tracks',
    description:
      'A wiggle, genes and reads, with the stock Material UI chrome.',
    group: 'Basics',
  },
  {
    slug: 'genome-by-name',
    title: 'A hosted genome',
    description:
      'jbrowseHub fetches a genome, its tracks and its gene search by name.',
    group: 'Basics',
  },
  {
    slug: 'removing-material-ui',
    title: 'Removing Material UI',
    description: "Draw a track's loading and error states yourself.",
    group: 'Your own chrome',
  },
  {
    slug: 'loading-and-errors',
    title: 'Loading and error states',
    description:
      "The view's loading, error and no-location states, and its notifications.",
    group: 'Your own chrome',
  },
  {
    slug: 'scalebar-and-gridlines',
    title: 'Scalebar and gridlines',
    description: 'Drag across the scalebar to zoom, hover to read the base.',
    group: 'Your own chrome',
  },
  {
    slug: 'track-labels',
    title: 'Track labels and resize bars',
    description: 'Labels beside the tracks, and a bar to resize each.',
    group: 'Your own chrome',
  },
  {
    slug: 'dark-mode',
    title: 'Dark mode',
    description: "Your app's light or dark state, passed to the engine.",
    group: 'Your own chrome',
  },
  {
    slug: 'drive-it-from-your-app',
    title: 'Controlling the view',
    description:
      'A location box, zoom buttons and track toggles calling the view.',
    group: 'Your own controls',
  },
  {
    slug: 'your-own-feature-details',
    title: 'Feature details on click',
    description: 'Your panel reading session.selection.',
    group: 'Your own controls',
  },
  {
    slug: 'your-own-track-selector',
    title: 'A track selector sidebar',
    description: 'Categories and checkboxes from session.tracks.',
    group: 'Your own controls',
  },
  {
    slug: 'a-table-of-calls',
    title: 'A table that drives the view',
    description: 'Click a structural variant call to open and mark it.',
    group: 'Your own controls',
  },
  {
    slug: 'search-by-name',
    title: 'Searching by name',
    description: 'Gene names in a location box, through a text index.',
    group: 'Your own controls',
  },
  {
    slug: 'your-own-search-results',
    title: 'Your own list of hits',
    description: 'fetchResults without navigating.',
    group: 'Your own controls',
  },
  {
    slug: 'track-settings',
    title: 'Track settings',
    description: 'A Color by menu, a legend toggle and a read-height slider.',
    group: 'Your own controls',
  },
  {
    slug: 'highlight-a-region',
    title: 'Highlighting a region',
    description:
      'Mark the region a link points at, and keep it marked while panning.',
    group: 'Your own controls',
  },
  {
    slug: 'local-files',
    title: 'Local files',
    description: 'Open files from disk with your own picker.',
    group: 'Your own controls',
  },
  {
    slug: 'every-chromosome',
    title: 'The whole genome at once',
    description: 'One view with 24 regions.',
    group: 'Your own plots',
  },
  {
    slug: 'color-and-group-by-a-field',
    title: 'Coloring and grouping by a field',
    description:
      'Any attribute as a color or a row group, with a key you place.',
    group: 'Your own plots',
  },
  {
    slug: 'a-plot-from-json',
    title: 'A plot declared in JSON',
    description: 'Alu copies as bars: height is age, color is lineage.',
    group: 'Your own plots',
  },
  {
    slug: 'session-in-url',
    title: 'Session in the URL',
    description: 'Save the view to a link and restore it on load.',
    group: 'Going further',
  },
  {
    slug: 'web-worker',
    title: 'Web worker',
    description: 'Fetch and parse off the main thread with one option.',
    group: 'Going further',
  },
  {
    slug: 'synteny',
    title: 'Comparing two genomes',
    description: 'Human and mouse at BRCA1, joined by synteny ribbons.',
    group: 'Going further',
  },
  {
    slug: 'gene-lanes',
    title: 'Gene lanes across genomes',
    description:
      'Twelve E. coli genomes under one view, joined on gene symbol.',
    group: 'Going further',
  },
  {
    slug: 'svg-figures',
    title: 'SVG figures',
    description: 'An SVG figure of the view, redrawn as the reader navigates.',
    group: 'Going further',
  },
]

export function getPage(slug: string) {
  return findPage(pages, slug)
}
