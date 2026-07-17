import { render, screen } from '@testing-library/react'

import ClusterProgress from './ClusterProgress.tsx'

// @gmod/hclust reports {message, current, total} rather than a preformatted
// "Clustering samples: 13%" string, so the percentage is formatted here and the
// raw counts drive a determinate bar. The 'init' phase has no denominator and
// must stay indeterminate rather than reading as 0%.
describe('ClusterProgress', () => {
  it('drives a determinate bar off the reported counts', () => {
    render(
      <ClusterProgress
        status={{ message: 'Clustering samples', current: 13, total: 100 }}
        onStop={() => {}}
      />,
    )

    expect(screen.getByText('Clustering samples 13%')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '13',
    )
  })

  // MUI sweeps an indeterminate bar across the full width, which reads as ~100%
  // and then appears to jump backwards once the first real (small) fraction
  // lands. Startup holds at a determinate 0 instead, and the label carries no
  // percentage until there is one to show.
  it('holds at a determinate 0 before any counts arrive', () => {
    render(<ClusterProgress status="Initializing" onStop={() => {}} />)

    expect(screen.getByText('Initializing')).toBeTruthy()
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('0')
    expect(bar.className).not.toMatch(/indeterminate/)
  })
})
