import { fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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

export async function testAlignmentModificationsDisplay({
  config,
  canvasTestId,
  timeout = 50000,
}: {
  config: any
  canvasTestId: string
  timeout?: number
}) {
  const opts = [{}, { timeout }] as const
  const { findByTestId } = await createView(config)

  const f1 = within(await findByTestId('Blockset-pileup'))
  const f2 = within(await findByTestId('Blockset-snpcoverage'))

  expectCanvasMatch(await f1.findByTestId(canvasTestId, ...opts))
  expectCanvasMatch(await f2.findByTestId(canvasTestId, ...opts))
}

export async function waitForPileupDraw(view: any, timeout = 60000) {
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
      await user.click((await findAllByText(/Toggle read cloud/))[0]!)
    }
  }

  await waitForPileupDraw(view, timeout)
  if (displayMode !== 'arc') {
    await findByTestId(canvasId, {}, { timeout })
  }
  await new Promise(res => setTimeout(res, 2000))
  expectCanvasMatch(getByTestId(canvasId))
}

export async function testMultiVariantDisplay({
  displayType,
  phasedMode,
  timeout = 60000,
}: {
  displayType: 'matrix' | 'regular'
  phasedMode?: 'phased'
  timeout?: number
}) {
  const delay = { timeout }
  const opts = [{}, delay] as const
  const displayText =
    displayType === 'matrix'
      ? 'Multi-sample variant display (matrix)'
      : 'Multi-sample variant display (regular)'
  const useAll = displayType === 'regular'

  const { view, findByTestId, findAllByText, findByText, findAllByTestId } =
    await createView()
  await view.navToLocString('ctgA')
  fireEvent.click(await findByTestId(hts('volvox_test_vcf'), ...opts))

  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(await findByText(displayText, ...opts))

  if (useAll) {
    await new Promise(res => setTimeout(res, 1000))
  }

  if (phasedMode) {
    if (useAll) {
      await new Promise(res => setTimeout(res, 1000))
    }
    view.tracks[0].displays[0].setPhasedMode('phased')
  }

  if (useAll) {
    fireEvent.click((await findAllByText('Force load', ...opts))[0]!)
    expectCanvasMatch(
      (await findAllByTestId(/prerendered_canvas/, ...opts))[0]!,
    )
  } else {
    fireEvent.click(await findByText('Force load', ...opts))
    expectCanvasMatch(await findByTestId(/prerendered_canvas/, ...opts))
  }
}
