import { findPage, flattenExamples } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage, ExampleSection } from './exampleModel.ts'
export { section } from './exampleModel.ts'

// Ordered as a build, not a catalogue: most pages add one thing to the page
// before them, and the sidebar groups follow that arc. Closely-related demos
// share a page rather than each taking a sidebar line -- 11 entries were mostly
// one-idea pages a reader had to click through in order, which is what
// `ExamplePage.sections` exists to avoid.
//
// **A sidebar entry names the thing you came looking for**, in the words
// someone would use before they knew this codebase: "Multiple tracks", "Web
// workers", "Comparing two genomes". They used to be phrases from the arc
// instead -- "A scalebar, not a ruler" is a contrast with the page above it and
// a riddle to anyone who has not read that page, "Add the chrome you want" uses
// a word this repo says constantly and a reader never does. Section titles under
// each page carry the detail; the sidebar carries the concept.
//
// **What may NOT share a page is decided by `scripts/smoke.mjs`.** Its MUI
// census counts Material elements per *document*, so merging a page that shows
// stock displays into one that shows plain ones leaves a page whose budget is
// the sum and an argument nothing measures any more. That is the whole reason
// `Multiple tracks` is still alone: it is the deliberate before, the one page
// left stock so a reader can see what the swap on the next page changes.
//
// Section slugs are the stable ones -- `demoHeights.json` and `src/docs/*.md`
// are both keyed by them -- so renaming a page costs a rebuild, while renaming
// a section costs a re-measure too.
export const pages: ExamplePage[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    description:
      'A measured div, one track, and the hook that turns a wheel and a drag into the two calls that move it.',
    group: 'Basics',
    // Pan and zoom leads, not the bare view: panning is the point of a genome
    // browser, so the first thing on the site should move. The bare view
    // follows as the same file with the gesture hook taken back out.
    sections: [
      {
        slug: 'pan-and-zoom',
        title: 'Pan and zoom',
        description:
          'The gesture layer JBrowse itself runs, and the two view calls it makes.',
      },
      {
        slug: 'one-track',
        title: 'One track, no gestures',
        description:
          'A measured div and one track. This is the whole of what `createViewState` needs to draw.',
      },
    ],
  },
  {
    slug: 'multiple-tracks',
    title: 'Multiple tracks',
    description:
      'A wiggle, a feature track, and an alignments pileup in one column, all mounted by the same code.',
    group: 'Basics',
    sections: [
      { slug: 'a-stack-of-tracks', title: 'A wiggle, some genes, and reads' },
    ],
  },
  {
    slug: 'removing-material-ui',
    title: 'Removing Material UI',
    description:
      "Write the components that draw a track's status states, and JBrowse's own displays render no Material UI at all.",
    group: 'Your own UI',
    // no section description: a single-section page draws no "On this page"
    // card, so it would render nowhere
    sections: [
      {
        slug: 'bring-your-own-overlays',
        title: 'Plain loading, error and corner controls',
      },
    ],
  },
  {
    slug: 'rulers-and-labels',
    title: 'Rulers and labels',
    description:
      'Draw the parts around the tracks yourself: a coordinate ruler, track labels, resize bars, and a scalebar that survives more than one region.',
    group: 'Your own UI',
    sections: [
      {
        slug: 'ruler-and-labels',
        title: 'A coordinate ruler, track labels and resize bars',
        description:
          'One view getter and one helper for the ticks; `display.height` for the labels.',
      },
      {
        slug: 'scalebar',
        title: 'A scalebar: gridlines, region names, drag to zoom',
        description:
          'What a ruler becomes once more than one region is on screen — and the view has already worked it out.',
      },
    ],
  },
  {
    slug: 'controlling-the-view',
    title: 'Controlling the view',
    description:
      'Navigate, zoom and show tracks from your own UI, and read the click back out of the session.',
    group: 'Your own UI',
    sections: [
      {
        slug: 'drive-it-from-your-app',
        title: 'A location box, zoom buttons and a track list',
        description:
          'Four calls and one getter on the view model. None of them is a component.',
      },
      {
        slug: 'every-chromosome',
        title: 'The whole genome at once',
        description:
          'Not a mode: the same view with 24 displayed regions instead of one.',
      },
      {
        slug: 'your-own-feature-details',
        title: 'Feature details on click',
        description:
          'The display writes the clicked feature to the session selection. The panel is yours.',
      },
    ],
  },
  {
    slug: 'web-workers',
    title: 'Web workers',
    description:
      'Move fetching, parsing and layout off the main thread with one option to createViewState.',
    group: 'Going further',
    sections: [{ slug: 'run-it-in-a-worker', title: 'One option, one worker' }],
  },
  {
    slug: 'synteny',
    title: 'Comparing two genomes',
    description:
      'Human and mouse at BRCA1: a synteny view is two ordinary linear views plus a ribbon band, so every page above applies to each row.',
    group: 'Going further',
    sections: [
      { slug: 'synteny-ribbons', title: 'Two linear views and a ribbon band' },
    ],
  },
]

export const examples = flattenExamples(pages)

export function getPage(slug: string) {
  return findPage(pages, slug)
}
