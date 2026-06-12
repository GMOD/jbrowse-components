import { userEvent } from '@testing-library/user-event'

import { createView, expectCanvasMatch, findCanvasIn, hts } from './util.tsx'

type DisplayMode = 'arc' | 'samplot' | 'cloud' | 'bezier' | 'stack'

// Menu path from track menu → submenu → final click, per displayMode.
// 'stack' / 'cloud' enable linked reads via the "View as pairs / link
// supplementary alignments" checkbox.
const MENU_PATHS: Record<DisplayMode, string[]> = {
  arc: ['Read connections', 'Show read arcs'],
  samplot: ['Read connections', 'Show read cloud'],
  bezier: ['Show...', 'Show read links as bezier curves'],
  cloud: ['Read connections', 'View as pairs / link supplementary alignments'],
  stack: ['Read connections', 'View as pairs / link supplementary alignments'],
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
