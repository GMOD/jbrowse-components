import { render } from '@testing-library/react'

import WiggleRowLabels from './WiggleRowLabels.tsx'

test('the live row labels sit on the wash over the plot', () => {
  const { container } = render(
    <svg>
      <WiggleRowLabels
        model={{
          sources: [{ name: 'a' }, { name: 'b' }],
          effectiveRowHeight: 40,
          drawsRowLabels: true,
        }}
        labelOffset={0}
      />
    </svg>,
  )
  expect(container.querySelectorAll('path')).toHaveLength(3)
  expect(container.querySelectorAll('text')).toHaveLength(2)
})
