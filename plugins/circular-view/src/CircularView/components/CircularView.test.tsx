import PluginManager from '@jbrowse/core/PluginManager'
import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material/styles'
import { fireEvent, render } from '@testing-library/react'

import stateModelFactory from '../model.ts'
import CircularView from './CircularView.tsx'

import type { CircularViewModel } from '../model.ts'

// where the middle of the circle sits in client coordinates. jsdom reports an
// all-zero bounding rect, so this is the figure's own offset, and it moves as
// soon as anything zooms
function centerOf(view: CircularViewModel) {
  const [originX, originY] = view.figureOriginXY
  const [cx, cy] = view.centerXY
  return { x: originX + cx, y: originY + cy }
}

// the smallest tree the view renders in: getSession wants a parent carrying
// rpcManager + configuration, and the ruler asks the assembly for a refName
// color. No tracks, so the figure is the ideogram alone
function setup() {
  const pluginManager = new PluginManager()
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const Session = types
    .model('Session', {
      view: stateModelFactory(pluginManager),
    })
    .volatile(() => ({
      rpcManager: {},
      configuration: {},
      assemblyManager: {
        get: () => ({
          initialized: true,
          getRefNameColor: () => undefined,
        }),
      },
    }))
  const { view } = Session.create({
    view: { type: 'CircularView' },
  }) as unknown as { view: CircularViewModel }
  view.setWidth(800)
  view.setHeight(400)
  view.setDisplayedRegions([
    { assemblyName: 'test', refName: 'chr1', start: 0, end: 1_000_000 },
  ])
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <CircularView model={view} />
    </ThemeProvider>,
  )
  return {
    view,
    root: container.querySelector('div')!,
    svg: container.querySelector('svg')!,
  }
}

// A press under the drag threshold deliberately never captures the pointer, so
// that the chords underneath still get their click. Released anywhere but on
// this <svg> — the controls overlay on top of the figure, outside the window —
// no pointerup arrives, and the press used to stay latched: the next plain
// hover passed the threshold and spun the figure with no button held
test('a press released off the figure does not latch the rotation', () => {
  const { view, svg } = setup()
  const center = centerOf(view)
  const before = view.offsetRadians

  fireEvent.pointerDown(svg, {
    clientX: center.x + 50,
    clientY: center.y,
    buttons: 1,
  })
  // the release happened somewhere this <svg> never hears about; all it sees is
  // a later hover
  fireEvent.pointerMove(svg, {
    clientX: center.x,
    clientY: center.y + 50,
    buttons: 0,
  })
  expect(view.offsetRadians).toBe(before)

  // and the stale press is gone, rather than waiting to fire on the next move
  fireEvent.pointerMove(svg, {
    clientX: center.x - 50,
    clientY: center.y,
    buttons: 1,
  })
  expect(view.offsetRadians).toBe(before)
})

test('a held drag rotates the figure by the angle it travelled', () => {
  const { view, svg } = setup()
  const center = centerOf(view)
  const before = view.offsetRadians

  fireEvent.pointerDown(svg, {
    clientX: center.x + 50,
    clientY: center.y,
    buttons: 1,
  })
  fireEvent.pointerMove(svg, {
    clientX: center.x,
    clientY: center.y + 50,
    buttons: 1,
  })
  expect(view.offsetRadians - before).toBeCloseTo(Math.PI / 2)
})

// The wheel handler accumulates and writes the model once per animation frame,
// so nothing lands until the frame runs. A queue the test owns, drained after
// the whole burst, is the only way to see both halves: what the model ends up
// at, and how many frames it took to get there.
function wheelAt(
  view: CircularViewModel,
  root: Element,
  events: { deltaX: number; deltaY: number; deltaMode?: number }[],
) {
  const frames: FrameRequestCallback[] = []
  const raf = jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation(cb => frames.push(cb))
  const center = centerOf(view)
  for (const event of events) {
    fireEvent.wheel(root, { ...event, clientX: center.x, clientY: center.y })
  }
  raf.mockRestore()
  for (const frame of frames) {
    frame(0)
  }
  return frames.length
}

// a trackpad's horizontal swipe carries a little vertical noise and vice versa,
// so running both arms of the wheel handler meant every rotation gesture also
// crept the zoom
test('a wheel gesture either rotates or zooms, not both', () => {
  const { view, root } = setup()

  const beforeRadians = view.offsetRadians
  const beforeBpPerPx = view.bpPerPx
  wheelAt(view, root, [{ deltaX: 100, deltaY: 1 }])
  expect(view.offsetRadians).not.toBe(beforeRadians)
  expect(view.bpPerPx).toBe(beforeBpPerPx)

  const afterRotate = view.offsetRadians
  wheelAt(view, root, [{ deltaX: 1, deltaY: 100 }])
  expect(view.offsetRadians).toBe(afterRotate)
  expect(view.bpPerPx).not.toBe(beforeBpPerPx)
})

// `deltaY` is only pixels when `deltaMode` says so. Firefox reports whole LINES
// for a mouse wheel (mode 1, deltaY ±3) where Chrome reports pixels (mode 0,
// deltaY ±100), so the raw number zoomed a Firefox notch 0.3% against Chrome's
// 10% — a wheel that visibly did nothing.
test.each([
  ['zoom', { deltaX: 0, deltaY: 3, deltaMode: 1 }, 'bpPerPx'],
  ['rotation', { deltaX: 3, deltaY: 0, deltaMode: 1 }, 'offsetRadians'],
] as const)('a line-mode wheel %s is a whole notch', (_name, event, key) => {
  const { view, root } = setup()
  const before = view[key]
  wheelAt(view, root, [event])
  // 3 lines is 120px, so within a hair of Chrome's 100px notch rather than
  // within a hair of nothing
  expect(Math.abs(view[key] / before - 1)).toBeGreaterThan(0.05)
})

// One model write per frame, not per event: a trackpad burst is dozens of
// events between paints, and each write re-lays every slice and redraws every
// chord. Summed deltas zoom by exactly what applying each in turn would have,
// since exp is multiplicative.
test('a burst of wheel events collapses into one zoom', () => {
  const { view: burst, root: burstRoot } = setup()
  const { view: single, root: singleRoot } = setup()

  const frames = wheelAt(burst, burstRoot, [
    { deltaX: 0, deltaY: 40 },
    { deltaX: 0, deltaY: 40 },
    { deltaX: 0, deltaY: 40 },
  ])
  wheelAt(single, singleRoot, [{ deltaX: 0, deltaY: 120 }])

  expect(frames).toBe(1)
  expect(burst.bpPerPx).toBeCloseTo(single.bpPerPx)
})

// The move handler waves through anything with a button held, so a press it
// never should have latched spins the figure — here under the context menu the
// same click opens.
test('a right-button drag does not rotate the figure', () => {
  const { view, svg } = setup()
  const center = centerOf(view)
  const before = view.offsetRadians

  fireEvent.pointerDown(svg, {
    clientX: center.x + 50,
    clientY: center.y,
    button: 2,
    buttons: 2,
  })
  fireEvent.pointerMove(svg, {
    clientX: center.x,
    clientY: center.y + 50,
    buttons: 2,
  })
  expect(view.offsetRadians).toBe(before)
})
