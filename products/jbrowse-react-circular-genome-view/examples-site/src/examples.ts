import { findPage } from './exampleModel.ts'

import type { ExamplePage } from './exampleModel.ts'

export type { ExamplePage } from './exampleModel.ts'

export const pages: ExamplePage[] = [
  {
    slug: 'volvox',
    title: 'Volvox structural variants',
    description: 'assembly, tracks and view as props.',
    group: 'Getting started',
  },
  {
    slug: 'track-shorthand',
    title: 'Tracks as an id and a uri',
    description: 'The extension picks the track type and the adapter.',
    group: 'Getting started',
  },
  {
    slug: 'show-track',
    title: 'Show and hide a track',
    description: 'Toggle a track from your own button.',
    group: 'Getting started',
  },
  {
    slug: 'session-in-url',
    title: 'Put the session in the URL',
    description: 'encodeSession and decodeSession, for a sharable link.',
    group: 'Getting started',
  },
  {
    slug: 'dark-theme',
    title: 'Dark theme',
    description: 'A Material UI palette, through configuration.theme.',
    group: 'Getting started',
  },
  {
    slug: 'inline-plugin',
    title: 'Inline plugin',
    description: 'A Plugin subclass that adds a view menu item.',
    group: 'Getting started',
  },
  {
    slug: 'web-worker',
    title: 'Web worker',
    description: 'Move data parsing off the main thread.',
    group: 'Getting started',
  },
  {
    slug: 'without-react',
    title: 'Without React',
    description:
      'createCircularGenomeView mounts into an element and hands back a controller.',
    group: 'Getting started',
  },
  {
    slug: 'human',
    title: 'Human structural variants (hg19)',
    description: 'HG002 PacBio breakend structural variants on hg19.',
    group: 'Real-world demos',
  },
  {
    slug: 'circular-synteny',
    title: 'Human and mouse on one circle',
    description: 'Two genomes on one circle, their liftOver chain as ribbons.',
    group: 'Real-world demos',
  },
  {
    slug: 'oat-homoeologs',
    title: 'Oat subgenomes on one circle',
    description: "A hexaploid's homoeolog blocks between its own chromosomes.",
    group: 'Real-world demos',
  },
  {
    slug: 'gene-density-ring',
    title: 'Gene density as a ring',
    description: 'A bigWig of gene density drawn as a ring.',
    group: 'Real-world demos',
  },
  {
    slug: 'gene-density-marks',
    title: 'Gene density, declared as marks',
    description: 'A LinearMarkDisplay bar mark, its colour a viridis ramp.',
    group: 'Real-world demos',
  },
]

export function getPage(slug: string) {
  return findPage(pages, slug)
}
