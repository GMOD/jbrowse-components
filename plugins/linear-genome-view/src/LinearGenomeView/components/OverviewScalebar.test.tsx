import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import OverviewScalebar from './OverviewScalebar.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// chromosome-scale regions, so the overview's tick pitch lands in the hundreds
// of Mb like it does on a real assembly
function overview(numRegions: number) {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          displayedRegions: Array.from({ length: numRegions }, (_, i) => ({
            assemblyName: 'volvox',
            refName: `ctg${i}`,
            start: 0,
            end: 250_000_000,
          })),
          tracks: [],
          configuration: {},
        },
      ],
    },
  }) as any
  const model = session.views[0]
  model.setWidth(800)
  return model
}

function renderOverview(numRegions: number) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <OverviewScalebar model={overview(numRegions)}>
        <div />
      </OverviewScalebar>
    </ThemeProvider>,
  )
}

describe('OverviewScalebar tick labels', () => {
  it('numbers a single region that fills the overview', () => {
    const { container } = renderOverview(1)
    expect(container.textContent).toContain('50M')
    expect(container.textContent).toContain('200M')
  })

  it('leaves narrow per-chromosome blocks unnumbered', () => {
    // each 250Mb block is only 200px wide, so it catches exactly one 200M tick —
    // a lone number jammed against the next block's refName
    const { container } = renderOverview(4)
    expect(container.textContent).toContain('ctg0')
    expect(container.textContent).not.toContain('M')
  })
})
