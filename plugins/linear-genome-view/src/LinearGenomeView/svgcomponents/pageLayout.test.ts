import { types } from '@jbrowse/mobx-state-tree'

import { exportLaidOut } from './pageLayout.ts'

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
