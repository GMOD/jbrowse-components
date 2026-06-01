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

describe('sashimi arcs menu', () => {
  function makeSashimiModel() {
    return {
      sashimiArcs: 'off' as 'off' | 'up' | 'down',
      setSashimiArcs(mode: 'off' | 'up' | 'down') {
        this.sashimiArcs = mode
      },
      readConnectionsDown: false,
      showCoverage: false,
      setShowCoverage(v: boolean) {
        this.showCoverage = v
      },
    }
  }

  // Sashimi only draws over the coverage band, so enabling it must enable
  // coverage or the toggle silently does nothing.
  test('turning on sashimi also turns on coverage', () => {
    const model = makeSashimiModel()
    getSashimiArcsMenuItem(model).onClick()
    expect(model.sashimiArcs).toBe('up')
    expect(model.showCoverage).toBe(true)
  })

  test('direction follows the below-coverage flag', () => {
    const model = makeSashimiModel()
    model.readConnectionsDown = true
    getSashimiArcsMenuItem(model).onClick()
    expect(model.sashimiArcs).toBe('down')
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
      setSashimiArcs(mode: 'off' | 'up' | 'down') {
        this.sashimiArcs = mode
      },
    }
  }

  test('flips read connections and keeps sashimi in sync', () => {
    const model = makeDirectionModel()
    getArcDirectionMenuItem(model).onClick()
    expect(model.readConnectionsDown).toBe(true)
    expect(model.sashimiArcs).toBe('down')
  })

  test('disabled when no arcs are on', () => {
    const model = makeDirectionModel()
    model.readConnections = 'off'
    model.sashimiArcs = 'off'
    expect(getArcDirectionMenuItem(model).disabled).toBe(true)
  })
})
