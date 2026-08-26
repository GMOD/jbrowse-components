import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { runExamplesSiteChecks } from './docLinks.ts'
import { measureDemoHeights } from './examplesDemoHeights.ts'

// The whole of two examples-site maintenance scripts. Each site's
// scripts/<name>.mjs is now a one-line call passing its own `import.meta.url`,
// and that argument is the one part that cannot move here: node resolves a
// module's relative paths from its real location, so a script shared by symlink
// would look for `src/examples.ts` beside this file. Passing the anchor keeps
// the sites' copies down to the line that names which site is calling.
//
// Everything downstream of the anchor is identical across all four sites by
// construction — where examples.ts lives, where dist/ lives, where the heights
// file is written — which is why the copies were byte-identical with nothing
// holding them that way.
//
// EXAMPLES_SITES.md's "Why `ExampleSection.astro` is four copies" rules out
// sharing `ExampleLayout.astro`/`ExampleSection.astro` the same way; it does not
// apply to these, which node runs directly and which reach the site only through
// the anchor.

interface ExamplesModule {
  pages: Parameters<typeof runExamplesSiteChecks>[0]['pages']
  examples: { slug: string; skipSmoke?: boolean }[]
}

function siteRoot(scriptUrl: string) {
  return path.join(path.dirname(fileURLToPath(scriptUrl)), '..')
}

// the specifier is only known at runtime, so `import()` is typed `any` here;
// the declared return type is what gives it a shape, without a cast
async function loadExamples(root: string): Promise<ExamplesModule> {
  return import(pathToFileURL(path.join(root, 'src', 'examples.ts')).href)
}

async function loadAstroConfig(site: string): Promise<{ base: string }> {
  const { default: config } = await import(
    pathToFileURL(path.join(site, 'astro.config.mjs')).href
  )
  return config
}

/**
 * Validate + suggest links in an examples-site. Fails (returns 1) on a link to a
 * generated doc page that no longer exists, on a site-internal
 * `../<page>/#<section>` cross-link whose page or section is gone (these break
 * silently on a rename), on a section with no `src/docs/<slug>.md` (which
 * renders as a demo with no explanation, equally silent), and on prose past its
 * cap. Advisory output: reference links still worth adding, and prose getting
 * long.
 */
export async function checkExamplesSiteDocLinks(
  scriptUrl: string,
  log: (message: string) => void = console.log,
) {
  const root = siteRoot(scriptUrl)
  const { pages } = await loadExamples(root)
  return runExamplesSiteChecks({
    root,
    pages,
    // the checked-out website docs tree the generated pages are built from
    referenceDir: path.join(root, '..', '..', '..', 'website', 'docs'),
    log,
  })
    ? 1
    : 0
}

/**
 * Write the height each demo settles at, which `src/siteMeta.ts` reserves on its
 * box so the page doesn't jump when the island mounts:
 *
 *     pnpm build && pnpm measure-demo-heights && pnpm build
 *
 * Twice, because unlike the other measured artifacts in these sites this one is
 * an *input* to the build: the first pass gives it something to measure, the
 * second ships the result. Measuring neutralises each box's current
 * reservation, so a stale number in the tree cannot influence the new one.
 *
 * Loads each page at two widths and keeps the taller figure, because the rule is
 * reserve the tallest: too small still jumps the page, while too large only
 * leaves space inside the demo's own border.
 */
export async function writeExamplesSiteDemoHeights(
  scriptUrl: string,
  log: (message: string) => void = console.log,
) {
  const site = siteRoot(scriptUrl)
  const { examples } = await loadExamples(site)
  const config = await loadAstroConfig(site)
  const outFile = path.join(site, 'demoHeights.json')

  const heights = await measureDemoHeights({
    distDir: path.join(site, 'dist'),
    base: config.base,
    // the landing page is deliberately absent: where it runs a demo at all it is
    // running one of these examples a second time, and it reserves that
    // example's figure rather than a duplicate of its own that could drift away
    // from it
    slugs: examples.filter(e => !e.skipSmoke).map(e => e.slug),
    log,
  })

  writeFileSync(outFile, `${JSON.stringify(heights, null, 2)}\n`)
  log(
    `\n${Object.entries(heights)
      .map(([slug, h]) => `  ${slug.padEnd(30)} ${String(h).padStart(4)}px`)
      .join('\n')}\nwrote ${path.relative(site, outFile)}`,
  )
}
