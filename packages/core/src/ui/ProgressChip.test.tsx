import { render } from '@testing-library/react'

import ProgressChip from './ProgressChip.tsx'

describe('ProgressChip', () => {
  it('shows the message with no progress bar when indeterminate', () => {
    const { container, getByText } = render(
      <ProgressChip status={{ message: 'Downloading features' }} />,
    )
    // message text is present (LoadingEllipses appends animated dots, so match
    // a substring rather than the exact node text)
    expect(getByText(/Downloading features/)).toBeTruthy()
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
  })

  it('shows a determinate bar and percent when progress is present', () => {
    const { container, getByText } = render(
      <ProgressChip status={{ message: 'Downloading', fraction: 0.42 }} />,
    )
    expect(getByText(/Downloading 42%/)).toBeTruthy()
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar).toBeTruthy()
    expect(bar?.getAttribute('aria-valuenow')).toBe('42')
  })

  it('falls back to a generic label when message is absent but progress is set', () => {
    const { getByText } = render(<ProgressChip status={{ fraction: 0.5 }} />)
    expect(getByText(/Loading 50%/)).toBeTruthy()
  })
})
