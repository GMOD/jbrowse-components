import {
  getArcDirectionMenuItem,
  getReadConnectionsMenuItem,
} from './readConnections.ts'

function makeModel() {
  return {
    linkedReads: 'off' as 'off' | 'normal' | 'bezier',
    setLinkedReads(mode: 'off' | 'normal' | 'bezier') {
      this.linkedReads = mode
    },
    readConnections: 'off' as 'off' | 'arc' | 'samplot',
    setReadConnections(mode: 'off' | 'arc' | 'samplot') {
      this.readConnections = mode
    },
  }
}

describe('read connections menu', () => {
  test('"Link supplementary alignments" toggles linkedReads on/off', () => {
    const model = makeModel()
    const linkItem = () => {
      const item = getReadConnectionsMenuItem(model).subMenu.find(
        i => 'label' in i && i.label === 'Link supplementary alignments',
      )
      if (!item || !('onClick' in item)) {
        throw new Error('no Link supplementary alignments item')
      }
      return item
    }
    linkItem().onClick()
    expect(model.linkedReads).toBe('normal')
    linkItem().onClick()
    expect(model.linkedReads).toBe('off')
  })

  function getViewAsPairsSubMenu(model: ReturnType<typeof makeModel>) {
    const item = getReadConnectionsMenuItem(model).subMenu.find(
      i => 'label' in i && i.label === 'View as pairs',
    )
    if (!item || !('subMenu' in item)) {
      throw new Error('no View as pairs submenu')
    }
    return item.subMenu
  }

  test('"View as pairs" → "Arcs" enables arc mode', () => {
    const model = makeModel()
    const arcs = getViewAsPairsSubMenu(model).find(
      i => 'label' in i && i.label === 'Arcs',
    )
    arcs!.onClick()
    expect(model.readConnections).toBe('arc')
  })

  test('"View as pairs" → "Read cloud" enables samplot mode', () => {
    const model = makeModel()
    const cloud = getViewAsPairsSubMenu(model).find(
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
