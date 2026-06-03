import {
  getArcDirectionMenuItem,
  getReadConnectionsMenuItem,
} from './readConnections.ts'

function makeModel() {
  return {
    linkedReads: 'off' as 'off' | 'normal',
    setLinkedReads(mode: 'off' | 'normal') {
      this.linkedReads = mode
    },
    readConnections: 'off' as 'off' | 'arc' | 'samplot',
    setReadConnections(mode: 'off' | 'arc' | 'samplot') {
      this.readConnections = mode
    },
  }
}

describe('read connections menu', () => {
  test('"View as pairs / link supplementary alignments" toggles linkedReads on/off', () => {
    const model = makeModel()
    const linkItem = () => {
      const item = getReadConnectionsMenuItem(model).subMenu.find(
        i =>
          'label' in i &&
          i.label === 'View as pairs / link supplementary alignments',
      )
      if (!item || !('onClick' in item)) {
        throw new Error('no link supplementary alignments item')
      }
      return item
    }
    linkItem().onClick()
    expect(model.linkedReads).toBe('normal')
    linkItem().onClick()
    expect(model.linkedReads).toBe('off')
  })

  function getPairOverlaySubMenu(model: ReturnType<typeof makeModel>) {
    const item = getReadConnectionsMenuItem(model).subMenu.find(
      i => 'label' in i && i.label === 'Show pair overlay',
    )
    if (!item || !('subMenu' in item)) {
      throw new Error('no Show pair overlay submenu')
    }
    return item.subMenu
  }

  test('"Show pair overlay" → "Arcs" enables arc mode', () => {
    const model = makeModel()
    const arcs = getPairOverlaySubMenu(model).find(
      i => 'label' in i && i.label === 'Arcs',
    )
    arcs!.onClick()
    expect(model.readConnections).toBe('arc')
  })

  test('"Show pair overlay" → "Read cloud" enables samplot mode', () => {
    const model = makeModel()
    const cloud = getPairOverlaySubMenu(model).find(
      i => 'label' in i && i.label === 'Read cloud',
    )
    cloud!.onClick()
    expect(model.readConnections).toBe('samplot')
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
      showSashimiArcs: true,
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
    model.showSashimiArcs = false
    expect(getArcDirectionMenuItem(model).disabled).toBe(true)
  })
})
