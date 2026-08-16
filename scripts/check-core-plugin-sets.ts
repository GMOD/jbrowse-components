// The three app products' `corePlugins.ts` lists stand in an exact relation to
// each other, and nothing else checks it:
//
//   desktop   = web ∪ { blat, text-indexing }
//   react-app = web \ { jobs-management }
//
// Each is a hand-maintained list of ~30 imports, so a plugin added to web for a
// reason that applies to all three lands in one of them. The failure is quiet:
// the product still builds and still runs, it just silently lacks a track type,
// and only a user with that data finds out.
//
// A SHARED ARRAY IS THE WRONG FIX, which is why this is a static check. These
// lists are the eager-bundle roots — importing one shared list and filtering it
// puts every plugin in the shared list into every product's module graph, so
// react-app would pay for jobs-management to then drop it. That is exactly the
// trap EAGER_BUNDLE.md records (`24aba4d012` cost 12 KB gzip that way, and tsc,
// jest and lint were all green). This file never imports the lists; it reads
// them, so it cannot move a byte.
//
// The differences are deliberate and each has a reason, recorded below. Change
// one only by editing DIFFS here at the same time, which is the point: the edit
// is where you get asked whether you meant it.
//
// Run: pnpm check-core-plugin-sets
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

const BASE = 'jbrowse-web'

// what each product adds to / removes from web's list, and why
const DIFFS: Record<string, { adds: string[]; drops: string[]; why: string }> =
  {
    'jbrowse-desktop': {
      adds: ['blat', 'text-indexing'],
      drops: [],
      why:
        'Blat is desktop-only because web pays cold-load bundle size and BLAT is niche ' +
        "(see desktopVendoredPluginNames); text-indexing needs node's fs and a local disk.",
    },
    'jbrowse-react-app': {
      adds: [],
      drops: ['jobs-management'],
      why: 'the jobs manager drives desktop/web indexing runs an embedded app has no shell for.',
    },
  }

function pluginsOf(product: string) {
  const file = join(root, 'products', product, 'src', 'corePlugins.ts')
  const text = readFileSync(file, 'utf8')
  // the import list, not the array below it: the array is the same names in a
  // different order, and an import with no array entry is already dead code
  const names = [
    ...text.matchAll(/^import \w+ from '@jbrowse\/plugin-([\w-]+)'/gm),
  ].map(m => m[1]!)
  if (!names.length) {
    throw new Error(`no @jbrowse/plugin-* imports found in ${file}`)
  }
  return new Set(names)
}

const web = pluginsOf(BASE)
const problems: string[] = []

for (const [product, { adds, drops, why }] of Object.entries(DIFFS)) {
  const actual = pluginsOf(product)
  const expected = new Set(web)
  for (const a of adds) {
    expected.add(a)
  }
  for (const d of drops) {
    expected.delete(d)
  }

  const missing = [...expected].filter(p => !actual.has(p)).sort()
  const extra = [...actual].filter(p => !expected.has(p)).sort()

  if (missing.length) {
    problems.push(
      `products/${product}/src/corePlugins.ts is missing: ${missing.join(', ')}\n` +
        `  ${product} should be ${BASE}${adds.length ? ` plus ${adds.join(', ')}` : ''}${
          drops.length ? ` minus ${drops.join(', ')}` : ''
        }.\n` +
        `  ${why}\n` +
        `  Add it here too, or record the new difference in scripts/check-core-plugin-sets.ts.`,
    )
  }
  if (extra.length) {
    problems.push(
      `products/${product}/src/corePlugins.ts has, and ${BASE} lacks: ${extra.join(', ')}\n` +
        `  ${why}\n` +
        `  If ${BASE} should have it too, add it there; if this is a new deliberate\n` +
        `  difference, add it to DIFFS in scripts/check-core-plugin-sets.ts with a reason.`,
    )
  }
}

if (problems.length) {
  console.error(problems.join('\n\n'))
  console.error(`\n${problems.length} core-plugin set problem(s).`)
  process.exit(1)
}
console.log(
  `core plugin sets agree: ${BASE} has ${web.size}, ${Object.entries(DIFFS)
    .map(
      ([p, { adds, drops }]) =>
        `${p} ${adds.length ? `+${adds.length}` : ''}${drops.length ? `-${drops.length}` : ''}`,
    )
    .join(', ')}`,
)
