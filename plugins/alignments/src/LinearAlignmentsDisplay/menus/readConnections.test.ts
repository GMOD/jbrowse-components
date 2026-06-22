import { getReadConnectionsMenuItem } from './readConnections.ts'

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
  }
}

function findByLabel(model: ReturnType<typeof makeModel>, label: string) {
  return getReadConnectionsMenuItem(model).subMenu.find(
    i => 'label' in i && i.label === label,
  )
}

function checkboxByLabel(model: ReturnType<typeof makeModel>, label: string) {
  const item = findByLabel(model, label)
  if (!item || !('onClick' in item)) {
    throw new Error(`no ${label} checkbox`)
  }
  return item
}

describe('read connections menu', () => {
  test('"View as pairs / link supplementary alignments" toggles linkedReads on/off', () => {
    const model = makeModel()
    const label = 'View as pairs / link supplementary alignments'
    checkboxByLabel(model, label).onClick()
    expect(model.linkedReads).toBe('normal')
    checkboxByLabel(model, label).onClick()
    expect(model.linkedReads).toBe('off')
  })

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

describe('read-connection band options appear only with an active overlay', () => {
  test('hidden when no overlay is active', () => {
    const model = makeModel()
    expect(findByLabel(model, 'Draw below coverage band')).toBeUndefined()
    expect(
      findByLabel(model, 'Show off-screen mate connections'),
    ).toBeUndefined()
  })

  test('revealed and functional when arcs are on', () => {
    const model = makeModel()
    model.readConnections = 'arc'
    checkboxByLabel(model, 'Draw below coverage band').onClick()
    expect(model.readConnectionsDown).toBe(true)
  })
})
