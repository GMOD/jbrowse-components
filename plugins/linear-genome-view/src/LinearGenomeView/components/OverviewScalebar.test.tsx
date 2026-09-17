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

// Width of the trapezoid's top edge, i.e. the span it claims the row below
// shows. The points are wound bottom-left, bottom-right, top-right, top-left.
function topEdgeWidth(container: HTMLElement) {
  const points = container.querySelector('polygon')!.getAttribute('points')!
  const xs = points.split(' ').map(p => Number(p.split(',')[0]))
  return xs[2]! - xs[3]!
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

// The trapezoid joins the chromosome to whatever is drawn directly under it,
// which is this view whether or not it has detail levels — they go under the
// tracks, and their own connectors carry the reader on down from there.
describe('OverviewScalebar "you are here" trapezoid', () => {
  function overviewAt(windowWidthBp: number) {
    const model = overview(1)
    model.setWindow(windowWidthBp, 100_000_000)
    return model
  }

  function renderPolygon(model: ReturnType<typeof overviewAt>) {
    return render(
      <ThemeProvider theme={createJBrowseTheme()}>
        <OverviewScalebar model={model}>
          <div />
        </OverviewScalebar>
      </ThemeProvider>,
    ).container
  }

  it('describes the view when it has no detail levels', () => {
    // 2.5Mb of the 250Mb overview, drawn 800px wide
    expect(topEdgeWidth(renderPolygon(overviewAt(2_500_000)))).toBeCloseTo(8, 0)
  })

  it('describes the view still, once there is a detail level', () => {
    const model = overviewAt(2_500_000)
    model.addDetailLevel()
    expect(topEdgeWidth(renderPolygon(model))).toBeCloseTo(8, 0)
  })
})
