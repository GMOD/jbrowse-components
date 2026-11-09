import type { ExamplePage } from './exampleModel.ts'

export const pages: ExamplePage[] = [
  {
    slug: 'one-linear-genome-view',
    title: 'The simplest example',
    description: 'One component, three props: assembly, tracks, view.',
    group: 'Getting started',
  },
  {
    slug: 'track-shorthand',
    title: 'Tracks as an id and a uri',
    description: 'The extension picks the track type and the adapter.',
    group: 'Getting started',
  },
  {
    slug: 'genome-by-name',
    title: 'A hosted genome',
    description:
      'jbrowseHub fetches a genome, its tracks and its gene search by name.',
    group: 'Getting started',
  },
  {
    slug: 'disable-add-track',
    title: 'Disable the add-track UI',
    description: 'Hide the "add track" UI for a locked-down embed.',
    group: 'Layout and chrome',
  },
  {
    slug: 'fixed-height',
    title: 'A fixed height, with a side drawer',
    description: 'The height prop bounds the view and the drawer beside it.',
    group: 'Layout and chrome',
  },
  {
    slug: 'view-controls',
    title: 'Navigate from your own buttons',
    description:
      'navToLocString for a locstring, navToLocations for coordinates.',
    group: 'Navigation and search',
  },
  {
    slug: 'disable-zoom-and-side-scroll',
    title: 'Disable zoom and side scroll',
    description: 'Lock the view so users cannot zoom or pan.',
    group: 'Navigation and search',
  },
  {
    slug: 'show-track',
    title: 'Show a track programmatically',
    description: 'Show and hide a track from your own button.',
    group: 'Navigation and search',
  },
  {
    slug: 'highlight-regions',
    title: 'Highlight regions',
    description: 'view.highlight shades regions, with a color and label each.',
    group: 'Navigation and search',
  },
  {
    slug: 'flipped-regions',
    title: 'Flipped regions',
    description:
      'Several regions, some reversed, and a horizontallyFlip() button.',
    group: 'Navigation and search',
  },
  {
    slug: 'search-by-name',
    title: 'Searching by name',
    description: 'A trix index finds a gene by name.',
    group: 'Navigation and search',
  },
  {
    slug: 'jexl-colors-and-labels',
    title: 'Jexl feature colors and labels',
    description: 'Color and re-label each feature from its own attributes.',
    group: 'Tracks',
  },
  {
    slug: 'track-sizing',
    title: 'Track sizing: grow & fit',
    description: 'heightMode, with the same crowded locus opened twice.',
    group: 'Tracks',
  },
  {
    slug: 'feature-highlights',
    title: 'Highlight a feature, and sort it to the top',
    description: 'featureHighlights boxes one feature and pins its row.',
    group: 'Tracks',
  },
  {
    slug: 'group-by-tag',
    title: 'Group alignments by tag',
    description: 'facet splits the pileup into labeled lanes.',
    group: 'Tracks',
  },
  {
    slug: 'reads-as-marks',
    title: 'Haplotagged reads, declared as marks',
    description: 'A formula, a facet and a span mark over haplotagged reads.',
    group: 'Tracks',
  },
  {
    slug: 'wiggle-track',
    title: 'Quantitative (BigWig) track',
    description: 'A wiggle display, configured through displayDefaults.',
    group: 'Tracks',
  },
  {
    slug: 'gtf-track',
    title: 'GTF gene model track',
    description: 'Genes and transcripts built from per-feature lines.',
    group: 'Tracks',
  },
  {
    slug: 'multi-sample-variants',
    title: 'Variant sample rows',
    description: 'One row per sample, colored by a samples TSV column.',
    group: 'Tracks',
  },
  {
    slug: 'custom-theme',
    title: 'Custom theme',
    description: 'Four named palette colors drive most of the chrome.',
    group: 'Theming',
  },
  {
    slug: 'dark-theme',
    title: 'Dark theme',
    description: 'palette.mode: dark.',
    group: 'Theming',
  },
  {
    slug: 'shadow-dom',
    title: 'Package as a custom element',
    description: 'A <jbrowse-linear-view> tag, shadow-isolated.',
    group: 'Theming',
  },
  {
    slug: 'default-session',
    title: 'Open on a default session',
    description: 'A session carries what view cannot: a track of its own.',
    group: 'Sessions',
  },
  {
    slug: 'session-persistence',
    title: 'Persist & restore the session',
    description: 'onSnapshot out, session back in.',
    group: 'Sessions',
  },
  {
    slug: 'session-in-url',
    title: 'Put the session in the URL',
    description: 'encodeSession / decodeSession, for a sharable link.',
    group: 'Sessions',
  },
  {
    slug: 'observe-session',
    title: 'Observe the session',
    description:
      'Mirror the visible region and the selection into your own UI.',
    group: 'Sessions',
  },
  {
    slug: 'two-views',
    title: 'Two linear genome views',
    description: 'Two independent views on one page.',
    group: 'Sessions',
  },
  {
    slug: 'export-svg',
    title: 'Export the view (SVG/PNG)',
    description: 'The exportSvg action, through a ref.',
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
    slug: 'external-plugin',
    title: 'External plugin',
    description: 'loadPlugins fetches a bundle at runtime.',
    group: 'Integration',
  },
  {
    slug: 'inline-plugin',
    title: 'Inline plugin',
    description: 'Pass a Plugin subclass from your own source.',
    group: 'Integration',
  },
  {
    slug: 'internet-accounts',
    title: 'Internet accounts (authentication)',
    description: 'A per-track fetch override, usually a bearer token.',
    group: 'Integration',
  },
  {
    slug: 'local-files',
    title: 'Files from your host process',
    description:
      'Open a track on bytes your host process holds, with no web server.',
    group: 'Integration',
  },
  {
    slug: 'without-react',
    title: 'Without React',
    description:
      'createLinearGenomeView mounts into an element and hands back a controller.',
    group: 'Integration',
  },
  {
    slug: 'methylation-by-haplotype',
    title: 'Methylation by haplotype',
    description:
      'Nanopore reads at SNRPN: one haplotype methylated, the other not.',
    group: 'Real-world demos',
  },
  {
    slug: 'nextstrain-pathogens',
    title: 'Nextstrain pathogens',
    description: 'Genes, diversity and genotypes for five viral genomes.',
    group: 'Real-world demos',
    skipSmoke: true,
  },
  {
    slug: 'locus-zoom-ld',
    title: 'LocusZoom-style LD',
    description:
      'GWAS statistics colored by LD to the lead SNP, over an LD triangle.',
    group: 'Real-world demos',
  },
  {
    slug: 'single-cell-umap',
    title: 'Single-cell UMAP',
    description:
      'Select clusters to filter coverage rows; click a gene to color cells.',
    group: 'Real-world demos',
  },
  {
    slug: 'pan-ukb-gwas',
    title: 'Pan-UKB GWAS',
    description: 'Pan-UK Biobank GWAS summary statistics across phenotypes.',
    group: 'Real-world demos',
  },
]
