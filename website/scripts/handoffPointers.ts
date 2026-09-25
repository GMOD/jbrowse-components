// A handoff outlives the branch it names. The worktree workflow deletes both
// the branch and its directory on landing, and no other machine can act on
// either while they live, so a handoff that says "land branch X, in worktree Y"
// is unactionable the day it is written and false the day the thread lands.
//
// Naming a commit stays legal, and that is the load-bearing half of this rule.
// "Landed as `0d0709c746`" is how a handoff cites the work it reports on, and
// almost every SHA in this tree's handoff history points at main. A gate on
// "names a commit already on main" would red those while missing the case that
// motivated this one, where the cited commit had landed rebased under a new SHA
// and so was an ancestor of nothing.

export interface HandoffPointer {
  line: number
  token: string
  what: string
}

const POINTERS = [
  {
    pattern: /\.claude\/worktrees\/[A-Za-z0-9._-]+/g,
    what: 'a worktree directory',
  },
  { pattern: /\bworktree-[A-Za-z0-9._-]+/g, what: 'a worktree branch' },
]

export function findHandoffPointers(text: string): HandoffPointer[] {
  return text.split('\n').flatMap((line, idx) =>
    POINTERS.flatMap(({ pattern, what }) =>
      [...line.matchAll(pattern)].map(m => ({
        line: idx + 1,
        token: m[0],
        what,
      })),
    ),
  )
}
