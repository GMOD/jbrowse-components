// A menu row ending in "..." opens a dialog or widget that asks for more input.
// A submenu row never carries it: the arrow already says more follows.
//
// Run: `pnpm check-menu-ellipsis`, or the root `pnpm check-docs`.
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { reportProblems, walkFiles } from './check-utils.ts'
import { repoRoot } from './paths.ts'

const BUILD_DIRS = new Set(['node_modules', 'dist', 'esm', 'cjs', 'build'])
const PROPERTY = String.raw`\s*(?!label\b|onClick\b|subMenu\b)\w+:[^\n]*\n`
const SUBMENU_LABEL = new RegExp(
  String.raw`label:\s*(['"\`])([^'"\`\n]*(?:\.\.\.|…))\1,\s*\n(?:${PROPERTY}){0,4}\s*subMenu\b`,
  'g',
)

const errorLines = ['plugins', 'packages', 'products'].flatMap(root =>
  walkFiles(
    join(repoRoot, root),
    name => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name),
    BUILD_DIRS,
  ).flatMap(file => {
    const text = readFileSync(file, 'utf8')
    return [...text.matchAll(SUBMENU_LABEL)].map(match => {
      const line = text.slice(0, match.index).split('\n').length
      return `${relative(repoRoot, file)}:${line}: submenu row "${match[2]}" ends in an ellipsis`
    })
  }),
)

reportProblems(
  errorLines.length > 0
    ? [
        ...errorLines,
        '\nAn ellipsis marks a row that opens a dialog. Drop it from a submenu row.',
      ]
    : [],
  'No submenu row ends in an ellipsis.',
)
