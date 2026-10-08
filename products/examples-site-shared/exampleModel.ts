// Shared by every product's examples-site through a symlink at
// src/exampleModel.ts, so it has no relative imports.

// One live demo at one URL: src/pages/<slug>.astro mounts
// src/examples/<PascalCase slug>.tsx, and src/docs/<slug>.md is its optional
// prose.
export interface ExamplePage {
  slug: string
  title: string
  description: string
  group: string
  // skipped by scripts/smoke.mjs and the demo-heights generator: the page ships
  // and works in a real browser, but crashes CI's software WebGL
  skipSmoke?: boolean
}

export function findPage(pages: ExamplePage[], slug: string): ExamplePage {
  const found = pages.find(p => p.slug === slug)
  if (!found) {
    throw new Error(`no page "${slug}"`)
  }
  return found
}
