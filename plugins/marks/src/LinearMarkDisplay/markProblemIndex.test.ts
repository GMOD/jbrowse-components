import { markProblemIndex, worstLevel } from './markProblemIndex.ts'

import type { MarkProblem } from './markProblems.ts'

function problem(
  mark: number | undefined,
  slot: string,
  level: MarkProblem['level'] = 'warning',
): MarkProblem {
  return { rule: `r-${slot}`, level, mark, slot, message: slot }
}

const PROBLEMS = [
  problem(0, 'encoding.y', 'error'),
  problem(0, 'encoding.color.domainMin'),
  problem(0, 'encoding.colorValue'),
  problem(1, 'transform.2.expr', 'error'),
  problem(1, 'transform'),
  problem(undefined, 'facet.transform'),
  problem(undefined, 'rows.field'),
]

const index = markProblemIndex(PROBLEMS)

describe('under', () => {
  // A control bound to `encoding.color` owns the scale's members too, so it
  // has to answer for the slots the rules address inside it.
  it('rolls a child slot up to the control that owns it', () => {
    expect(index.under(0, 'encoding.color').map(p => p.slot)).toEqual([
      'encoding.color.domainMin',
    ])
  })

  it('stops at a segment boundary rather than matching a longer name', () => {
    expect(index.under(0, 'encoding.color').map(p => p.slot)).not.toContain(
      'encoding.colorValue',
    )
  })

  it('takes the slot itself as well as what is under it', () => {
    expect(index.under(1, 'transform').map(p => p.slot)).toEqual([
      'transform.2.expr',
      'transform',
    ])
  })

  it('reads the display slots when no mark is named', () => {
    expect(index.under(undefined, 'facet').map(p => p.slot)).toEqual([
      'facet.transform',
    ])
    expect(index.under(undefined, 'rows.field')).toHaveLength(1)
  })

  it('never crosses from one mark to another', () => {
    expect(index.under(0, 'transform')).toEqual([])
  })
})

describe('forMark and display', () => {
  it('splits what a mark owns from what the display does', () => {
    expect(index.forMark(0)).toHaveLength(3)
    expect(index.display.map(p => p.slot)).toEqual([
      'facet.transform',
      'rows.field',
    ])
  })

  it('answers a mark with nothing wrong', () => {
    expect(index.forMark(9)).toEqual([])
  })
})

it('collects the errors across marks and the display alike', () => {
  expect(index.errors.map(p => p.slot)).toEqual([
    'encoding.y',
    'transform.2.expr',
  ])
})

describe('worstLevel', () => {
  it('is the error where one is present, whatever its place', () => {
    expect(worstLevel(index.forMark(0))).toBe('error')
    expect(worstLevel(index.forMark(1))).toBe('error')
  })

  it('is the warning where only warnings are', () => {
    expect(worstLevel(index.display)).toBe('warning')
  })

  it('is nothing at all where nothing is wrong', () => {
    expect(worstLevel([])).toBeUndefined()
  })
})
