import { createTestSession } from '@jbrowse/web/testUtils'

import type { LinearGenomeViewModel } from './index.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const region = {
  assemblyName: 'volMyt1',
  refName: 'ctgA',
  start: 0,
  end: 1_000_000,
}

function addLgv(
  session: ReturnType<typeof createTestSession>,
  snapshot: { id: string; zoomOf?: string; hideHeader?: boolean },
  end = region.end,
): LinearGenomeViewModel {
  const view = session.addView('LinearGenomeView', {
    ...snapshot,
    displayedRegions: [{ ...region, end }],
  })
  view.setWidth(800)
  return view
}

function setup({
  zoomOf = 'overview',
  hideHeader = false,
  sourceEnd = region.end,
  windowBp = 10_000,
  windowStart = 500_000,
} = {}) {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'seq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'a', start: 0, end: 1_000_000 },
        ],
      },
    },
  })
  const overview = addLgv(session, { id: 'overview' }, sourceEnd)
  overview.showAllRegions()
  const closeUp = addLgv(session, { id: 'closeUp', zoomOf, hideHeader })
  closeUp.setWindow(windowBp, windowStart)
  return { overview, closeUp }
}

test("the source marks the close-up's extent inside its own width", () => {
  const { overview } = setup()
  const [marker] = overview.zoomMarkers
  expect(overview.zoomMarkers).toHaveLength(1)
  expect(marker!.id).toBe('closeUp')
  expect(marker!.width).toBeGreaterThanOrEqual(3)
  expect(marker!.left).toBeGreaterThan(0)
  expect(marker!.left + marker!.width).toBeLessThan(overview.width)
  expect(marker!.left).toBeCloseTo(400, -1)
})

test('the close-up connects its marker to its full width', () => {
  const { overview, closeUp } = setup()
  const [marker] = overview.zoomMarkers
  expect(closeUp.zoomSource?.id).toBe('overview')
  expect(closeUp.zoomConnector).toEqual({
    top: { leftPx: marker!.left, rightPx: marker!.left + marker!.width },
    bottom: { leftPx: 0, rightPx: 800 },
  })
})

test('the link adds nothing to the header', () => {
  const { closeUp } = setup({ hideHeader: true })
  expect(closeUp.headerHeight).toBe(0)
})

test('a dangling zoomOf draws no connector and marks nothing', () => {
  const { overview, closeUp } = setup({ zoomOf: 'nowhere' })
  expect(closeUp.zoomSource).toBeUndefined()
  expect(closeUp.zoomConnector).toBeUndefined()
  expect(overview.zoomMarkers).toEqual([])
})

test('a close-up narrower than a pixel in the source still gets a 3px marker', () => {
  const { overview } = setup({ windowBp: 100 })
  expect(overview.zoomMarkers[0]!.width).toBe(3)
})

test('a close-up edge past the source regions clamps to their end', () => {
  const { overview } = setup({ sourceEnd: 500_000, windowStart: 495_000 })
  const [marker] = overview.zoomMarkers
  expect(marker!.left + marker!.width).toBeCloseTo(
    overview.displayedRegionsTotalPx - overview.offsetPx,
  )
  expect(marker!.width).toBeGreaterThan(3)
})

test('a minimized close-up is not marked', () => {
  const { overview, closeUp } = setup()
  closeUp.setMinimized(true)
  expect(overview.zoomMarkers).toEqual([])
})
