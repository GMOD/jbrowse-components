import { userEvent } from '@testing-library/user-event'

import { createView, expectCanvasMatch, findCanvasIn, hts } from './util.tsx'

export async function testLinkedReadsDisplay({
  loc,
  track,
  displayMode,
  timeout = 60000,
}: {
  loc: string
  track: string
  displayMode: 'arc' | 'cloud' | 'bezier' | 'stack'
  canvasId?: string
  timeout?: number
}) {
  const user = userEvent.setup()
  const { view, findByTestId, findByText } = await createView()
  const opts = [{}, { timeout }] as const

  await view.navToLocString(loc)
  await user.click(await findByTestId(hts(track), ...opts))
  await user.click(await findByTestId('track_menu_icon', ...opts))

  if (displayMode === 'arc') {
    await user.click(await findByText('Read connections'))
    await user.click(await findByText('Paired arcs'))
    await user.click(await findByText('Pointing down'))
  } else {
    await user.click(await findByText('Read connections'))
    await user.click(await findByText('Linked reads'))
    await (displayMode === 'bezier'
      ? user.click(await findByText('Bezier'))
      : user.click(await findByText('Normal')))
  }

  const display = await findByTestId('pileup-display-done', ...opts)
  await new Promise(res => setTimeout(res, 2000))
  expectCanvasMatch(findCanvasIn(display))
}
