import { render } from '@testing-library/react'

import WiggleScoreFlag from './WiggleScoreFlag.tsx'

const hit = (scores: number[]) => ({
  refName: 'ctgA',
  start: 100,
  end: 101,
  rows: scores.map(score => ({ score })),
})

test('one row shows its score at the pointer', () => {
  const { container } = render(
    <WiggleScoreFlag hit={hit([12.3456789])} mouseX={120} width={800} />,
  )
  const flag = container.firstElementChild as HTMLElement
  expect(flag.textContent).toBe('12.3457')
  expect(flag.style.left).toBe('120px')
  expect(flag.style.transform).toBe('')
})

test('the flag flips to the left of the guide near the right edge', () => {
  const { container } = render(
    <WiggleScoreFlag hit={hit([1])} mouseX={790} width={800} />,
  )
  expect((container.firstElementChild as HTMLElement).style.transform).toBe(
    'translateX(-100%)',
  )
})

test('no hit and an overlay hit draw no flag', () => {
  const none = render(
    <WiggleScoreFlag hit={undefined} mouseX={120} width={800} />,
  )
  expect(none.container.firstElementChild).toBeNull()

  const overlay = render(
    <WiggleScoreFlag hit={hit([1, 2])} mouseX={120} width={800} />,
  )
  expect(overlay.container.firstElementChild).toBeNull()
})
