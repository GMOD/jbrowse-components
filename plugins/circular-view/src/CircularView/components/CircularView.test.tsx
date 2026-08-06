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

// a trackpad's horizontal swipe carries a little vertical noise and vice versa,
// so running both arms of the wheel handler meant every rotation gesture also
// crept the zoom
test('a wheel gesture either rotates or zooms, not both', () => {
  const { view, root } = setup()
  const wheelAt = (deltaX: number, deltaY: number) => {
    const center = centerOf(view)
    fireEvent.wheel(root, {
      deltaX,
      deltaY,
      clientX: center.x,
      clientY: center.y,
    })
  }

  const beforeRadians = view.offsetRadians
  const beforeBpPerPx = view.bpPerPx
  wheelAt(100, 1)
  expect(view.offsetRadians).not.toBe(beforeRadians)
  expect(view.bpPerPx).toBe(beforeBpPerPx)

  const afterRotate = view.offsetRadians
  wheelAt(1, 100)
  expect(view.offsetRadians).toBe(afterRotate)
  expect(view.bpPerPx).not.toBe(beforeBpPerPx)
})
