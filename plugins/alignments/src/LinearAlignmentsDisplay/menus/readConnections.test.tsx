import { isValidElement } from 'react'

import { getReadConnectionsMenuItem } from './readConnections.ts'

import type { DisplayTypeDefaultControl } from '@jbrowse/core/configuration'

// stateful stand-in for a DisplayTypeDefaultControl (the menu builder and the promote
// path only touch active/toggle)
function control(): DisplayTypeDefaultControl {
  return {
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
    pairsDisplayTypeDefault: control(),
    readConnections: 'off' as 'off' | 'arc' | 'cloud',
    setReadConnections(mode: 'off' | 'arc' | 'cloud') {
      this.readConnections = mode
    },
    arcsDisplayTypeDefault: control(),
    readCloudDisplayTypeDefault: control(),
    readConnectionsDown: false,
    setReadConnectionsDown(v: boolean) {
      this.readConnectionsDown = v
    },
    readConnectionsDownDisplayTypeDefault: control(),
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

// A promotable row is a native checkbox item carrying a "default for all"
// endAdornment (a DefaultForAllAdornment element), always present.
function endAdornment(model: ReturnType<typeof makeModel>, label: string) {
  const item = findByLabel(model, label)
  return item && 'endAdornment' in item ? item.endAdornment : undefined
}

// Read the promotable control off a row's "default for all" endAdornment and
// promote it (what clicking the pin does), exercising the menu's promote wiring.
function promoteDefaultForAll(
  model: ReturnType<typeof makeModel>,
  label: string,
) {
  const adornment = endAdornment(model, label)
  if (!isValidElement(adornment)) {
    throw new Error(`no default-for-all control on ${label}`)
  }
  const { control } = adornment.props as { control: { toggle: () => void } }
  control.toggle()
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
    expect(endAdornment(model, pairs)).toBeDefined()
    expect(endAdornment(model, 'Show read arcs')).toBeDefined()
    expect(endAdornment(model, 'Show read cloud')).toBeDefined()
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
