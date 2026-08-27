import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  STATES_NO_RULES,
  checkArchitectureDoc,
  slug,
} from './architecture-checklist-rules.ts'
import { repoRoot } from './paths.ts'

// A doc small enough to state the whole shape, so each case below removes one
// thing from something that passes.
const GOOD = `# Architecture

## Display stacks

Prose.

## What not to do

- Don't do the first thing. See [display stacks](#display-stacks).
- Don't do the second. See [SVG_EXPORT.md](reference/SVG_EXPORT.md#the-gate).

## See also

- [reference/SVG_EXPORT.md](reference/SVG_EXPORT.md)
`

const links: Record<string, string> = {
  'reference/SVG_EXPORT.md': '# SVG export\n\n## The gate\n',
}
const readLink = (path: string) => links[path]
// The fixture's own exemption set. Passing the real doc's would judge these
// headings by another doc's answers.
const statesNoRules = { prose: 'a fixture heading that states nothing' }

test('the doc as written passes', () => {
  const { entryCount, problems } = checkArchitectureDoc({
    doc: GOOD,
    readLink,
    statesNoRules,
  })
  expect(problems).toEqual([])
  expect(entryCount).toBe(2)
})

// The defect this check exists for: an entry that argues in place and points
// nowhere. `effectiveBodyMounted` was six lines of it, naming a term that
// appeared in no other agent doc.
test('an entry that links nothing fails, and the message names it', () => {
  const doc = GOOD.replace(
    "- Don't do the first thing. See [display stacks](#display-stacks).",
    "- Don't do the first thing, for a long reason stated right here.",
  )
  const { problems } = checkArchitectureDoc({ doc, readLink, statesNoRules })
  // Removing the link also un-indexes the section it pointed at, which is the
  // two halves reporting the same edit.
  expect(problems.some(p => p.includes("Don't do the first thing"))).toBe(true)
})

// The half that stops the first from being satisfiable with a dead link.
test('an in-doc anchor a rename took away fails', () => {
  const doc = GOOD.replace('## Display stacks', '## Display stacks and layers')
  const { problems } = checkArchitectureDoc({ doc, readLink, statesNoRules })
  expect(
    problems.some(p => p.includes('links "#display-stacks", which is not')),
  ).toBe(true)
})

test('an anchor into another doc is checked against that doc', () => {
  const { problems } = checkArchitectureDoc({
    doc: GOOD,
    readLink: path =>
      path === 'reference/SVG_EXPORT.md' ? '# SVG export\n' : undefined,
    statesNoRules,
  })
  expect(problems).toHaveLength(1)
  expect(problems[0]).toContain('reference/SVG_EXPORT.md#the-gate')
})

test('a link to a file that does not exist fails', () => {
  const { problems } = checkArchitectureDoc({
    doc: GOOD,
    readLink: () => undefined,
    statesNoRules,
  })
  expect(problems.some(p => p.includes('does not exist'))).toBe(true)
})

test('a renamed checklist section is reported rather than passing vacuously', () => {
  const doc = GOOD.replace('## What not to do', '## Things not to do')
  const { problems } = checkArchitectureDoc({ doc, readLink, statesNoRules })
  expect(problems).toHaveLength(1)
  expect(problems[0]).toContain('What not to do')
})

// An em dash between words leaves two spaces, so GitHub emits two hyphens —
// the case a naive slugger gets wrong, and two real anchors depend on it.
test('slug matches GitHub on the headings this doc actually has', () => {
  expect(slug('`rpcProps()` / `gpuProps()` pattern')).toBe(
    'rpcprops--gpuprops-pattern',
  )
  expect(
    slug('`gpuProps()` and derived region maps — re-upload without refetch'),
  ).toBe('gpuprops-and-derived-region-maps--re-upload-without-refetch')
})

// The completeness half: a section the checklist never points at is either a
// rule with no line or descriptive, and the doc has to say which.
test('a section no entry links, and no exemption names, fails', () => {
  const doc = GOOD.replace(
    '## What not to do',
    '## Zoom staleness\n\nA rule lives here.\n\n## What not to do',
  )
  const { problems } = checkArchitectureDoc({ doc, readLink, statesNoRules })
  expect(problems).toHaveLength(1)
  expect(problems[0]).toContain('Zoom staleness')
})

test('an exemption lets that section through', () => {
  const doc = GOOD.replace(
    '## What not to do',
    '## Zoom staleness\n\nDescriptive.\n\n## What not to do',
  )
  const { problems } = checkArchitectureDoc({
    doc,
    readLink,
    statesNoRules: { ...statesNoRules, 'zoom-staleness': 'descriptive' },
  })
  expect(problems).toEqual([])
})

// Both halves wrong at once: the section grew a rule and kept its exemption.
test('a section that is both exempted and indexed fails', () => {
  const { problems } = checkArchitectureDoc({
    doc: GOOD,
    readLink,
    statesNoRules: { ...statesNoRules, 'display-stacks': 'stale exemption' },
  })
  expect(problems).toHaveLength(1)
  expect(problems[0]).toContain('Drop the exemption')
})

// An exemption is keyed by slug, so a renamed section loses its exemption
// rather than keeping it under a heading nobody wrote.
test('every STATES_NO_RULES key is a heading the real doc still has', () => {
  const doc = readFileSync(
    join(repoRoot, 'agent-docs', 'ARCHITECTURE.md'),
    'utf8',
  )
  const headings = new Set(
    [...doc.matchAll(/^#{2,3}\s+(.*)$/gm)].map(m => slug(m[1]!.trim())),
  )
  for (const key of Object.keys(STATES_NO_RULES)) {
    expect(headings).toContain(key)
  }
})

test('the real ARCHITECTURE.md passes its own rules', () => {
  const archDir = join(repoRoot, 'agent-docs')
  const { problems } = checkArchitectureDoc({
    doc: readFileSync(join(archDir, 'ARCHITECTURE.md'), 'utf8'),
    readLink: path => {
      try {
        return path.endsWith('.md')
          ? readFileSync(join(archDir, path), 'utf8')
          : ''
      } catch {
        return undefined
      }
    },
  })
  expect(problems).toEqual([])
})
