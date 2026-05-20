import { userEvent } from '@testing-library/user-event'

import { createView, expectCanvasMatch, findCanvasIn, hts } from './util.tsx'

type DisplayMode = 'arc' | 'samplot' | 'cloud' | 'bezier' | 'stack'

// Menu path from track menu → submenu → final click, per displayMode.
// 'stack' / 'cloud' default to plain "Linked reads → Normal".
const MENU_PATHS: Record<DisplayMode, string[]> = {
  arc: ['Read connections', 'Paired arcs', 'Pointing down'],
  samplot: ['Read connections', 'Paired arcs', 'Samplot (discordant only)'],
  bezier: ['Read connections', 'Linked reads', 'Bezier'],
  cloud: ['Read connections', 'Linked reads', 'Normal'],
  stack: ['Read connections', 'Linked reads', 'Normal'],
}

export async function testLinkedReadsDisplay({
  loc,
  track,
  displayMode,
  timeout = 60000,
}: {
  loc: string
  track: string
  displayMode: DisplayMode
  canvasId?: string
  timeout?: number
}) {
  const user = userEvent.setup()
  const { view, findByTestId, findByText } = await createView()
  const opts = [{}, { timeout }] as const

  await view.navToLocString(loc)
  await user.click(await findByTestId(hts(track), ...opts))
  await user.click(await findByTestId('track_menu_icon', ...opts))

  for (const label of MENU_PATHS[displayMode]) {
    await user.click(await findByText(label))
  }

  const display = await findByTestId('pileup-display-done', ...opts)
  await new Promise(res => setTimeout(res, 2000))
  expectCanvasMatch(findCanvasIn(display))
}
