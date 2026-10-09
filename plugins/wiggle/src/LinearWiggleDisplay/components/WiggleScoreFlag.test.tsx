import { render } from '@testing-library/react'

import WiggleScoreFlag, { laneTop } from './WiggleScoreFlag.tsx'

const hit = (scores: number[]) => ({
  refName: 'ctgA',
  start: 100,
  end: 101,
  rows: scores.map(score => ({ score })),
})

const lanes = { rowsTopOffset: 20, rowHeight: 40, numRows: 3 }

function flagOf(container: HTMLElement) {
  return container.firstElementChild as HTMLElement
}

test('one row shows its score at the pointer', () => {
  const { container } = render(
    <WiggleScoreFlag
      hit={hit([12.3456789])}
      mouseX={120}
      mouseY={30}
      width={800}
      lanes={lanes}
    />,
  )
  const flag = flagOf(container)
  expect(flag.textContent).toBe('12.3457')
  expect(flag.style.left).toBe('120px')
  expect(flag.style.transform).toBe('')
})

test('the flag sits at the top of the lane the pointer is in', () => {
  const at = (mouseY: number) => {
    const { container } = render(
      <WiggleScoreFlag
        hit={hit([1])}
        mouseX={120}
        mouseY={mouseY}
        width={800}
        lanes={lanes}
      />,
    )
    return flagOf(container).style.top
  }
  expect(at(25)).toBe('20px')
  expect(at(65)).toBe('60px')
  expect(at(115)).toBe('100px')
})

test('laneTop clamps a pointer outside the rows to the first and last lane', () => {
  expect(laneTop(5, lanes)).toBe(20)
  expect(laneTop(500, lanes)).toBe(100)
})

test('the flag flips to the left of the guide near the right edge', () => {
  const { container } = render(
    <WiggleScoreFlag
      hit={hit([1])}
      mouseX={790}
      mouseY={30}
      width={800}
      lanes={lanes}
    />,
  )
  expect(flagOf(container).style.transform).toBe('translateX(-100%)')
})

test('no hit and an overlay hit draw no flag', () => {
  const none = render(
    <WiggleScoreFlag
      hit={undefined}
      mouseX={120}
      mouseY={30}
      width={800}
      lanes={lanes}
    />,
  )
  expect(none.container.firstElementChild).toBeNull()

  const overlay = render(
    <WiggleScoreFlag
      hit={hit([1, 2])}
      mouseX={120}
      mouseY={30}
      width={800}
      lanes={lanes}
    />,
  )
  expect(overlay.container.firstElementChild).toBeNull()
})
