import { findPage, flattenExamples } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage, ExampleSection } from './exampleModel.ts'
export { section } from './exampleModel.ts'

export const pages: ExamplePage[] = [
  {
    slug: 'ultraminimal',
    title: 'Ultraminimal',
    description: 'One track. Drag to pan, ctrl or cmd + wheel to zoom.',
    group: 'Basics',
    sections: [{ slug: 'one-track', title: 'One track' }],
  },
  {
    slug: 'multiple-tracks',
    title: 'Multiple tracks',
    description:
      'A wiggle, genes and reads, with the stock Material UI chrome.',
    group: 'Basics',
    sections: [
      { slug: 'a-stack-of-tracks', title: 'A wiggle, some genes, and reads' },
    ],
  },
  {
    slug: 'genome-by-name',
    title: 'A genome by name',
    description:
      "A hosted genome's sequence, tracks and gene search from its name.",
    group: 'Basics',
    sections: [
      {
        slug: 'genome-by-name',
        title: 'hg38 by name, a gene as the location, your file on top',
      },
    ],
  },
  {
    slug: 'removing-material-ui',
    title: 'Removing Material UI',
    description: "Draw a track's loading and error states yourself.",
    group: 'Your own UI',
    sections: [
      {
        slug: 'bring-your-own-overlays',
        title: 'Plain loading, error and corner controls',
      },
    ],
  },
  {
    slug: 'loading-and-errors',
    title: 'Loading and error states',
    description:
      "The view's loading, error and no-location states, and its notifications.",
    group: 'Your own UI',
    sections: [
      {
        slug: 'loading-and-errors',
        title: 'Loading, failing, and waiting for a location',
      },
    ],
  },
  {
    slug: 'scalebar-and-labels',
    title: 'Scalebar and track labels',
    description:
      'A scalebar with gridlines and drag-to-zoom, and labels with resize bars.',
    group: 'Your own UI',
    sections: [
      {
        slug: 'scalebar',
        title: 'Scalebar, gridlines and drag to zoom',
        description: 'Drag across the scalebar to zoom.',
      },
      {
        slug: 'track-labels',
        title: 'Track labels and resize bars',
        description: 'Drag a bar to resize its track.',
      },
    ],
  },
  {
    slug: 'controlling-the-view',
    title: 'Controlling the view',
    description:
      'Navigate, zoom and toggle tracks from your own UI, and read clicks back.',
    group: 'Your own UI',
    sections: [
      {
        slug: 'drive-it-from-your-app',
        title: 'A location box, zoom buttons and a track list',
        description: 'Your toolbar calling the view model.',
      },
      {
        slug: 'every-chromosome',
        title: 'The whole genome at once',
        description: 'The same view with 24 regions.',
      },
      {
        slug: 'your-own-feature-details',
        title: 'Feature details on click',
        description: 'Your panel reading session.selection.',
      },
      {
        slug: 'your-own-track-selector',
        title: 'A track selector sidebar',
        description: 'Categories and checkboxes from session.tracks.',
      },
    ],
  },
  {
    slug: 'search-by-name',
    title: 'Searching by name',
    description: 'Gene names in a location box, and your own list of hits.',
    group: 'Your own UI',
    sections: [
      {
        slug: 'search-by-name',
        title: 'A name instead of a locstring',
        description: 'navToLocString with a text index.',
      },
      {
        slug: 'your-own-search-results',
        title: 'Your own list of hits',
        description: 'fetchResults without navigating.',
      },
    ],
  },
  {
    slug: 'track-settings',
    title: 'Track settings',
    description: 'A Color by menu, a legend toggle and a read-height slider.',
    group: 'Your own UI',
    sections: [
      {
        slug: 'color-by-from-your-own-ui',
        title: 'A Color by menu, and the legend it raises',
      },
    ],
  },
  {
    slug: 'color-and-group-by-a-field',
    title: 'Coloring and grouping by a field',
    description:
      'Any attribute as a color or a row group, with a key you place.',
    group: 'Your own UI',
    sections: [
      {
        slug: 'color-and-group-by-a-field',
        title: 'Genes colored and grouped by an attribute',
      },
    ],
  },
  {
    slug: 'a-plot-from-json',
    title: 'A plot declared in JSON',
    description: 'Alu copies as bars: height is age, color is lineage.',
    group: 'Your own UI',
    sections: [
      {
        slug: 'a-plot-from-json',
        title: 'A BED column as bar height, another as color',
      },
    ],
  },
  {
    slug: 'local-files',
    title: 'Local files',
    description: 'Open files from disk with your own picker.',
    group: 'Your own UI',
    sections: [
      {
        slug: 'open-a-local-file',
        title: 'A file picker, and a file from another genome',
      },
    ],
  },
  {
    slug: 'highlight-a-region',
    title: 'Highlighting a region',
    description:
      'Mark the region a link points at, and keep it marked while panning.',
    group: 'Your own UI',
    sections: [
      {
        slug: 'highlight-a-region',
        title: 'Bands your app places',
      },
    ],
  },
  {
    slug: 'web-workers',
    title: 'Web workers',
    description: 'Fetch and parse off the main thread with one option.',
    group: 'Going further',
    sections: [{ slug: 'run-it-in-a-worker', title: 'One option, one worker' }],
  },
  {
    slug: 'synteny',
    title: 'Comparing two genomes',
    description: 'Human and mouse at BRCA1, joined by synteny ribbons.',
    group: 'Going further',
    sections: [
      { slug: 'synteny-ribbons', title: 'Two linear views and a ribbon band' },
    ],
  },
  {
    slug: 'gene-lanes',
    title: 'Gene lanes across genomes',
    description:
      'Twelve E. coli genomes under one view, joined on gene symbol.',
    group: 'Going further',
    sections: [
      { slug: 'gene-lanes', title: 'A lane per genome, and a key above them' },
    ],
  },
  {
    slug: 'svg-figures',
    title: 'SVG figures',
    description: 'An SVG figure of the view, redrawn as the reader navigates.',
    group: 'Going further',
    sections: [{ slug: 'svg-figure', title: 'A figure that follows the view' }],
  },
]

export const examples = flattenExamples(pages)

export function getPage(slug: string) {
  return findPage(pages, slug)
}
