import type { MarkProblem, MarkProblemLevel } from './markProblems.ts'

const NONE: readonly MarkProblem[] = []

/**
 * The worst level a set of problems reaches, for a summary a reader sees
 * before opening the thing it describes — a row's dot, a section's heading.
 */
export function worstLevel(
  problems: readonly MarkProblem[],
): MarkProblemLevel | undefined {
  let worst: MarkProblemLevel | undefined
  for (const { level } of problems) {
    if (level === 'error') {
      return 'error'
    }
    worst = 'warning'
  }
  return worst
}

/**
 * `markProblems`' findings addressed by where they came from, so a control can
 * ask what is wrong with the slot it edits.
 */
export interface MarkProblemIndex {
  all: readonly MarkProblem[]
  errors: readonly MarkProblem[]
  /** Problems naming no mark: the display's own `transform`, `facet`, `rows`. */
  display: readonly MarkProblem[]
  /** Every problem of one mark, in the order the rules found them. */
  forMark: (mark: number) => readonly MarkProblem[]
  /**
   * The problems at a slot and at every slot under it, so a control bound to
   * `encoding.color` answers for `encoding.color.domainMin` too. `mark` is
   * `undefined` for a display-level slot.
   */
  under: (mark: number | undefined, slot: string) => readonly MarkProblem[]
}

function covers(slot: string, prefix: string) {
  return slot === prefix || slot.startsWith(`${prefix}.`)
}

export function markProblemIndex(
  problems: readonly MarkProblem[],
): MarkProblemIndex {
  const byMark = new Map<number, MarkProblem[]>()
  const display: MarkProblem[] = []
  const errors: MarkProblem[] = []
  for (const problem of problems) {
    const { mark, level } = problem
    if (mark === undefined) {
      display.push(problem)
    } else {
      const held = byMark.get(mark)
      if (held) {
        held.push(problem)
      } else {
        byMark.set(mark, [problem])
      }
    }
    if (level === 'error') {
      errors.push(problem)
    }
  }
  const forMark = (mark: number) => byMark.get(mark) ?? NONE
  return {
    all: problems,
    errors,
    display,
    forMark,
    under: (mark, slot) =>
      (mark === undefined ? display : forMark(mark)).filter(problem =>
        covers(problem.slot, slot),
      ),
  }
}
