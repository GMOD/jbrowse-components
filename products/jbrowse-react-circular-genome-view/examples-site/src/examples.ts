// A section is one live demo: it maps to src/examples/<name>.tsx (component +
// ?raw source) and an optional src/docs/<slug>.md prose file.
export interface ExampleSection {
  slug: string
  name: string
  title: string
  description: string
}

// A page is one sidebar entry / one URL. Most pages hold a single section, but
// closely-related demos can be grouped onto one page (several sections) to keep
// the sidebar short. Each section keeps its own slug, so its doc/source and any
// `../<slug>/#<slug>` cross-links still resolve.
export interface ExamplePage {
  slug: string
  title: string
  description: string
  group: string
  sections: ExampleSection[]
}

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
        name: 'Volvox',
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
        name: 'ShowTrack',
        title: 'Show a track programmatically',
        description:
          'Open a track imperatively via showTrack instead of through the init prop.',
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
        name: 'Human',
        title: 'Human structural variants (hg19)',
        description:
          'Browse HG002 PacBio breakend structural variants on hg19, LocusZoom-style circular layout.',
      },
    ],
  },
]

// look up a section by slug within a page — used by multi-section pages to pass
// each section's title/description into <ExampleSection> type-safely
export function section(page: ExamplePage, slug: string): ExampleSection {
  const found = page.sections.find(s => s.slug === slug)
  if (!found) {
    throw new Error(`no section "${slug}" on page "${page.slug}"`)
  }
  return found
}

// flat, one-entry-per-page list for the shared Shell sidebar + Gallery grid and
// the build smoke test, which only need {slug, title, description, group}
export const examples = pages.map(({ slug, title, description, group }) => ({
  slug,
  title,
  description,
  group,
}))
