import { staysOpenOnClick } from '@jbrowse/core/ui'

import { DEFAULT_MIN_INTERCHROM_SUPPORT } from '../constants.ts'
import { getReadConnectionsMenuItem } from './readConnections.ts'

import type { GroupBy } from '../../shared/types.ts'
import type { Pin } from '@jbrowse/core/configuration'

// stateful stand-in for a Pin (the menu builder and the promote
// path only touch active/toggle; `slot` is what a built menu is later asked for
// by promotableSlotsWithoutPin, and `onValue` what PinAdornment words itself
// from — neither is read here)
function control(slot: string, onValue: unknown = false): Pin {
  return {
    slot,
    onValue,
    active: false,
    toggle() {
      this.active = !this.active
    },
  }
}

function makeModel() {
  return {
    linkedReads: 'off' as 'off' | 'normal',
    setLinkedReads(mode: 'off' | 'normal') {
      this.linkedReads = mode
    },
    pairsDisplayTypeDefault: control('linkedReads'),
    readConnections: 'off' as 'off' | 'arc' | 'cloud',
    // Unset resolves to 'off', as the promotable sentinel's getter does — the
    // setter is the only side that can say undefined.
    setReadConnections(mode?: 'off' | 'arc' | 'cloud') {
      this.readConnections = mode ?? 'off'
    },
    arcsDisplayTypeDefault: control('readConnections'),
    readCloudDisplayTypeDefault: control('readConnections'),
    readConnectionsDown: false,
    setReadConnectionsDown(v: boolean) {
      this.readConnectionsDown = v
    },
    readConnectionsDownDisplayTypeDefault: control('readConnectionsDown'),
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
  const items = getReadConnectionsMenuItem(model).subMenu
  return (
    items.find(i => 'label' in i && i.label === label) ??
    items
      .filter((i): i is typeof i & { subMenu: typeof items } => 'subMenu' in i)
      .flatMap(i => i.subMenu)
      .find(i => 'label' in i && i.label === label)
  )
}

function bandOptionsSubMenu(model: ReturnType<typeof makeModel>) {
  const item = getReadConnectionsMenuItem(model).subMenu.find(
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

// A promotable row is a native checkbox item carrying a "default for all" pin,
// always present. It is a description (`{ ...pin, label }`) rather than a
// rendered element — see ui/MenuTypes.ts — so the control is read straight off
// the row instead of out of a React element's props.
function pinOfRow(model: ReturnType<typeof makeModel>, label: string) {
  const item = findByLabel(model, label)
  return item && 'pin' in item ? item.pin : undefined
}

// Promote a row's value (what clicking its pin does), exercising the menu's
// promote wiring.
function promoteDefaultForAll(
  model: ReturnType<typeof makeModel>,
  label: string,
) {
  const pin = pinOfRow(model, label)
  if (!pin) {
    throw new Error(`no default-for-all control on ${label}`)
  }
  pin.control.toggle()
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

  test('"Show read arcs" row toggles arc mode on/off', () => {
    const model = makeModel()
    checkboxByLabel(model, 'Show read arcs').onClick()
    expect(model.readConnections).toBe('arc')
    checkboxByLabel(model, 'Show read arcs').onClick()
    expect(model.readConnections).toBe('off')
  })

  test('"Show read cloud" row toggles read cloud mode on/off', () => {
    const model = makeModel()
    checkboxByLabel(model, 'Show read cloud').onClick()
    expect(model.readConnections).toBe('cloud')
    checkboxByLabel(model, 'Show read cloud').onClick()
    expect(model.readConnections).toBe('off')
  })

  test('arcs and read cloud are mutually exclusive', () => {
    const model = makeModel()
    checkboxByLabel(model, 'Show read arcs').onClick()
    expect(model.readConnections).toBe('arc')
    // enabling read cloud while arcs are on switches mode (turns arcs off)
    checkboxByLabel(model, 'Show read cloud').onClick()
    expect(model.readConnections).toBe('cloud')
    expect(checkboxByLabel(model, 'Show read arcs').checked).toBe(false)
  })

  test('row checked state reflects readConnections', () => {
    const model = makeModel()
    expect(checkboxByLabel(model, 'Show read arcs').checked).toBe(false)
    expect(checkboxByLabel(model, 'Show read cloud').checked).toBe(false)
    model.readConnections = 'arc'
    expect(checkboxByLabel(model, 'Show read arcs').checked).toBe(true)
  })

  // WHERE it is, not just that it exists. svChannels.test.ts calls the builder
  // directly and the spec-recipe test asserts against arrangements.ts's own
  // hardcoded path string, so between them the row could return to nowhere with
  // three published docs still sending readers here for it —
  // `check-menu-labels` gates each segment as a string somewhere in plugins/,
  // never the nesting.
  test('the SV-channel row is a direct child of this submenu', () => {
    const model = makeModel()
    const labels = getReadConnectionsMenuItem(model).subMenu.map(i =>
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

describe('promote-as-default (default for all) pin', () => {
  const pairs = 'View as pairs / link supplementary alignments'

  test('the pin is always shown, even while the mode is off', () => {
    const model = makeModel()
    expect(pinOfRow(model, pairs)).toBeDefined()
    expect(pinOfRow(model, 'Show read arcs')).toBeDefined()
    expect(pinOfRow(model, 'Show read cloud')).toBeDefined()
  })

  test('the pin toggles the view-as-pairs session default', () => {
    const model = makeModel()
    promoteDefaultForAll(model, pairs)
    expect(model.pairsDisplayTypeDefault.active).toBe(true)
  })

  test('arcs and read cloud pins toggle independent session defaults', () => {
    const model = makeModel()
    promoteDefaultForAll(model, 'Show read arcs')
    expect(model.arcsDisplayTypeDefault.active).toBe(true)
    expect(model.readCloudDisplayTypeDefault.active).toBe(false)
  })

  test('"Draw arcs below coverage band" also carries a pin, even while disabled', () => {
    const model = makeModel()
    promoteDefaultForAll(model, 'Draw arcs below coverage band')
    expect(model.readConnectionsDownDisplayTypeDefault.active).toBe(true)
  })
})

// Turning arcs on, then long-range, then inter-chromosomal is one workflow, so
// no row here may dismiss the menu.
test('every toggle keeps the menu open', () => {
  const model = makeModel()
  const rows = getReadConnectionsMenuItem(model).subMenu.flatMap(i =>
    'subMenu' in i ? i.subMenu : [i],
  )
  const toggles = rows.filter(i => 'checked' in i)
  expect(toggles.length).toBeGreaterThan(0)
  expect(toggles.every(i => staysOpenOnClick(i))).toBe(true)
})
