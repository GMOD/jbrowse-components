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

  it('stays indeterminate for a phase with no denominator', () => {
    render(
      <ClusterProgress
        status={{
          message: 'Running hierarchical clustering in WASM',
          current: 0,
          total: 0,
        }}
        onStop={() => {}}
      />,
    )

    expect(
      screen.getByText('Running hierarchical clustering in WASM'),
    ).toBeTruthy()
    expect(
      screen.getByRole('progressbar').getAttribute('aria-valuenow'),
    ).toBeNull()
  })
})
