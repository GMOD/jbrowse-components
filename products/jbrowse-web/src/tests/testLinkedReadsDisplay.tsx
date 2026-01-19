import { waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { createView, expectCanvasMatch, hts } from './util.tsx'

async function waitForPileupDraw(view: any, timeout = 60000) {
  await waitFor(
    () => {
      expect(view.tracks[0]?.displays[0]?.PileupDisplay?.drawn).toBe(true)
    },
    { timeout },
  )
}

export async function testLinkedReadsDisplay({
  loc,
  track,
  displayMode,
  canvasId,
  timeout = 60000,
}: {
  loc: string
  track: string
  displayMode: 'arc' | 'cloud' | 'stack'
  canvasId: string
  timeout?: number
}) {
  const user = userEvent.setup()
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  const opts = [{}, { timeout }] as const

  await view.navToLocString(loc)
  await user.click(await findByTestId(hts(track), ...opts))
  await user.click(await findByTestId('track_menu_icon', ...opts))
  await user.click(await findByText('Replace lower panel with...'))

  if (displayMode === 'arc') {
    await user.click((await findAllByText('Read arc display'))[0]!)
  } else {
    await user.click((await findAllByText('Linked reads display'))[0]!)
    if (displayMode === 'cloud') {
      await user.click(await findByTestId('track_menu_icon', ...opts))
      await user.click(await findByText('Pileup settings'))
      await user.click((await findAllByText(/Show.../))[0]!)
      await user.click((await findAllByText(/Show as 'read cloud'/))[0]!)
    }
  }

  await waitForPileupDraw(view, timeout)
  if (displayMode !== 'arc') {
    await findByTestId(canvasId, {}, { timeout })
  }
  await new Promise(res => setTimeout(res, 2000))
  expectCanvasMatch(getByTestId(canvasId))
}
