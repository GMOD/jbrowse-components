// Every `reload()` in the tree either bumps a reload counter, chains to the one
// it overrides, or has an empty body.
//
// `reloadCounter` is the whole arming mechanism of the dead-Retry check
// (`makeRetryContractCheck`): it compares the counter across runs, so a display
// whose `reload()` never moves it is not merely unchecked, it reads as a display
// that never retries. Nothing about that is visible — the button still works, the
// autoruns still fire, and the check simply never speaks again. Canvas's
// `LinearBasicDisplay` shipped in that shape and took `LinearVariantDisplay` with
// it, while `MultiRegionDisplayMixin.reload`'s own docstring named the failure
// mode and then named the other override as the only one.
//
// Source-level rather than per-display, because what has to be pinned is the set
// of overrides and a runtime test only ever covers the displays someone
// remembered to add. An empty body passes: all three that exist are placeholders
// a composing model replaces (`BaseDisplayModel`, `RegionTooLargeMixin`, and the
// chrome test stub), and an empty `reload()` claims nothing to be wrong about.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../../../../..')

function sourceFiles() {
  return execFileSync(
    'git',
    [
      'ls-files',
      'plugins/**/*.ts',
      'plugins/**/*.tsx',
      'packages/**/*.ts',
      'packages/**/*.tsx',
    ],
    { cwd: root, encoding: 'utf8' },
  )
    .split('\n')
    .filter(file => file && !file.includes('.test.'))
}

// Brace-matched rather than line-counted: the bodies here run to a dozen lines
// and one of them contains an object literal.
function bodyFrom(source: string, open: number) {
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') {
      depth++
    } else if (source[i] === '}') {
      depth--
      if (depth === 0) {
        return source.slice(open, i + 1)
      }
    }
  }
  throw new Error('unbalanced braces')
}

function withoutComments(body: string) {
  return body.replaceAll(/\/\/[^\n]*/g, '').replaceAll(/\/\*[\s\S]*?\*\//g, '')
}

interface Declaration {
  where: string
  body: string
}

function reloadDeclarations() {
  const found: Declaration[] = []
  for (const file of sourceFiles()) {
    const source = readFileSync(path.join(root, file), 'utf8')
    for (const match of source.matchAll(
      /^\s*(?:async\s+)?reload\(\s*\)\s*\{/gm,
    )) {
      const open = match.index + match[0].length - 1
      const line = source.slice(0, match.index).split('\n').length
      found.push({ where: `${file}:${line}`, body: bodyFrom(source, open) })
    }
  }
  return found
}

const declarations = reloadDeclarations()

// A rename that emptied this list would leave every assertion below vacuously
// true, which is the one way a source-level test fails open.
test('the scan finds the reload declarations it is about', () => {
  // The files, not the line numbers, which move under every edit. The two fetch
  // foundations and the two displays that override one of them are what the rule
  // exists for; canvas is the one it was written against.
  const files = declarations.map(d => d.where.split(':')[0])
  for (const expected of [
    'plugins/linear-genome-view/src/BaseLinearDisplay/models/MultiRegionDisplayMixin.ts',
    'plugins/linear-genome-view/src/BaseLinearDisplay/models/GlobalFetchMixin.ts',
    'plugins/canvas/src/LinearBasicDisplay/baseModel.ts',
    'plugins/variants/src/shared/MultiSampleVariantBaseModel.ts',
    'plugins/arc/src/shared/ArcFetchModel.ts',
    'packages/core/src/pluggableElementTypes/models/BaseDisplayModel.tsx',
  ]) {
    expect(files).toContain(expected)
  }
})

test.each(declarations.map(d => [d.where, d.body] as const))(
  '%s reaches a reload counter',
  (where, body) => {
    const code = withoutComments(body)
    const empty = !code.replaceAll(/[{}\s]/g, '')
    const bumps = code.includes('reloadCount')
    // `superReload()`, the spelling MST forces: an override replaces the action
    // outright, so chaining means capturing it before the block.
    const chains = /super\w*\(\)/.test(code)
    // As an object so a failure prints which of the three the body misses
    // rather than `false !== true`.
    expect({
      where,
      reaches: empty || bumps || chains,
      empty,
      bumps,
      chains,
    }).toMatchObject({ reaches: true })
  },
)
