import { findPage, flattenExamples } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage, ExampleSection } from './exampleModel.ts'
export { section } from './exampleModel.ts'

// Ordered as a build, not a catalogue: most pages add one thing to the page
// before them, and the sidebar groups follow that arc. The first two run the
// other way -- pan and zoom is the point of a genome browser, so it leads,
// and One track follows to show the bare view it's built from. The last two
// turn around: everything up to them is about getting data onto the screen,
// then one is about driving it from outside and the last about getting a click
// back off it. The worker page sits outside that arc, on the end: it changes
// nothing you can see, and every page before it defers to it in a comment.
export const pages: ExamplePage[] = [
  {
    slug: 'pan-and-zoom',
    title: 'Pan and zoom',
    description:
      'A measured div, one track, and the hook that turns a wheel and a drag into the two calls that move it.',
    group: 'The atoms',
    sections: [{ slug: 'pan-and-zoom', title: 'Wheel and drag' }],
  },
  {
    slug: 'one-track',
    title: 'One track, no interaction',
    description:
      'The same view with the pan/zoom hook taken back out: a measured div and one track, nothing else.',
    group: 'The atoms',
    sections: [{ slug: 'one-track', title: 'No pan, no zoom, no chrome' }],
  },
  {
    slug: 'a-stack-of-tracks',
    title: 'A stack of tracks',
    description:
      'A wiggle, a feature track, and an alignments pileup in one column, all mounted by the same code.',
    group: 'The atoms',
    sections: [{ slug: 'a-stack-of-tracks', title: 'Wiggle, features, reads' }],
  },
  {
    slug: 'bring-your-own-overlays',
    title: 'Bring your own overlays',
    description:
      "Write the components that draw a track's status states, and JBrowse's own displays render no Material UI at all.",
    group: 'Making it yours',
    // no section description: a single-section page draws no "On this page"
    // card, so it would render nowhere
    sections: [
      { slug: 'bring-your-own-overlays', title: 'Plain overlays, no MUI' },
    ],
  },
  {
    slug: 'add-the-chrome-you-want',
    title: 'Add the chrome you want',
    description:
      'Add back only what your app needs: a coordinate ruler and track labels, written against the view model the tracks read.',
    group: 'Making it yours',
    sections: [
      { slug: 'add-the-chrome-you-want', title: 'A ruler and some labels' },
    ],
  },
  {
    slug: 'a-scalebar-not-a-ruler',
    title: 'A scalebar, not a ruler',
    description:
      'Labelled ticks, gridlines behind the data, region names that stay on screen while you pan, and drag across it to zoom.',
    group: 'Making it yours',
    sections: [
      { slug: 'a-scalebar-not-a-ruler', title: 'Ticks, names, drag to zoom' },
    ],
  },
  {
    slug: 'drive-it-from-your-app',
    title: 'Drive it from your app',
    description:
      'A location box, zoom buttons and a track list, written against the view model.',
    group: 'Making it yours',
    sections: [
      {
        slug: 'drive-it-from-your-app',
        title: 'A location box and a track list',
      },
    ],
  },
  {
    slug: 'every-chromosome',
    title: 'Every chromosome at once',
    description:
      'A whole-genome view is the same view with 24 displayed regions, a seam between each and a name on each.',
    group: 'Making it yours',
    sections: [{ slug: 'every-chromosome', title: 'hg38, end to end' }],
  },
  {
    slug: 'your-own-feature-details',
    title: 'Your own feature details',
    description:
      'Click a gene and the display writes it to the session selection — read that one field and the panel is yours to draw.',
    group: 'Making it yours',
    sections: [{ slug: 'your-own-feature-details', title: 'Click a gene' }],
  },
  {
    slug: 'run-it-in-a-worker',
    title: 'Run it in a worker',
    description:
      'Move fetching, parsing and layout off the main thread with one option to createViewState.',
    group: 'In production',
    sections: [{ slug: 'run-it-in-a-worker', title: 'One option, one worker' }],
  },
]

export const examples = flattenExamples(pages)

export function getPage(slug: string) {
  return findPage(pages, slug)
}
