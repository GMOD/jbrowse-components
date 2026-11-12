import { statusFraction } from '@jbrowse/core/util'

import { clusterProgressStatus } from './clusterProgressStatus.ts'

// hclust counts each phase 0→100% on its own, so forwarding the counts raw made
// the bar fill to ~100%, snap back to zero, and fill again. Each phase owns half
// the bar instead. The two phases have unrelated totals (distance calcs vs merge
// iterations), which is why each is scaled against its own.
describe('clusterProgressStatus', () => {
  it('spans 0-50% across the distance phase', () => {
    expect(
      statusFraction(
        clusterProgressStatus({
          phase: 'distance',
          message: 'Computing distance matrix',
          current: 0,
          total: 200,
        }),
      ),
    ).toBe(0)
    expect(
      statusFraction(
        clusterProgressStatus({
          phase: 'distance',
          message: 'Computing distance matrix',
          current: 200,
          total: 200,
        }),
      ),
    ).toBe(0.5)
  })

  it('picks up at 50% and runs to 100% across the clustering phase', () => {
    expect(
      statusFraction(
        clusterProgressStatus({
          phase: 'clustering',
          message: 'Clustering samples',
          current: 0,
          total: 9,
        }),
      ),
    ).toBe(0.5)
    expect(
      statusFraction(
        clusterProgressStatus({
          phase: 'clustering',
          message: 'Clustering samples',
          current: 9,
          total: 9,
        }),
      ),
    ).toBe(1)
  })

  it('never goes backwards when handing off between phases', () => {
    const endOfDistance = statusFraction(
      clusterProgressStatus({
        phase: 'distance',
        message: 'Computing distance matrix',
        current: 200,
        total: 200,
      }),
    )!
    const startOfClustering = statusFraction(
      clusterProgressStatus({
        phase: 'clustering',
        message: 'Clustering samples',
        current: 0,
        total: 9,
      }),
    )!
    expect(startOfClustering).toBeGreaterThanOrEqual(endOfDistance)
  })

  it('leaves init indeterminate rather than reading as 0%', () => {
    const status = clusterProgressStatus({
      phase: 'init',
      message: 'Running hierarchical clustering in WASM',
      current: 0,
      total: 0,
    })
    expect(status).toBe('Running hierarchical clustering in WASM')
    expect(statusFraction(status)).toBeUndefined()
  })
})
