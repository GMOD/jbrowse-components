import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// The published contract for a third-party track type is what the worked
// example imports, and nothing more: every `@jbrowse/*` specifier reachable
// from `example-plugins/score-example/src`. Pinned as a symmetric snapshot so
// the contract grows or shrinks only when someone means it to, and so a
// refactor that makes the example reach one subpath further is visible as
// exactly that. Update with `jest -u` and say in the commit what moved and why.

const exampleRoot = join(
  __dirname,
  '../../../example-plugins/score-example/src',
)

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return sourceFiles(path)
    }
    const isSource = /\.tsx?$/.test(name)
    const isTest = /\.test\.tsx?$/.test(name)
    const isGenerated = name.includes('.generated.')
    return isSource && !isTest && !isGenerated ? [path] : []
  })
}

function jbrowseImports(file: string) {
  return [...readFileSync(file, 'utf8').matchAll(/from '(@jbrowse\/[^']+)'/g)]
    .map(m => m[1]!)
    .filter(specifier => !specifier.startsWith('@jbrowse/plugin-score-example'))
}

test('the published contract is what the worked example imports', () => {
  const specifiers = new Set(sourceFiles(exampleRoot).flatMap(jbrowseImports))
  expect([...specifiers].sort()).toMatchSnapshot()
})

test('the example reaches no plugin', () => {
  const specifiers = sourceFiles(exampleRoot).flatMap(jbrowseImports)
  expect(specifiers.filter(s => s.startsWith('@jbrowse/plugin-'))).toEqual([])
})
