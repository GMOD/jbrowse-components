export interface ExampleMeta {
  slug: string
  name: string
  title: string
  description: string
  group: string
}

// single source of truth for the gallery index and each example page's
// title/description. each `slug` has a matching src/pages/<slug>.astro and
// src/examples/<name>.tsx
export const examples: ExampleMeta[] = [
  {
    slug: 'volvox',
    name: 'Volvox',
    title: 'Volvox structural variants',
    description:
      'A circular view of the volvox assembly showing a structural-variant VCF track, via the managed CircularGenomeView component.',
    group: 'Getting started',
  },
  {
    slug: 'show-track',
    name: 'ShowTrack',
    title: 'Show a track programmatically',
    description:
      'Open a track imperatively via showTrack instead of through the init prop.',
    group: 'Getting started',
  },
  {
    slug: 'human',
    name: 'Human',
    title: 'Human structural variants (hg19)',
    description:
      'Browse HG002 PacBio breakend structural variants on hg19, LocusZoom-style circular layout.',
    group: 'Real-world demos',
  },
]
