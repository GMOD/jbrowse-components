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

  // The manual tab drives this off `useFetch`, which exposes no stop handle —
  // its token is tied to the key and the mount, so the dialog's own Cancel IS
  // the stop and a second button here would claim an affordance that does
  // nothing. It still gets the label and the bar, which is the point: the two
  // tabs do the same work and now report it the same way.
  it('omits the Stop button when the caller has no stop to offer', () => {
    render(<ClusterProgress label="Generating genotype matrix" />)

    expect(screen.getByText('Generating genotype matrix')).toBeTruthy()
    expect(screen.queryByText('Stop')).toBeNull()
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })

  // The label is a fallback, never a prefix: once the fetcher names its phase
  // that is the more specific thing to show.
  it('a reported phase replaces the fallback label', () => {
    render(
      <ClusterProgress
        label="Generating genotype matrix"
        status={{ message: 'Downloading variants', current: 3, total: 4 }}
      />,
    )

    expect(screen.getByText('Downloading variants 75%')).toBeTruthy()
    expect(screen.queryByText('Generating genotype matrix')).toBeNull()
  })
})
