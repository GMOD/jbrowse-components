import { createTestSession } from '@jbrowse/web/testUtils'

import type { BreakpointViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const REGION = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 50_000,
}

async function linkedPair() {
  const view = (await createTestSession().launchView('BreakpointSplitView', {
    linkViews: true,
    views: [
      { type: 'LinearGenomeView', displayedRegions: [REGION] },
      { type: 'LinearGenomeView', displayedRegions: [REGION] },
    ],
  })) as BreakpointViewModel
  for (const [i, v] of view.views.entries()) {
    v.setWidth(800)
    v.setWindow(8000, 10_000 + i * 20_000)
  }
  return view.views
}

function bpUnder(v: { windowStartBp: number; bpPerPx: number }, px: number) {
  return v.windowStartBp + px * v.bpPerPx
}

test('a cursor-anchored zoom zooms every linked view about the same pixel', async () => {
  const [a, b] = await linkedPair()
  const anchor = bpUnder(b!, 100)
  a!.zoomTo(a!.bpPerPx / 2, 100)
  expect(b!.bpPerPx).toBe(a!.bpPerPx)
  expect(bpUnder(b!, 100)).toBeCloseTo(anchor)
})
