import { exportMargin } from '@jbrowse/core/svg/constants'
import { AXIS_GUTTER_WIDTH_PX } from '@jbrowse/display-ui'
import { axisGutterWidth } from '@jbrowse/display-ui/axisPlacement'
import { types } from '@jbrowse/mobx-state-tree'

import { exportLaidOut, exportMargins } from './pageLayout.ts'

const SCREEN_WIDTH = 800
const EXPORT_WIDTH = 500

function subject() {
  return { node: types.model({}).create(), views: [] }
}

function screenLayout() {
  return { width: () => SCREEN_WIDTH, layOutAt: jest.fn() }
}

function controlledRender() {
  const started = Promise.withResolvers<void>()
  const finished = Promise.withResolvers<string>()
  const render = jest.fn(() => {
    started.resolve()
    return finished.promise
  })
  return {
    render,
    started: started.promise,
    finish: finished.resolve,
    fail: finished.reject,
  }
}

test('aborting a running export rejects it, restores the screen width and lets the next export run', async () => {
  const controller = new AbortController()
  const layout = screenLayout()
  const stuck = controlledRender()
  const first = exportLaidOut(
    subject(),
    { viewWidth: EXPORT_WIDTH, signal: controller.signal },
    layout,
    stuck.render,
  )
  const second = exportLaidOut(subject(), {}, layout, async () => '<svg/>')
  await stuck.started
  controller.abort()

  await expect(first).rejects.toMatchObject({ name: 'AbortError' })
  expect(layout.layOutAt.mock.calls).toEqual([[EXPORT_WIDTH], [SCREEN_WIDTH]])
  await expect(second).resolves.toBe('<svg/>')
})

test('a detached render that fails after its export was aborted raises nothing', async () => {
  const controller = new AbortController()
  const stuck = controlledRender()
  const first = exportLaidOut(
    subject(),
    { signal: controller.signal },
    screenLayout(),
    stuck.render,
  )
  await stuck.started
  controller.abort()
  await expect(first).rejects.toMatchObject({ name: 'AbortError' })
  stuck.fail(new Error('render failed late'))

  await expect(
    exportLaidOut(subject(), {}, screenLayout(), async () => '<svg/>'),
  ).resolves.toBe('<svg/>')
})

test('an export aborted while queued never reads its tracks or renders', async () => {
  const controller = new AbortController()
  const running = controlledRender()
  const first = exportLaidOut(subject(), {}, screenLayout(), running.render)
  const readTracks = jest.fn(() => [])
  const queuedRender = jest.fn(async () => '<svg/>')
  const queued = exportLaidOut(
    {
      node: types.model({}).create(),
      views: [
        {
          get pinnedTracks() {
            return readTracks()
          },
          unpinnedTracks: [],
        },
      ],
    },
    { pageWidth: '183mm', signal: controller.signal },
    screenLayout(),
    queuedRender,
  )
  await running.started
  controller.abort()
  running.finish('<svg/>')

  await expect(first).resolves.toBe('<svg/>')
  await expect(queued).rejects.toMatchObject({ name: 'AbortError' })
  expect(readTracks).not.toHaveBeenCalled()
  expect(queuedRender).not.toHaveBeenCalled()
})

test('an export aborted while it lays out never waits on its render', async () => {
  const controller = new AbortController()
  const stuck = controlledRender()
  const layout = {
    width: () => SCREEN_WIDTH,
    layOutAt: jest.fn(() => {
      controller.abort()
    }),
  }
  const exported = exportLaidOut(
    subject(),
    { viewWidth: EXPORT_WIDTH, signal: controller.signal },
    layout,
    stuck.render,
  )

  await expect(exported).rejects.toMatchObject({ name: 'AbortError' })
  expect(layout.layOutAt.mock.calls).toEqual([[EXPORT_WIDTH], [SCREEN_WIDTH]])
})

function axisDisplay(caption?: string) {
  const axis = {
    domain: [0, 1_000_000] as [number, number],
    scaleType: 'linear' as const,
    height: 40,
    ticks: {
      items: [{ value: 1_000_000, y: 0, label: '1,000,000' }],
      yTop: 0,
      yBottom: 40,
    },
    bandTops: [0],
    caption,
  }
  return { height: 40, axes: [axis], gutter: axisGutterWidth(axis) }
}

test('a page export keeps a left margin for a y axis only where no label gutter holds it', () => {
  const displays = [axisDisplay()]
  expect(exportMargins(displays, true).left).toBe(AXIS_GUTTER_WIDTH_PX)
  expect(exportMargins(displays, true, 30).left).toBe(AXIS_GUTTER_WIDTH_PX - 30)
  expect(exportMargins(displays, true, 120)).toEqual({
    left: 8,
    right: 8,
    bottom: 8,
  })
  expect(exportMargins([{ height: 40 }], true).left).toBe(8)
})

test('an export sized in px keeps its margin on every side, widened for a captioned axis no gutter holds', () => {
  expect(exportMargins([axisDisplay()], false, 120)).toEqual({
    left: exportMargin,
    right: exportMargin,
    bottom: exportMargin,
  })
  const captioned = axisDisplay('depth')
  expect(captioned.gutter).toBeGreaterThan(exportMargin)
  expect(exportMargins([captioned], false).left).toBe(captioned.gutter)
})
