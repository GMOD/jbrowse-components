import { fireEvent } from '@testing-library/react'

import { createView, expectCanvasMatch, findCanvasIn, hts } from './util.tsx'

export async function testOpenTrack({
  bpPerPx,
  start,
  trackId,
  displayTestId = 'wiggle-display-done',
  timeout = 20000,
}: {
  bpPerPx: number
  start: number
  trackId: string
  displayTestId?: string
  timeout?: number
}) {
  const { view, findByTestId } = await createView()
  view.setNewView(bpPerPx, start)
  fireEvent.click(await findByTestId(hts(trackId), {}, { timeout }))
  const display = await findByTestId(displayTestId, {}, { timeout })
  expectCanvasMatch(findCanvasIn(display))
}
