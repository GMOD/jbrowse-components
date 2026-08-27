import { createJBrowseTheme } from '@jbrowse/core/ui'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { getSession } from '@jbrowse/core/util'

import { bootAlignmentsDisplay } from './testUtils.ts'

// The track-menu sort anchors on the base under the center line. `pxToBp`
// answers with `offset`, a bp count INTO the region, while `sortedBy.pos` is
// compared against absolute genomic `readPositions` in the worker. The two
// coincide only on a region starting at 0 and drawn forward — which is what
// `navToLocString` builds, and why this survived. Every region here therefore
// starts somewhere else.
function createDisplay({
  start,
  end,
  reversed = false,
}: {
  start: number
  end: number
  reversed?: boolean
}) {
  console.warn = jest.fn()
  const { baseSession, mount } = bootAlignmentsDisplay()
  const Session = baseSession.volatile(() => ({
    rpcManager: { call: jest.fn() },
    theme: createJBrowseTheme(),
    palette: resolvePalette(),
    assemblyManager: {
      get: (name: string) =>
        name === 'volvox'
          ? {
              initialized: true,
              getCanonicalRefName2: (refName: string) => refName,
              configuration: { sequence: undefined },
            }
          : undefined,
    },
    notify: jest.fn(),
    notifyError: jest.fn(),
  }))
  const { view, display } = mount(Session)
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', refName: 'ctgA', start, end, reversed },
  ])
  // one bp per px, so the center line sits 400bp into the region
  view.setNewView(1, 0)
  return { display, view }
}

test('the sort anchors at an absolute genomic coordinate', () => {
  const { display, view } = createDisplay({ start: 1000, end: 2000 })

  display.setSortedBy('basePair')

  expect(view.centerLineInfo!.offset).toBeCloseTo(400)
  expect(display.sortedBy?.pos).toBe(1400)
})

// A flip keeps the region's bounds and reverses only the drawing, so `offset`
// is unchanged while the base actually under the center line is mirrored.
// Anchoring on the offset sorted the opposite column.
test('a reversed region anchors on the base drawn under the center line', () => {
  const { display } = createDisplay({
    start: 1000,
    end: 2000,
    reversed: true,
  })

  display.setSortedBy('basePair')

  expect(display.sortedBy?.pos).toBe(1599)
})

test('a region starting at zero is unaffected', () => {
  const { display } = createDisplay({ start: 0, end: 50_000 })

  display.setSortedBy('basePair')

  expect(display.sortedBy?.pos).toBe(400)
})

// `setSortSlot` drops the layout-order flags, since a sort and those flags are
// peer radios. The old no-center-line fallback wrote `{pos: -1, refName: ''}`
// AFTER that drop — a slot no layout can use (`sortForRegions` matches no
// region named '', and nothing ranks at -1), so picking a strand sort out of
// range threw away an active ordering and replaced it with nothing.
test('a sort with no center line warns and leaves the ordering alone', () => {
  const { display, view } = createDisplay({ start: 1000, end: 2000 })
  display.setLargeFeaturesFirst(true)
  view.setDisplayedRegions([])

  display.setSortedBy('strand')

  expect(display.sortedBy).toBeUndefined()
  expect(display.largeFeaturesFirst).toBe(true)
  expect(getSession(display).notify).toHaveBeenCalledWith(
    expect.stringContaining('Cannot sort'),
    'warning',
  )
})
