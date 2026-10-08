import { findPage, flattenExamples } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage, ExampleSection } from './exampleModel.ts'
export { section } from './exampleModel.ts'

export const pages: ExamplePage[] = [
  {
    slug: 'volvox',
    title: 'Volvox structural variants',
    description: 'A structural-variant VCF on the volvox assembly.',
    group: 'Getting started',
    sections: [
      {
        slug: 'volvox',
        title: 'Volvox structural variants',
        description: 'assembly, tracks and view as props.',
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
    title: 'Show and hide a track',
    description: 'Toggle a track from your own button.',
    group: 'Getting started',
    sections: [{ slug: 'show-track', title: 'Show and hide a track' }],
  },
  {
    slug: 'session-in-url',
    title: 'Put the session in the URL',
    description: 'encodeSession and decodeSession, for a sharable link.',
    group: 'Getting started',
    sections: [{ slug: 'session-in-url', title: 'Put the session in the URL' }],
  },
  {
    slug: 'theming',
    title: 'Dark theme',
    description: 'A Material UI palette, through configuration.theme.',
    group: 'Getting started',
    sections: [{ slug: 'with-dark-theme', title: 'Dark theme' }],
  },
  {
    slug: 'plugins',
    title: 'Plugins & the web worker',
    description: 'A plugin from your own source, and RPC off the main thread.',
    group: 'Getting started',
    sections: [
      {
        slug: 'with-inline-plugin',
        title: 'Inline plugin',
        description: 'A Plugin subclass that adds a view menu item.',
      },
      {
        slug: 'with-web-worker',
        title: 'Web worker RPC',
        description: 'Move data parsing off the main thread.',
      },
    ],
  },
  {
    slug: 'without-react',
    title: 'Without React',
    description:
      'createCircularGenomeView mounts into an element and hands back a controller.',
    group: 'Getting started',
    sections: [{ slug: 'without-react', title: 'An element and a controller' }],
  },
  {
    slug: 'human',
    title: 'Human structural variants (hg19)',
    description: 'HG002 PacBio breakend structural variants on hg19.',
    group: 'Real-world demos',
    sections: [{ slug: 'human', title: 'Human structural variants (hg19)' }],
  },
  {
    slug: 'circular-synteny',
    title: 'Human and mouse on one circle',
    description: 'Two genomes on one circle, their liftOver chain as ribbons.',
    group: 'Real-world demos',
    sections: [
      { slug: 'circular-synteny', title: 'Human and mouse on one circle' },
    ],
  },
  {
    slug: 'oat-homoeologs',
    title: 'Oat subgenomes on one circle',
    description: "A hexaploid's homoeolog blocks between its own chromosomes.",
    group: 'Real-world demos',
    sections: [
      { slug: 'oat-homoeologs', title: 'Oat subgenomes on one circle' },
    ],
  },
  {
    slug: 'gene-density-ring',
    title: 'Gene density as a ring',
    description: 'A bigWig drawn as a ring inside the two-genome ideogram.',
    group: 'Real-world demos',
    sections: [
      { slug: 'gene-density-ring', title: 'Gene density as a ring' },
      {
        slug: 'gene-density-marks',
        title: 'The same ring, declared as marks',
        description: 'A LinearMarkDisplay bar mark, its color a viridis ramp.',
      },
    ],
  },
]

export const examples = flattenExamples(pages)

export const getPage = (slug: string) => findPage(pages, slug)
