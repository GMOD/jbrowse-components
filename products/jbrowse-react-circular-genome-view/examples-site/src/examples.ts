import { flattenExamples } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage, ExampleSection } from './exampleModel.ts'
export { section } from './exampleModel.ts'

export const pages: ExamplePage[] = [
  {
    slug: 'volvox',
    title: 'Volvox structural variants',
    description:
      'A circular view of the volvox assembly showing a structural-variant VCF track, via the managed CircularGenomeView component.',
    group: 'Getting started',
    sections: [
      {
        slug: 'volvox',
        title: 'Volvox structural variants',
        description:
          'A circular view of the volvox assembly showing a structural-variant VCF track, via the managed CircularGenomeView component.',
      },
    ],
  },
  {
    slug: 'show-track',
    title: 'Show a track programmatically',
    description:
      'Open a track imperatively via showTrack instead of through the init prop.',
    group: 'Getting started',
    sections: [
      {
        slug: 'show-track',
        title: 'Show a track programmatically',
        description:
          'Open a track imperatively via showTrack instead of through the init prop.',
      },
    ],
  },
  {
    slug: 'session-in-url',
    title: 'Put the session in the URL',
    description:
      'Serialize the live session with encodeSession, restore it with decodeSession — shareable links, bookmarkable views, browser history.',
    group: 'Getting started',
    sections: [
      {
        slug: 'session-in-url',
        title: 'Put the session in the URL',
        description:
          'Serialize the live session with encodeSession, restore it with decodeSession — shareable links, bookmarkable views, browser history.',
      },
    ],
  },
  {
    slug: 'human',
    title: 'Human structural variants (hg19)',
    description:
      'Browse HG002 PacBio breakend structural variants on hg19, LocusZoom-style circular layout.',
    group: 'Real-world demos',
    sections: [
      {
        slug: 'human',
        title: 'Human structural variants (hg19)',
        description:
          'Browse HG002 PacBio breakend structural variants on hg19, LocusZoom-style circular layout.',
      },
    ],
  },
]

export const examples = flattenExamples(pages)
