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
  displayMode: 'arc' | 'cloud' | 'stack'
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
    await user.click(await findByText('Arcs...'))
    await user.click(await findByText('Paired arcs'))
    await user.click(await findByText('Pointing up'))
  } else {
    // cloud and stack modes use linked reads
    await user.click(await findByText('Show...'))
    await user.click(await findByText('Show paired/supplementary reads as linked'))
  }

  const display = await findByTestId('pileup-display-done', ...opts)
  await new Promise(res => setTimeout(res, 2000))
  expectCanvasMatch(findCanvasIn(display))
}
