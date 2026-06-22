import {
  getArcDirectionMenuItem,
  getReadConnectionsMenuItem,
  getSashimiDirectionMenuItem,
} from './readConnections.ts'

import type { SashimiArcsMode } from '../constants.ts'

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

describe('read-connection arc direction toggle', () => {
  function makeDirectionModel() {
    return {
      readConnections: 'arc' as 'off' | 'arc' | 'samplot',
      readConnectionsDown: false,
      setReadConnectionsDown(v: boolean) {
        this.readConnectionsDown = v
      },
    }
  }

  test('delegates to setReadConnectionsDown with the flipped value', () => {
    const model = makeDirectionModel()
    getArcDirectionMenuItem(model).onClick()
    expect(model.readConnectionsDown).toBe(true)
  })

  test('disabled when read connections are off (independent of sashimi)', () => {
    const model = makeDirectionModel()
    model.readConnections = 'off'
    expect(getArcDirectionMenuItem(model).disabled).toBe(true)
  })
})

describe('sashimi arc placement submenu', () => {
  function makeSashimiModel() {
    return {
      showSashimiArcs: true,
      sashimiArcsMode: 'auto' as SashimiArcsMode,
      setSashimiArcsMode(mode: SashimiArcsMode) {
        this.sashimiArcsMode = mode
      },
    }
  }

  function itemByLabel(
    model: ReturnType<typeof makeSashimiModel>,
    label: string,
  ) {
    const item = getSashimiDirectionMenuItem(model).subMenu.find(
      i => 'label' in i && i.label === label,
    )
    if (!item || !('onClick' in item)) {
      throw new Error(`no ${label} item`)
    }
    return item
  }

  test('checks the active mode and switches on click', () => {
    const model = makeSashimiModel()
    expect(itemByLabel(model, 'Auto (minimize overlap)').checked).toBe(true)
    expect(itemByLabel(model, 'Below coverage').checked).toBe(false)
    itemByLabel(model, 'Below coverage').onClick()
    expect(model.sashimiArcsMode).toBe('down')
    expect(itemByLabel(model, 'Below coverage').checked).toBe(true)
  })

  test('the whole submenu is disabled when sashimi arcs are hidden', () => {
    const model = makeSashimiModel()
    model.showSashimiArcs = false
    expect(getSashimiDirectionMenuItem(model).disabled).toBe(true)
  })
})
