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
    slug: 'ultraminimal',
    title: 'Ultraminimal',
    description:
      'A measured div, one track, and the hook that turns a wheel and a drag into the two calls that move it.',
    group: 'Basics',
    // Not "Getting started": the landing page already is that, and it runs a
    // demo above the fold rather than describing one. A second entry by the same
    // name asked a reader arriving at the site to pick between two front doors.
    // What this page actually is, is the floor -- the least code that is still a
    // genome browser -- so it says so.
    //
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
    slug: 'loading-and-errors',
    title: 'Loading and error states',
    description:
      'The other two outcomes of `view.ready`, plus the notification channel a host that draws its own chrome renders nothing for.',
    group: 'Your own UI',
    // Placed after the page that draws a *track's* status states, because it is
    // the same question one level up: that page swaps the components a display
    // uses, this one is about the states the view itself has and the gate every
    // page here writes past. It cannot merge into that page -- its own MUI
    // budget is zero and the merged document's would be the sum, which is the
    // rule `Multiple tracks` is kept separate by.
    sections: [
      {
        slug: 'loading-and-errors',
        title: 'When the view is loading, and when it fails',
      },
    ],
  },
  {
    slug: 'scalebar-and-labels',
    title: 'Scalebar and track labels',
    description:
      'Draw the parts around the tracks yourself: a scalebar with gridlines, region names and drag-to-zoom, plus labels and resize bars down the side.',
    group: 'Your own UI',
    // The scalebar leads, and there is no longer a hand-rolled coordinate ruler
    // in front of it. That ruler was a `for` loop over one tick pitch, shown so
    // the scalebar could be "what it becomes" -- but it collided its own labels,
    // knew nothing about a second region, and was the worse of two demos a
    // reader met first. The view already computes all of it, so the tick maths
    // is not a thing anyone here should be copying.
    sections: [
      {
        slug: 'scalebar',
        title: 'A scalebar: gridlines, region names, drag to zoom',
        description:
          'Four view getters place every tick, label and region name, including the cases a hand-rolled ruler gets wrong.',
      },
      {
        slug: 'track-labels',
        title: 'Track labels and resize bars',
        description:
          '`display.height` for the labels; one core hook and two model calls for the drag.',
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
      {
        slug: 'your-own-track-selector',
        title: 'A track selector sidebar',
        description:
          'Categories, a filter box and checkboxes, built from `session.tracks` rather than a list beside the UI.',
      },
    ],
  },
  {
    slug: 'search-by-name',
    title: 'Searching by name',
    description:
      'Point the view at a text index and a location box takes gene names, plus the ambiguous-hit case a host drawing its own chrome renders nothing for.',
    group: 'Your own UI',
    // After the page that drives the view, because the first half of it is that
    // page's location box with one config key added -- and before the highlight
    // page, whose whole premise is arriving from a search hit.
    sections: [
      {
        slug: 'search-by-name',
        title: 'A name instead of a locstring',
        description:
          'One `createViewState` option, and `navToLocString` resolves names itself. Five inputs, five different paths through it.',
      },
      {
        slug: 'your-own-search-results',
        title: 'Your own list of hits',
        description:
          '`fetchResults` is the search without the navigation, so the ambiguity is yours to resolve and no dialog is ever queued.',
      },
    ],
  },
  {
    slug: 'track-settings',
    title: 'Track settings',
    description:
      'Drive a display rather than the view: a Color by menu and a read-height slider, built from the same registry the track menu uses.',
    group: 'Your own UI',
    // After the page that drives the *view*, because it is the same move one
    // level down -- and it is the first page where JBrowse draws something the
    // host did not ask for (the colour legend), which the file says more about.
    //
    // no section description: a single-section page draws no "On this page"
    // card, so it would render nowhere
    sections: [
      {
        slug: 'color-by-from-your-own-ui',
        title: 'A Color by menu, and the legend it raises',
      },
    ],
  },
  {
    slug: 'highlight-a-region',
    title: 'Highlighting a region',
    description:
      'Arrive from a search hit or a variant table with the region marked, and keep it marked while the reader pans.',
    group: 'Your own UI',
    // Last in the group, because it is the one that assumes the rest: the band
    // is drawn in the viewport frame the scalebar page introduced, behind the
    // `view.ready` gate the loading page is about, from a list your app already
    // has -- which is what the page before it drives the view from.
    sections: [
      {
        slug: 'highlight-a-region',
        title: 'A band your app places, and the four cases it survives',
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
  {
    slug: 'svg-figures',
    title: 'SVG figures',
    description:
      "JBrowse's SVG export is React components, so they mount in your page: a figure of the current view in DOM nodes, redrawn as the reader navigates.",
    group: 'Going further',
    // Last, because it assumes the rest: it draws a pan/zoom track stack of its
    // own and puts the figure underneath, so a reader can compare the two
    // renderings of one view.
    //
    // no section description: a single-section page draws no "On this page"
    // card, so it would render nowhere
    sections: [{ slug: 'svg-figure', title: 'A figure that follows the view' }],
  },
]

export const examples = flattenExamples(pages)

export function getPage(slug: string) {
  return findPage(pages, slug)
}
