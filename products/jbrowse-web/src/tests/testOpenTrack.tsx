import { fireEvent } from '@testing-library/react'

import { createView, expectCanvasMatch, hts, pv } from './util'

export async function testOpenTrack({
  bpPerPx,
  start,
  trackId,
  canvasLoc,
  timeout = 20000,
}: {
  bpPerPx: number
  start: number
  trackId: string
  canvasLoc: string
  timeout?: number
}) {
  const { view, findByTestId } = await createView()
  view.setNewView(bpPerPx, start)
  fireEvent.click(await findByTestId(hts(trackId), {}, { timeout }))
  expectCanvasMatch(await findByTestId(pv(canvasLoc), {}, { timeout }))
}
