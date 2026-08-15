import { render } from '@testing-library/react'

import ComparativeTooltip from './ComparativeTooltip.tsx'

test('renders one line per entry', () => {
  const { getByText } = render(
    <ComparativeTooltip lines={['chr1:100-200', 'Identity: 98%']} />,
  )
  getByText(/chr1:100-200/)
  getByText(/Identity: 98%/)
})

// The whole reason both views share this component. Every line carries text out
// of an alignment file, so a refName holding markup has to reach the screen as
// characters. The synteny side used to join its lines with `<br/>` and hand the
// result to `SanitizedHTML`, which stripped a hostile refName's own spelling.
test('a line holding markup is text, not markup', () => {
  const { container, getByText } = render(
    <ComparativeTooltip lines={['<img src=x onerror=alert(1)>', 'Name: b']} />,
  )
  expect(container.querySelector('img')).toBeNull()
  getByText(/<img src=x onerror=alert\(1\)>/)
})

test('renders nothing for no lines', () => {
  const { baseElement } = render(<ComparativeTooltip lines={[]} />)
  expect(baseElement.textContent).toBe('')
})
