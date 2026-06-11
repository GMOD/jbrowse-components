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

  function checkboxByLabel(model: ReturnType<typeof makeModel>, label: string) {
    const item = getReadConnectionsMenuItem(model).subMenu.find(
      i => 'label' in i && i.label === label,
    )
    if (!item || !('onClick' in item)) {
      throw new Error(`no ${label} checkbox`)
    }
    return item
  }

  test('"Show read arcs" toggles arc mode on/off', () => {
    const model = makeModel()
    checkboxByLabel(model, 'Show read arcs').onClick()
    expect(model.readConnections).toBe('arc')
    checkboxByLabel(model, 'Show read arcs').onClick()
    expect(model.readConnections).toBe('off')
  })

  test('"Show read cloud" toggles samplot mode on/off', () => {
    const model = makeModel()
    checkboxByLabel(model, 'Show read cloud').onClick()
    expect(model.readConnections).toBe('samplot')
    checkboxByLabel(model, 'Show read cloud').onClick()
    expect(model.readConnections).toBe('off')
  })

  test('arcs and read cloud are mutually exclusive', () => {
    const model = makeModel()
    checkboxByLabel(model, 'Show read arcs').onClick()
    expect(model.readConnections).toBe('arc')
    // enabling read cloud while arcs are on switches mode (turns arcs off)
    checkboxByLabel(model, 'Show read cloud').onClick()
    expect(model.readConnections).toBe('samplot')
    expect(checkboxByLabel(model, 'Show read arcs').checked).toBe(false)
  })

  test('checkbox checked state reflects readConnections', () => {
    const model = makeModel()
    expect(checkboxByLabel(model, 'Show read arcs').checked).toBe(false)
    expect(checkboxByLabel(model, 'Show read cloud').checked).toBe(false)
    model.readConnections = 'arc'
    expect(checkboxByLabel(model, 'Show read arcs').checked).toBe(true)
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
