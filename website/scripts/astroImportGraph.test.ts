/// <reference types="jest" />
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

// The Astro build is a different program from the capture tooling, and only one
// import edge separates them. `scripts/screenshot-specs.ts` and
// `scripts/video-specs.ts` reach `@jbrowse/browser-test-utils` for a handful of
// wait helpers, and that barrel loads puppeteer, esbuild and serve-handler; when
// a remark plugin imported either module directly, every `pnpm build` and every
// dev-server page render paid for that tree, and Vite warned about the runtime
// `import()` calls it found inside it.
//
// Nothing in the site fails when the edge comes back — the build gets slower and
// noisier, which is the kind of regression a review reads past. So the site's
// half of the link data goes through `src/lib/liveLinks.generated.ts`, and this
// walks the import graph to keep it that way.
const websiteDir = resolve(__dirname, '..')

const FORBIDDEN = [
  '@jbrowse/browser-test-utils',
  '@jbrowse/capture',
  'puppeteer',
]

const SOURCE_EXTS = ['.ts', '.tsx', '.astro', '.mjs', '.js']

function sourceFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      return sourceFilesUnder(full)
    }
    return SOURCE_EXTS.some(ext => entry.name.endsWith(ext)) ? [full] : []
  })
}

// Every `from '...'` and bare `import '...'`, which covers the frontmatter of an
// .astro file as well as a .ts module. Type-only imports count: the walk is
// after what a file's specifiers name, and a `import type` from a module that
// also has runtime exports is one edit away from being a runtime import.
const specifierRe = /(?:from|import)\s*['"]([^'"]+)['"]/g

function specifiersOf(file: string) {
  return [...readFileSync(file, 'utf8').matchAll(specifierRe)].map(m => m[1]!)
}

// The tree writes every relative import with its extension, so resolution is the
// join. An extensionless one would be a bug elsewhere; skip it rather than
// guessing, and skip css/image imports the same way.
function resolveRelative(from: string, specifier: string) {
  const full = join(dirname(from), specifier)
  return SOURCE_EXTS.some(ext => full.endsWith(ext)) && existsSync(full)
    ? full
    : undefined
}

test('the Astro build never imports the capture tooling', () => {
  const queue = sourceFilesUnder(join(websiteDir, 'src'))
  const seen = new Set(queue)
  const offenders: string[] = []

  while (queue.length) {
    const file = queue.pop()!
    for (const specifier of specifiersOf(file)) {
      if (
        FORBIDDEN.some(m => specifier === m || specifier.startsWith(`${m}/`))
      ) {
        offenders.push(`${relative(websiteDir, file)} -> ${specifier}`)
      } else if (specifier.startsWith('.')) {
        const next = resolveRelative(file, specifier)
        // Only follow back into website/: a plugin source file the spec-recipe
        // field table reads is somebody else's graph, and would drag the whole
        // core tree through this walk.
        if (next?.startsWith(`${websiteDir}/`) && !seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
  }

  expect(offenders).toEqual([])
})
