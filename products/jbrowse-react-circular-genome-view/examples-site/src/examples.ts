import type { ExamplePage } from './exampleModel.ts'

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
    group: 'Tracks',
  },
  {
    slug: 'session-in-url',
    title: 'Put the session in the URL',
    description: 'encodeSession and decodeSession, for a sharable link.',
    group: 'Sessions',
  },
  {
    slug: 'dark-theme',
    title: 'Dark theme',
    description: 'A Material UI palette, through configuration.theme.',
    group: 'Theming',
  },
  {
    slug: 'inline-plugin',
    title: 'Inline plugin',
    description: 'A Plugin subclass that adds a view menu item.',
    group: 'Integration',
  },
  {
    slug: 'static-first-paint',
    title: 'A picture first, then the view',
    description:
      'A screenshot paints with the page; the engine loads near the viewport.',
    group: 'Integration',
  },
  {
    slug: 'without-react',
    title: 'Without React',
    description:
      'createCircularGenomeView mounts into an element and hands back a controller.',
    group: 'Integration',
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
    title: 'Gene density as rings',
    description: 'One bigWig as a shaded strip and as viridis bars.',
    group: 'Real-world demos',
  },
]
