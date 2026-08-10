import { fireEvent } from '@testing-library/react'

import {
  createView,
  expectCanvasMatch,
  findCanvasIn,
  findSettledDisplay,
  hts,
  volvoxConfigWithTracks,
} from './util.tsx'

type DisplayMode = 'arc' | 'cloud' | 'bezier' | 'linked' | 'stack'

// Menu path from track menu → submenu → final click, per displayMode.
// 'arc' / 'cloud' / 'bezier' pick how read connections are drawn; 'linked' and
// 'stack' instead enable linked reads via the "View as pairs / link
// supplementary alignments" checkbox, and differ only in the caller's snapshot.
const MENU_PATHS: Record<DisplayMode, string[]> = {
  arc: ['Read connections', 'Show read arcs'],
  cloud: ['Read connections', 'Show read cloud'],
  bezier: ['Read connections', 'Use curved connectors'],
  linked: ['Read connections', 'View as pairs / link supplementary alignments'],
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
  const { view, findByTestId, findAllByTestId, findByText } = await createView(
    volvoxConfigWithTracks([track]),
  )
  const opts = [{}, { timeout }] as const

  await view.navToLocString(loc)
  fireEvent.click(await findByTestId(hts(track), ...opts))
  fireEvent.click(await findByTestId('track_menu_icon', ...opts))

  for (const label of MENU_PATHS[displayMode]) {
    fireEvent.click(await findByText(label))
  }

  const display = await findSettledDisplay('pileup-display', { timeout })
  expectCanvasMatch(findCanvasIn(display))

  // Bezier connections render in an SVG overlay, not the canvas, so the snapshot
  // above can't see them — assert the overlay actually drew arc paths.
  if (displayMode === 'bezier') {
    expect(
      (await findAllByTestId('pileup-bezier-arc', ...opts)).length,
    ).toBeGreaterThan(0)
  }
}
