import {
  getArcDirectionMenuItem,
  getReadConnectionsMenuItem,
  getSashimiArcsMenuItem,
} from './readConnections.ts'

import type { MenuItem } from '@jbrowse/core/ui'

function clickByLabel(items: MenuItem[], label: string) {
  const item = items.find(i => 'label' in i && i.label === label)
  if (!item || !('onClick' in item)) {
    throw new Error(`no clickable menu item labeled "${label}"`)
  }
  item.onClick()
}

function makeReadConnectionsModel() {
  return {
    linkedReads: 'off' as 'off' | 'normal' | 'bezier',
    setLinkedReads(mode: 'off' | 'normal' | 'bezier') {
      this.linkedReads = mode
    },
    readConnections: 'off' as 'off' | 'arc' | 'samplot',
    setReadConnections(mode: 'off' | 'arc' | 'samplot') {
      this.readConnections = mode
    },
    drawLongRange: true,
    setDrawLongRange(v: boolean) {
      this.drawLongRange = v
    },
    drawInter: true,
    setDrawInter(v: boolean) {
      this.drawInter = v
    },
  }
}

describe('read connections menu', () => {
  // Regression: arc mode was once unreachable from the menu (the picker wrote a
  // different field), so read-connection arcs never rendered.
  test('"Arcs" enables arc mode', () => {
    const model = makeReadConnectionsModel()
    clickByLabel(getReadConnectionsMenuItem(model).subMenu, 'Arcs')
    expect(model.readConnections).toBe('arc')
  })

  test('"Read cloud" enables samplot mode', () => {
    const model = makeReadConnectionsModel()
    clickByLabel(getReadConnectionsMenuItem(model).subMenu, 'Read cloud')
    expect(model.readConnections).toBe('samplot')
  })

  test('pair filters are hidden until a mode is on', () => {
    const model = makeReadConnectionsModel()
    const labels = (m: typeof model) =>
      getReadConnectionsMenuItem(m)
        .subMenu.filter(i => 'label' in i)
        .map(i => ('label' in i ? i.label : undefined))

    expect(labels(model)).not.toContain('Show long-range pairs')
    model.readConnections = 'arc'
    expect(labels(model)).toContain('Show long-range pairs')
  })
})

// The coupling these used to assert (sashimi force-enables coverage, direction
// stays in sync) now lives in the model actions — see model.coupling.test.ts.
// Here we only check that the menu items delegate to the right action.
describe('sashimi arcs menu', () => {
  test('checkbox reflects on/off and delegates to toggleSashimiArcs', () => {
    let toggled = false
    const model = {
      sashimiArcs: 'off' as 'off' | 'up' | 'down',
      toggleSashimiArcs() {
        toggled = true
      },
    }
    const item = getSashimiArcsMenuItem(model)
    expect(item.checked).toBe(false)
    item.onClick()
    expect(toggled).toBe(true)
  })
})

describe('shared arc direction toggle', () => {
  function makeDirectionModel() {
    return {
      readConnections: 'arc' as 'off' | 'arc' | 'samplot',
      readConnectionsDown: false,
      setReadConnectionsDown(v: boolean) {
        this.readConnectionsDown = v
      },
      sashimiArcs: 'up' as 'off' | 'up' | 'down',
    }
  }

  test('delegates to setReadConnectionsDown with the flipped value', () => {
    const model = makeDirectionModel()
    getArcDirectionMenuItem(model).onClick()
    expect(model.readConnectionsDown).toBe(true)
  })

  test('disabled when no arcs are on', () => {
    const model = makeDirectionModel()
    model.readConnections = 'off'
    model.sashimiArcs = 'off'
    expect(getArcDirectionMenuItem(model).disabled).toBe(true)
  })
})
