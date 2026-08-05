/**
 * @jest-environment node
 *
 * pluginManagers.tsx reaches corePlugins, and through it every plugin's models,
 * adapters and config schemas. It is behind a dynamic import in util.tsx so that
 * launching JBrowse Desktop draws the start screen — which has no session and
 * uses none of that — without evaluating the whole graph first.
 *
 * One static `import ... from './pluginManagers.tsx'` anywhere puts it back, and
 * nothing about that diff would say so: the app still works, it just starts
 * slower. Hence this guard, in the same spirit as core's menuItems purity test.
 */
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../..')
const ALLOWED = 'components/StartScreen/util.tsx'

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory()
      ? sourceFiles(full)
      : /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')
        ? [full]
        : []
  })
}

test('only util.tsx names pluginManagers, and only dynamically', () => {
  const offenders = sourceFiles(SRC)
    .filter(file => path.relative(SRC, file) !== ALLOWED)
    .filter(file =>
      /['"][^'"]*pluginManagers\.tsx['"]/.test(fs.readFileSync(file, 'utf8')),
    )
    .map(file => path.relative(SRC, file))

  expect(offenders).toEqual([])
})

test('util.tsx reaches it through import(), not a static import', () => {
  const source = fs.readFileSync(path.join(SRC, ALLOWED), 'utf8')

  expect(source).toMatch(/await import\(\s*'\.\/pluginManagers\.tsx'\s*\)/)
  // `import type` is fine — it is erased — but a value import is not
  expect(source).not.toMatch(/^import (?!type )[^\n]*pluginManagers/m)
})
