import { flattenExamples } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage, ExampleSection } from './exampleModel.ts'
export { section } from './exampleModel.ts'

export const pages: ExamplePage[] = [
  {
    slug: 'volvox',
    title: 'Volvox structural variants',
    description:
      'A structural-variant VCF on the volvox assembly, via the managed CircularGenomeView component.',
    group: 'Getting started',
    sections: [
      {
        slug: 'volvox',
        title: 'Volvox structural variants',
        description: 'assembly, tracks and init as props.',
      },
      {
        slug: 'with-track-shorthand',
        title: 'The same view, in shorthand',
        description: 'The extension picks the track type and the adapter.',
      },
    ],
  },
  {
    slug: 'show-track',
    title: 'Show a track programmatically',
    description:
      'Open a track imperatively via showTrack instead of through the init prop.',
    group: 'Getting started',
    sections: [{ slug: 'show-track', title: 'Show a track programmatically' }],
  },
  {
    slug: 'session-in-url',
    title: 'Put the session in the URL',
    description:
      'Serialize the session with encodeSession and restore it with decodeSession, for a sharable link.',
    group: 'Getting started',
    sections: [{ slug: 'session-in-url', title: 'Put the session in the URL' }],
  },
  {
    slug: 'human',
    title: 'Human structural variants (hg19)',
    description:
      'Browse HG002 PacBio breakend structural variants on hg19, LocusZoom-style circular layout.',
    group: 'Real-world demos',
    sections: [{ slug: 'human', title: 'Human structural variants (hg19)' }],
  },
]

export const examples = flattenExamples(pages)
