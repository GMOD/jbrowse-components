import { isValidElement } from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { getReadConnectionsMenuItem } from './readConnections.ts'

const theme = createJBrowseTheme()

function makeModel() {
  return {
    linkedReads: 'off' as 'off' | 'normal',
    setLinkedReads(mode: 'off' | 'normal') {
      this.linkedReads = mode
    },
    isLinkedReadsDefault: false,
    setLinkedReadsDefault(promote: boolean) {
      this.isLinkedReadsDefault = promote
    },
    readConnections: 'off' as 'off' | 'arc' | 'samplot',
    setReadConnections(mode: 'off' | 'arc' | 'samplot') {
      this.readConnections = mode
    },
    isReadConnectionsDefault: false,
    setReadConnectionsDefault(promote: boolean) {
      this.isReadConnectionsDefault = promote
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
    drawSingletons: true,
    setDrawSingletons(v: boolean) {
      this.drawSingletons = v
    },
    drawProperPairs: true,
    setDrawProperPairs(v: boolean) {
      this.drawProperPairs = v
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

// A promotable row is a native checkbox item carrying a "default for all"
// endAdornment (a DefaultForAllAdornment element). Whether it's present drives
// the showDefault behavior; mounting it lets us click through to the model.
function endAdornment(model: ReturnType<typeof makeModel>, label: string) {
  return findByLabel(model, label)?.endAdornment
}

// Mount the endAdornment and click its checkbox to exercise the promote wiring.
function clickDefaultForAll(
  model: ReturnType<typeof makeModel>,
  label: string,
) {
  const adornment = endAdornment(model, label)
  if (!isValidElement(adornment)) {
    throw new Error(`no default-for-all control on ${label}`)
  }
  const { getByRole } = render(
    <ThemeProvider theme={theme}>{adornment}</ThemeProvider>,
  )
  fireEvent.click(getByRole('checkbox'))
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

  test('"Show read cloud" row toggles samplot mode on/off', () => {
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

  test('row checked state reflects readConnections', () => {
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

describe('promote-as-default (default for all) control', () => {
  const pairs = 'View as pairs / link supplementary alignments'

  test('default-for-all control is hidden while the mode is off', () => {
    const model = makeModel()
    expect(endAdornment(model, pairs)).toBeUndefined()
    // shown once the mode is on (nothing to promote while off)
    model.linkedReads = 'normal'
    expect(endAdornment(model, pairs)).toBeDefined()
  })

  test('default-for-all promotes the current linked-reads mode', () => {
    const model = makeModel()
    model.linkedReads = 'normal'
    clickDefaultForAll(model, pairs)
    expect(model.isLinkedReadsDefault).toBe(true)
  })

  test('default-for-all promotes the current read-connections mode', () => {
    const model = makeModel()
    model.readConnections = 'arc'
    expect(endAdornment(model, 'Show read arcs')).toBeDefined()
    clickDefaultForAll(model, 'Show read arcs')
    expect(model.isReadConnectionsDefault).toBe(true)
  })
})
