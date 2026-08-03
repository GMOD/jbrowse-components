import { findPage, flattenExamples } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage, ExampleSection } from './exampleModel.ts'
export { section } from './exampleModel.ts'

// Ordered as a build, not a catalogue: most pages add one thing to the page
// before them, and the sidebar groups follow that arc. The first two run the
// other way -- pan and zoom is the point of a genome browser, so it leads,
// and One track follows to show the bare view it's built from.
export const pages: ExamplePage[] = [
  {
    slug: 'pan-and-zoom',
    title: 'Pan and zoom',
    description:
      'A measured div, one track, and enough wheel/pointer wiring to move around it. The view already owns the coordinate maths and clamps to the ends of the assembly; this is what it takes to drive it.',
    group: 'The atoms',
    sections: [{ slug: 'pan-and-zoom', title: 'Wheel and drag' }],
  },
  {
    slug: 'one-track',
    title: 'One track, no interaction',
    description:
      'The same view with the pan/zoom wiring pulled back out: a measured div and one track, nothing else. No header, no ruler, no track labels, no palette to supply.',
    group: 'The atoms',
    sections: [{ slug: 'one-track', title: 'No pan, no zoom, no chrome' }],
  },
  {
    slug: 'a-stack-of-tracks',
    title: 'A stack of tracks',
    description:
      'Three display types in one column: a wiggle, a feature track, and an alignments pileup. The engine treats all three the same way, so the code that mounts them does too.',
    group: 'The atoms',
    sections: [{ slug: 'a-stack-of-tracks', title: 'Wiggle, features, reads' }],
  },
  {
    slug: 'bring-your-own-overlays',
    title: 'Bring your own overlays',
    description:
      "Loading, errors, and the too-large gate are drawn by five swappable components. Replace them and JBrowse's own displays stop rendering Material UI entirely, so nothing has to match a theme you did not choose.",
    group: 'Making it yours',
    sections: [
      {
        slug: 'bring-your-own-overlays',
        title: 'Plain overlays, no MUI',
        description:
          'The same three tracks, drawing their status states with dependency-free markup.',
      },
    ],
  },
  {
    slug: 'add-the-chrome-you-want',
    title: 'Add the chrome you want',
    description:
      'Having removed all of it, add back only what your app needs. A coordinate ruler and track labels, written against the same view model the tracks read.',
    group: 'Making it yours',
    sections: [
      { slug: 'add-the-chrome-you-want', title: 'A ruler and some labels' },
    ],
  },
]

export const examples = flattenExamples(pages)

export function getPage(slug: string) {
  return findPage(pages, slug)
}
