import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'
import { fireEvent, render, screen } from '@testing-library/react'

import { DEFAULT_MIN_INTERCHROM_SUPPORT } from '../constants.ts'
import { getReadConnectionsMenuItem } from './readConnections.ts'

import type { GroupBy } from '../../shared/types.ts'

function makeModel() {
  return {
    linkedReads: 'off' as 'off' | 'normal',
    setLinkedReads(mode: 'off' | 'normal') {
      this.linkedReads = mode
    },
    readConnections: 'off' as 'off' | 'arc' | 'cloud',
    setReadConnections(mode?: 'off' | 'arc' | 'cloud') {
      this.readConnections = mode ?? 'off'
    },
    readConnectionsDown: false,
    setReadConnectionsDown(v: boolean) {
      this.readConnectionsDown = v
    },
    drawLongRange: true,
    setDrawLongRange(v: boolean) {
      this.drawLongRange = v
    },
    drawInter: true,
    setDrawInter(v: boolean) {
      this.drawInter = v
    },
    showBezierConnections: false,
    setShowBezierConnections(v: boolean) {
      this.showBezierConnections = v
    },
    debugArcGeometry: false,
    setDebugArcGeometry(v: boolean) {
      this.debugArcGeometry = v
    },
    drawProperPairArcs: true,
    setDrawProperPairArcs(v: boolean) {
      this.drawProperPairArcs = v
    },
    minInterchromSupport: DEFAULT_MIN_INTERCHROM_SUPPORT,
    setMinInterchromSupport(v: number) {
      this.minInterchromSupport = v
    },
    readConnectionsLineWidth: 1,
    setReadConnectionsLineWidth(v: number) {
      this.readConnectionsLineWidth = v
    },
    // The SV-channel row is served from this menu, so its two settings from
    // outside it are on the mock as well.
    showPileup: true,
    setShowPileup(v: boolean) {
      this.showPileup = v
    },
    groupBy: undefined as GroupBy | undefined,
    setGroupBy(v?: GroupBy) {
      this.groupBy = v
    },
  }
}

function findByLabel(model: ReturnType<typeof makeModel>, label: string) {
  const items = resolveSubMenu(getReadConnectionsMenuItem(model))
  return (
    items.find(i => 'label' in i && i.label === label) ??
    items
      .flatMap(i => ('subMenu' in i ? resolveSubMenu(i) : []))
      .find(i => 'label' in i && i.label === label)
  )
}

function bandOptionsSubMenu(model: ReturnType<typeof makeModel>) {
  const item = resolveSubMenu(getReadConnectionsMenuItem(model)).find(
    i => 'label' in i && i.label === 'Arc / read cloud band options',
  )
  if (!item || !('subMenu' in item)) {
    throw new Error('no band options submenu')
  }
  return item
}

function checkboxByLabel(model: ReturnType<typeof makeModel>, label: string) {
  const item = findByLabel(model, label)
  if (!item || !('checked' in item) || !('onClick' in item)) {
    throw new Error(`no ${label} checkbox`)
  }
  return item
}

describe('read connections menu', () => {
  test('"View as pairs" row toggles linkedReads on/off', () => {
    const model = makeModel()
    const label = 'View as pairs / link supplementary alignments'
    checkboxByLabel(model, label).onClick()
    expect(model.linkedReads).toBe('normal')
    checkboxByLabel(model, label).onClick()
    expect(model.linkedReads).toBe('off')
  })

  // The overlay is one radio over the slot: arcs and the read cloud share a
  // band, so they were mutually exclusive checkboxes, and a radio says so.
  test('the "Connection overlay" radio selects the mode, None included', () => {
    const model = makeModel()
    for (const [label, mode] of [
      ['Read arcs', 'arc'],
      ['Read cloud', 'cloud'],
      ['None', 'off'],
    ] as const) {
      checkboxByLabel(model, label).onClick()
      expect(model.readConnections).toBe(mode)
    }
  })

  test('exactly one overlay row is checked, reflecting readConnections', () => {
    const model = makeModel()
    const checked = () =>
      (['None', 'Read arcs', 'Read cloud'] as const).filter(
        label => checkboxByLabel(model, label).checked,
      )
    expect(checked()).toEqual(['None'])
    model.readConnections = 'arc'
    expect(checked()).toEqual(['Read arcs'])
    model.readConnections = 'cloud'
    expect(checked()).toEqual(['Read cloud'])
  })

  // WHERE it is, not just that it exists. svChannels.test.ts calls the builder
  // directly and the spec-recipe test asserts against arrangements.ts's own
  // hardcoded path string, so between them the row could return to nowhere with
  // three published docs still sending readers here for it —
  // `check-menu-labels` gates each segment as a string somewhere in plugins/,
  // never the nesting.
  test('the SV-channel row is a direct child of this submenu', () => {
    const model = makeModel()
    const labels = resolveSubMenu(getReadConnectionsMenuItem(model)).map(i =>
      'label' in i ? i.label : undefined,
    )
    expect(labels).toContain('SV channels (pairs by orientation)')
  })
})

describe('read-connection band options submenu is disabled until an overlay is active', () => {
  test('disabled with a help tooltip when no overlay is active', () => {
    const model = makeModel()
    const submenu = bandOptionsSubMenu(model)
    expect(submenu.disabled).toBe(true)
    expect(submenu.disabledHelpText).toBeTruthy()
    // items stay defined (discoverable) even while the submenu is disabled
    expect(findByLabel(model, 'Draw arcs below coverage band')).toBeDefined()
    expect(findByLabel(model, 'Show off-screen mate connections')).toBeDefined()
  })

  test('enabled and functional when arcs are on', () => {
    const model = makeModel()
    model.readConnections = 'arc'
    expect(bandOptionsSubMenu(model).disabled).toBe(false)
    checkboxByLabel(model, 'Draw arcs below coverage band').onClick()
    expect(model.readConnectionsDown).toBe(true)
  })
})

// Turning arcs on, then long-range, then inter-chromosomal is one workflow, so
// no row here may dismiss the menu.
test('every toggle keeps the menu open', () => {
  const model = makeModel()
  const rows = resolveSubMenu(getReadConnectionsMenuItem(model)).flatMap(i =>
    'subMenu' in i ? resolveSubMenu(i) : [i],
  )
  const toggles = rows.filter(i => 'checked' in i)
  expect(toggles.length).toBeGreaterThan(0)
  expect(toggles.every(i => staysOpenOnClick(i))).toBe(true)
})

// The `readConnectionsLineWidth` slot had a setter and no way to reach it: every
// renderer and the SVG export read the width, and nothing in the UI wrote one.
describe('arc line width row', () => {
  function lineWidthRow(model: ReturnType<typeof makeModel>) {
    const row = resolveSubMenu(bandOptionsSubMenu(model)).find(
      i => 'label' in i && i.label === 'Line width',
    )
    if (row?.type !== 'custom') {
      throw new Error('no line width slider row')
    }
    return row
  }

  // `findBy*`, not `getBy*`: makeSizeMenu draws the row through `lazy()`, so the
  // first paint is its Suspense fallback.
  test('the slider writes the width the renderers read', async () => {
    const model = makeModel()
    model.readConnections = 'arc'
    render(<>{lineWidthRow(model).render(() => {})}</>)

    const input = (
      await screen.findByTestId('arc-line-width-slider')
    ).querySelector('input')!
    fireEvent.change(input, { target: { value: 3 } })

    expect(model.readConnectionsLineWidth).toBe(3)
  })

  test('the row lives with the other band options, so it is gated with them', () => {
    const model = makeModel()
    expect(bandOptionsSubMenu(model).disabled).toBe(true)
    expect(lineWidthRow(model)).toBeDefined()
  })
})

// A diagnostic overlay, so the row is not offered in a shipped build. The
// setting survives — a snapshot carrying it still draws in a dev build — only
// the way to reach it from the track menu goes.
describe('the debug arc-geometry row is development-only', () => {
  const { NODE_ENV } = process.env

  afterEach(() => {
    process.env.NODE_ENV = NODE_ENV
  })

  function hasDebugRow(model: ReturnType<typeof makeModel>) {
    return resolveSubMenu(bandOptionsSubMenu(model)).some(
      i => 'label' in i && i.label === 'Debug: show arc geometry',
    )
  }

  test('present outside production', () => {
    expect(hasDebugRow(makeModel())).toBe(true)
  })

  test('absent in a production build', () => {
    process.env.NODE_ENV = 'production'
    expect(hasDebugRow(makeModel())).toBe(false)
  })
})
