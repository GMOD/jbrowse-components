import type { ExamplePage } from './exampleModel.ts'

export const pages: ExamplePage[] = [
  {
    slug: 'basic-example',
    title: 'Basic example',
    description: 'The whole app, one assembly, one track.',
    group: 'Getting started',
  },
  {
    slug: 'track-shorthand',
    title: 'Tracks as an id and a uri',
    description: 'The extension picks the track type and the adapter.',
    group: 'Getting started',
  },
  {
    slug: 'fetch-config-json',
    title: 'Load a config.json',
    description: 'Fetched at runtime, or bundled at build time.',
    group: 'Getting started',
  },
  {
    slug: 'dark-theme',
    title: 'Dark theme',
    description: 'palette.mode: dark.',
    group: 'Customizing',
  },
  {
    slug: 'fit-to-container',
    title: 'Fit the app to a container',
    description: 'The --jbrowse-app-height CSS variable.',
    group: 'Customizing',
  },
  {
    slug: 'web-worker',
    title: 'Web worker',
    description: 'Move parsing and rendering off the main thread.',
    group: 'Customizing',
  },
  {
    slug: 'static-first-paint',
    title: 'A picture first, then the view',
    description:
      'A screenshot paints with the page; the engine loads near the viewport.',
    group: 'Customizing',
  },
  {
    slug: 'inline-plugin',
    title: 'Inline plugin',
    description: 'A Plugin class from your own source.',
    group: 'Customizing',
  },
  {
    slug: 'external-plugin',
    title: 'External plugin',
    description: 'loadPlugins fetches a bundle at runtime.',
    group: 'Customizing',
  },
  {
    slug: 'observe-session',
    title: 'Observe the session',
    description: 'An observer reading the open views.',
    group: 'Sessions and control',
  },
  {
    slug: 'session-in-url',
    title: 'Put the session in the URL',
    description: 'encodeSession / decodeSession, for a sharable link.',
    group: 'Sessions and control',
  },
  {
    slug: 'session-persistence',
    title: 'Persist & restore the session',
    description: 'onSnapshot out, session back in.',
    group: 'Sessions and control',
  },
  {
    slug: 'multi-view-session',
    title: 'Multiple views in one session',
    description: 'A circular overview above a linear detail view.',
    group: 'Sessions and control',
  },
  {
    slug: 'launch-view',
    title: 'Drive the app from your own buttons',
    description: 'A ref to the engine: add a track, open a view.',
    group: 'Sessions and control',
  },
  {
    slug: 'without-react',
    title: 'Without React',
    description:
      'createApp mounts into an element and hands back a controller.',
    group: 'Sessions and control',
  },
  {
    slug: 'linear-synteny',
    title: 'One PAF, two views',
    description: 'A deletion as a linear synteny view and as a dotplot.',
    group: 'View types',
  },
  {
    slug: 'multiway-synteny',
    title: 'Multi-way linear synteny view',
    description: 'Four E. coli strains from one all-vs-all PAF.',
    group: 'View types',
  },
  {
    slug: 'breakpoint-split',
    title: 'Breakpoint split view',
    description: 'One structural variant across two regions.',
    group: 'View types',
  },
  {
    slug: 'sv-inspector',
    title: 'SV inspector',
    description: 'A spreadsheet paired with a circular view.',
    group: 'View types',
  },
  {
    slug: 'human-demo',
    title: 'Human demo (hg38)',
    description:
      'Genes, repeats, exome reads, variants and conservation on hg38.',
    group: 'Real-world demos',
  },
]
