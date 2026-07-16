// Shared example model for every product's examples-site (app / lgv / cgv).
// Each site symlinks src/exampleModel.ts to this file. It has no relative
// imports, so — unlike Shell/Gallery — it works fine symlinked: each site's
// examples.ts imports these types + helpers and only defines its own `pages`.

// A section is one live demo: it maps to src/examples/<Component>.tsx (imported
// directly by each page) and an optional src/docs/<slug>.md prose file.
export interface ExampleSection {
  slug: string
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
  // exclude from the examples-site smoke test (scripts/smoke.mjs). The page
  // still ships and works in a real browser; it's only skipped in CI's headless
  // software-WebGL (swiftshader), where some renders crash the renderer.
  skipSmoke?: boolean
  sections: ExampleSection[]
}

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
// the build smoke test, which only need {slug, title, description, group} (plus
// skipSmoke, honored by the linear-genome-view smoke script)
export function flattenExamples(pages: ExamplePage[]) {
  return pages.map(({ slug, title, description, group, skipSmoke }) => ({
    slug,
    title,
    description,
    group,
    skipSmoke,
  }))
}
