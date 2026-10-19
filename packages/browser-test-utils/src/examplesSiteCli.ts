import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { listFilesRecursive, runExamplesSiteChecks } from './docLinks.ts'
import { measureDemoHeights } from './examplesDemoHeights.ts'
import { captureExamplePoster } from './examplesPoster.ts'

// The whole of three examples-site maintenance scripts. Each site's
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

interface ExamplesModule {
  pages: (Parameters<typeof runExamplesSiteChecks>[0]['pages'][number] & {
    skipSmoke?: boolean
  })[]
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
 * generated doc page that no longer exists, on a `../<slug>/` cross-link or a
 * website/README link into the site whose page is gone (these break silently
 * on a rename), on a doc no page renders, on a page whose file or example
 * disagrees with examples.ts, and on prose past its cap.
 * Advisory output: reference links still worth adding, and prose getting long.
 */
export async function checkExamplesSiteDocLinks(
  scriptUrl: string,
  log: (message: string) => void = console.log,
) {
  const root = siteRoot(scriptUrl)
  const repo = path.join(root, '..', '..', '..')
  const { pages } = await loadExamples(root)
  const { base } = await loadAstroConfig(root)
  const products = path.join(repo, 'products')
  const readmes = readdirSync(products)
    .map(p => path.join(products, p, 'README.md'))
    .filter(f => existsSync(f))
  const siblingSites = readdirSync(products)
    .map(p => path.join(products, p, 'examples-site', 'src'))
    .filter(src => existsSync(src) && path.dirname(src) !== root)
    .flatMap(src =>
      ['docs', 'pages'].flatMap(dir =>
        listFilesRecursive(path.join(src, dir), ['.md', '.astro']),
      ),
    )
  return runExamplesSiteChecks({
    root,
    pages,
    // the checked-out website docs tree the generated pages are built from
    referenceDir: path.join(repo, 'website', 'docs'),
    base,
    inboundFiles: [
      ...listFilesRecursive(path.join(repo, 'website', 'docs'), [
        '.md',
        '.mdx',
      ]),
      ...readmes,
      ...siblingSites,
    ],
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
  const { pages } = await loadExamples(site)
  const config = await loadAstroConfig(site)
  const outFile = path.join(site, 'demoHeights.json')

  const heights = await measureDemoHeights({
    distDir: path.join(site, 'dist'),
    base: config.base,
    // the landing page is deliberately absent: where it runs a demo at all it is
    // running one of these examples a second time, and it reserves that
    // example's figure rather than a duplicate of its own that could drift away
    // from it
    slugs: pages.filter(e => !e.skipSmoke).map(e => e.slug),
    log,
  })

  writeFileSync(outFile, `${JSON.stringify(heights, null, 2)}\n`)
  log(
    `\n${Object.entries(heights)
      .map(([slug, h]) => `  ${slug.padEnd(30)} ${String(h).padStart(4)}px`)
      .join('\n')}\nwrote ${path.relative(site, outFile)}`,
  )
}

/**
 * Shoot `public/<slug>.png`, the poster a page shows while its view loads,
 * from that page's own built demo:
 *
 *     pnpm build && pnpm capture-poster && pnpm build
 *
 * The poster is a build input like the demo heights, so the second build ships
 * it. Fails when the example's source does not state the size the poster was
 * shot at.
 */
export async function writeExamplesSitePoster(
  scriptUrl: string,
  slug: string,
  log: (message: string) => void = console.log,
) {
  const site = siteRoot(scriptUrl)
  const { base } = await loadAstroConfig(site)
  const out = `${path.join(site, 'public', slug)}.png` as const
  const { width, height } = await captureExamplePoster({
    distDir: path.join(site, 'dist'),
    base,
    slug,
    out,
  })
  log(`wrote ${path.relative(site, out)}, ${width}x${height} CSS px`)
  const pascal = slug.replaceAll(/(?:^|-)(\w)/g, (_, c: string) =>
    c.toUpperCase(),
  )
  const example = path.join(site, 'src', 'examples', `${pascal}.tsx`)
  const source = readFileSync(example, 'utf8')
  if (
    !source.includes(`width: ${width},`) ||
    !source.includes(`height: ${height},`)
  ) {
    log(
      `${path.relative(site, example)} must state width: ${width}, height: ${height}`,
    )
    return 1
  }
  return 0
}
