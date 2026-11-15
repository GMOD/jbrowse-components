// Fails when a decision tree names something the code no longer has: a
// backticked name in an `agent-docs/reference/*_DECISION_TREE.md`, or a
// code-like word in a label of a diagram one of them embeds.
//
//   node website/scripts/check-decision-tree-names.ts            the trees
//   node website/scripts/check-decision-tree-names.ts <file>...  these files
//
// A dotted name resolves against the config JSON schema's live slot paths, or
// as a member chain in source; a bare name against the words in source; a file
// name against the tracked files; an `@scope/name` against package.json
// dependencies. Source is product code with comments and tests stripped, so a
// name only a comment or a test still spells counts as gone. A name the schema
// lists only as a retired slot fails too, since a tree describes what the code
// does now.
import { readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import { slotPaths } from '../../scripts/configSlotPaths.ts'
import { reportProblems, repoFiles, sourceFiles } from './check-utils.ts'
import { codeOf } from './codeOf.ts'
import { fencedLines } from './docFenceRegions.ts'
import { repoRoot } from './paths.ts'

// Each entry is pinned to the line that needs it, so the same name in another
// sentence is checked as usual.
const NAMED_ON_PURPOSE = [
  {
    name: 'ICE',
    line: /hictk copies as `ICE`/,
    why: "hictk's name for a cooler's balancing weights, not ours",
  },
  {
    name: 'showLabels',
    line: /five-value `showLabels` it replaced/,
    why: 'the retired enum, named as replaced',
  },
  {
    name: 'maxScore',
    line: /label="maxScore\b/,
    why: "the Hi-C fetch's statistic, not the retired display slot",
  },
]

const PRODUCT_ROOTS = ['packages', 'plugins', 'products', 'example-plugins']
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/
const DOTTED = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/
const MEMBER_CHAIN = /[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)+/g
const PACKAGE = /^@[\w-]+\/[\w.-]+$/
const FILE_NAME = /\.(?:tsx?|jsx?|mjs|cjs|slang|md|json|sh|py|dot)$/
const REPO_PATH =
  /^(?:packages|plugins|products|website|scripts|agent-docs|test_data)\//
const CODE_IN_LABEL =
  /^(?:[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*|[A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+|[a-z][\w$]*(?:\.[A-Za-z_$][\w$]*)+)(?:\(\))?$/
const DECISION_TREE = /^agent-docs\/reference\/[A-Z_]+_DECISION_TREE\.md$/
const EMBEDDED_DIAGRAM = /\]\((diagrams\/[\w-]+)\.svg\)/g

function sourceNames() {
  const words = new Set<string>()
  const chains = new Set<string>()
  const isSource = (name: string) =>
    /\.(?:tsx?|jsx?|mjs|cjs|slang)$/.test(name) && !name.includes('.test.')
  for (const file of sourceFiles(PRODUCT_ROOTS, isSource)) {
    const code = codeOf(readFileSync(file, 'utf8'))
    for (const [word] of code.matchAll(/[A-Za-z_$][\w$]*/g)) {
      words.add(word)
    }
    for (const [chain] of code.matchAll(MEMBER_CHAIN)) {
      const parts = chain.replaceAll('?.', '.').split('.')
      parts.forEach((_, from) => {
        for (let to = from + 2; to <= parts.length; to++) {
          chains.add(parts.slice(from, to).join('.'))
        }
      })
    }
  }
  return { words, chains }
}

function configSlots() {
  const { version } = JSON.parse(
    readFileSync(join(repoRoot, 'products/jbrowse-web/package.json'), 'utf8'),
  )
  const schema = JSON.parse(
    readFileSync(
      join(
        repoRoot,
        `website/static/schema/v${version.split('.')[0]}/config.json`,
      ),
      'utf8',
    ),
  )
  const slot = (path: string) => path.replaceAll(/\[\]|\{\}/g, '')
  const live = new Set(slotPaths(schema, { live: true }))
  const all = [...slotPaths(schema)].filter(path => !path.includes('='))
  return {
    live: all.filter(path => live.has(path)).map(slot),
    retired: all.filter(path => !live.has(path)).map(slot),
  }
}

const source = sourceNames()
const slots = configSlots()
const files = repoFiles()
const dependencies = new Set(
  files
    .filter(f => f.endsWith('package.json'))
    .flatMap(f => {
      const pkg = JSON.parse(readFileSync(join(repoRoot, f), 'utf8'))
      return [
        pkg.name,
        ...Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }),
      ]
    }),
)
const lastKey = (path: string) => path.slice(path.lastIndexOf('.') + 1)
const endsWithSlot = (paths: string[], dotted: string) =>
  paths.some(path => path === dotted || path.endsWith(`.${dotted}`))
const mirrorsDisplaySlots = (path: string) => path.includes('.displayDefaults.')
const liveKeys = new Set(
  slots.live.filter(path => !mirrorsDisplaySlots(path)).map(lastKey),
)
const retiredKeys = new Set(
  slots.retired.map(lastKey).filter(key => !liveKeys.has(key)),
)

function fileProblem(name: string) {
  const path = name.replace(/\/$/, '')
  return files.some(
    f => f === path || f.endsWith(`/${path}`) || f.startsWith(`${path}/`),
  )
    ? undefined
    : 'no such file in the repo'
}

function dottedProblem(name: string) {
  return endsWithSlot(slots.live, name) || source.chains.has(name)
    ? undefined
    : endsWithSlot(slots.retired, name)
      ? 'a retired config slot'
      : 'neither a config slot nor a member chain in source'
}

function identifierProblem(name: string) {
  return retiredKeys.has(name)
    ? 'a retired config slot'
    : source.words.has(name)
      ? undefined
      : 'no such name in source'
}

function problemWith(spelled: string, line: string) {
  const name = spelled
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
    .replace(/\(\)$/, '')
    .replace(/^\./, '')
  return NAMED_ON_PURPOSE.some(e => e.name === name && e.line.test(line))
    ? undefined
    : PACKAGE.test(name)
      ? dependencies.has(name)
        ? undefined
        : 'named by no package.json'
      : FILE_NAME.test(name) || REPO_PATH.test(name)
        ? fileProblem(name)
        : DOTTED.test(name)
          ? dottedProblem(name)
          : IDENTIFIER.test(name)
            ? identifierProblem(name)
            : undefined
}

function markdownNames(text: string) {
  const lines = text.split('\n')
  const fenced = fencedLines(lines)
  return lines.flatMap((line, i) =>
    fenced[i]
      ? []
      : [...line.matchAll(/`([^`\n]+)`/g)].map(m => ({
          line: i + 1,
          text: line,
          name: m[1]!,
        })),
  )
}

function diagramNames(text: string) {
  return text.split('\n').flatMap((line, i) =>
    [...line.matchAll(/label="((?:[^"\\]|\\.)*)"/g)].flatMap(m =>
      m[1]!
        .replaceAll('\\n', ' ')
        .split(/[\s,;:()[\]]+/)
        .map(word => word.replace(/[.,]+$/, ''))
        .filter(word => CODE_IN_LABEL.test(word))
        .map(name => ({ line: i + 1, text: line, name })),
    ),
  )
}

function embeddedDiagrams(doc: string) {
  return [...readFileSync(doc, 'utf8').matchAll(EMBEDDED_DIAGRAM)].map(m =>
    join(dirname(doc), `${m[1]}.dot`),
  )
}

const named = process.argv.slice(2).map(file => resolve(file))
const trees = files
  .filter(f => DECISION_TREE.test(f))
  .map(f => join(repoRoot, f))
const targets = named.length
  ? named
  : [...trees, ...new Set(trees.flatMap(embeddedDiagrams))]

const problems = targets.flatMap(file => {
  const text = readFileSync(file, 'utf8')
  return (file.endsWith('.dot') ? diagramNames(text) : markdownNames(text))
    .map(({ line, text: lineText, name }) => ({
      line,
      name,
      problem: problemWith(name, lineText),
    }))
    .filter(({ problem }) => problem)
    .map(
      ({ line, name, problem }) =>
        `${relative(process.cwd(), file)}:${line}: \`${name}\` is ${problem}`,
    )
})

reportProblems(
  problems,
  `Every name in ${targets.length} decision trees and their diagrams resolves.`,
)
