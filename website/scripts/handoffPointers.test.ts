/// <reference types="jest" />
// See docFenceRegions.test.ts for why the reference above is here.

/**
 * The detector for a handoff pointing at somewhere instead of at something.
 *
 * The second test is the load-bearing one. This check was nearly built as
 * "a handoff naming a commit already on main fails", which is backwards: the
 * citations are overwhelmingly legitimate, and the sentence that cost a session
 * named a commit that had landed rebased and so was an ancestor of nothing. If
 * anyone widens this to commits, that test goes red and says why.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { docFiles } from './check-utils.ts'
import { findHandoffPointers } from './handoffPointers.ts'
import { repoRoot } from './paths.ts'

const tokens = (text: string) => findHandoffPointers(text).map(p => p.token)

test('the sentence that cost a session is refused', () => {
  // Verbatim from hprc-graph-overview-and-live-stack.md at cac2e55f96, which
  // told a reader to land work that was already on main.
  expect(
    tokens(
      'Land the gutter spike: branch `worktree-multiway-pair-cigar`, commit\n' +
        '`1fd6d062ce`, worktree `.claude/worktrees/multiway-pair-cigar`.',
    ),
  ).toEqual([
    'worktree-multiway-pair-cigar',
    '.claude/worktrees/multiway-pair-cigar',
  ])
})

test('citing a commit stays legal, in every form the handoffs use', () => {
  expect(
    tokens('**Landed** as `0d0709c746`, and code/jb2/main carries it.'),
  ).toEqual([])
  expect(tokens('the range it reviewed, de0a383e01..c860b6e68f')).toEqual([])
  expect(tokens('`1db2c62d90` through `9ace74a1ad`')).toEqual([])
  expect(tokens('git diff de0a383e01^ c860b6e68f')).toEqual([])
  // The word alone is what the rule is about, not the concept.
  expect(tokens('Run it in your own worktree before landing.')).toEqual([])
})

test('the handoffs in the tree name none', () => {
  const found = docFiles(join(repoRoot, 'agent-docs', 'handoffs'))
    .filter(file => !file.endsWith('README.md'))
    .flatMap(file => findHandoffPointers(readFileSync(file, 'utf8')))
  expect(found).toEqual([])
})
