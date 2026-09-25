import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'

import { MarkProblemList, MarkSlotProblems } from './MarkProblems.tsx'

import type { MarkProblem } from '../markProblems.ts'

function problem(
  level: MarkProblem['level'],
  slot: string,
  mark?: number,
): MarkProblem {
  return { rule: `r-${slot}`, level, mark, slot, message: `${slot} is wrong` }
}

function show(node: React.ReactNode) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>{node}</ThemeProvider>,
  )
}

describe('MarkSlotProblems', () => {
  it('draws nothing where nothing is wrong', () => {
    const { container } = show(<MarkSlotProblems problems={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('reads as an error where one is present', () => {
    show(<MarkSlotProblems problems={[problem('error', 'encoding.y', 0)]} />)
    expect(screen.getByTestId('slot-problems-error')).toBeTruthy()
  })

  // A warning is a plot the author may not have meant, and the display draws
  // it, so it is a remark at the control rather than a refusal.
  it('reads as a warning where only warnings are', () => {
    show(<MarkSlotProblems problems={[problem('warning', 'encoding.y', 0)]} />)
    expect(screen.getByTestId('slot-problems-warning')).toBeTruthy()
  })

  it('takes the worst level when a slot has both', () => {
    show(
      <MarkSlotProblems
        problems={[
          problem('warning', 'encoding.color', 0),
          problem('error', 'encoding.color.domainMin', 0),
        ]}
      />,
    )
    expect(screen.getByTestId('slot-problems-error')).toBeTruthy()
    expect(screen.queryByTestId('slot-problems-warning')).toBeNull()
  })
})

describe('MarkProblemList', () => {
  it('draws nothing for a plot with nothing wrong', () => {
    const { container } = show(<MarkProblemList problems={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('names the mark and the slot of each', () => {
    show(
      <MarkProblemList
        problems={[
          problem('error', 'encoding.y', 1),
          problem('warning', 'rows.field'),
        ]}
      />,
    )
    const rows = screen.getByTestId('mark-plot-problems').children
    expect(rows[0]!.textContent).toBe('mark 1 encoding.y: encoding.y is wrong')
    expect(rows[1]!.textContent).toBe('rows.field: rows.field is wrong')
  })
})
