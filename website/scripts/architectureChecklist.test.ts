import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { checkArchitectureDoc, slug } from './architecture-checklist-rules.ts'
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

test('the doc as written passes', () => {
  const { entryCount, problems } = checkArchitectureDoc({ doc: GOOD, readLink })
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
  const { problems } = checkArchitectureDoc({ doc, readLink })
  expect(problems).toHaveLength(1)
  expect(problems[0]).toContain("Don't do the first thing")
})

// The half that stops the first from being satisfiable with a dead link.
test('an in-doc anchor a rename took away fails', () => {
  const doc = GOOD.replace('## Display stacks', '## Display stacks and layers')
  const { problems } = checkArchitectureDoc({ doc, readLink })
  expect(problems).toHaveLength(1)
  expect(problems[0]).toContain('#display-stacks')
})

test('an anchor into another doc is checked against that doc', () => {
  const { problems } = checkArchitectureDoc({
    doc: GOOD,
    readLink: path =>
      path === 'reference/SVG_EXPORT.md' ? '# SVG export\n' : undefined,
  })
  expect(problems).toHaveLength(1)
  expect(problems[0]).toContain('reference/SVG_EXPORT.md#the-gate')
})

test('a link to a file that does not exist fails', () => {
  const { problems } = checkArchitectureDoc({
    doc: GOOD,
    readLink: () => undefined,
  })
  expect(problems.some(p => p.includes('does not exist'))).toBe(true)
})

test('a renamed checklist section is reported rather than passing vacuously', () => {
  const doc = GOOD.replace('## What not to do', '## Things not to do')
  const { problems } = checkArchitectureDoc({ doc, readLink })
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
