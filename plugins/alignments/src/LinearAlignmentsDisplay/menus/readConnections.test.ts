import { isValidElement } from 'react'

import { getReadConnectionsMenuItem } from './readConnections.ts'

import type { PromotableToggleRow } from './PromotableToggleRow.tsx'

type RowProps = Parameters<typeof PromotableToggleRow>[0]

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

// A promotable row is a `type:'custom'` item whose render() returns a
// PromotableToggleRow — reading its props (via isValidElement, no cast) lets us
// exercise the menu→model wiring without mounting the React component (that is
// covered in PromotableToggleRow.test.tsx).
function rowProps(
  model: ReturnType<typeof makeModel>,
  label: string,
): RowProps {
  const item = findByLabel(model, label)
  if (item?.type !== 'custom') {
    throw new Error(`no ${label} promotable row`)
  }
  const node = item.render(() => {})
  if (!isValidElement<RowProps>(node)) {
    throw new Error(`${label} did not render an element`)
  }
  return node.props
}

describe('read connections menu', () => {
  test('"View as pairs" row toggles linkedReads on/off', () => {
    const model = makeModel()
    const label = 'View as pairs / link supplementary alignments'
    rowProps(model, label).onToggle()
    expect(model.linkedReads).toBe('normal')
    rowProps(model, label).onToggle()
    expect(model.linkedReads).toBe('off')
  })

  test('"Show read arcs" row toggles arc mode on/off', () => {
    const model = makeModel()
    rowProps(model, 'Show read arcs').onToggle()
    expect(model.readConnections).toBe('arc')
    rowProps(model, 'Show read arcs').onToggle()
    expect(model.readConnections).toBe('off')
  })

  test('"Show read cloud" row toggles samplot mode on/off', () => {
    const model = makeModel()
    rowProps(model, 'Show read cloud').onToggle()
    expect(model.readConnections).toBe('samplot')
    rowProps(model, 'Show read cloud').onToggle()
    expect(model.readConnections).toBe('off')
  })

  test('arcs and read cloud are mutually exclusive', () => {
    const model = makeModel()
    rowProps(model, 'Show read arcs').onToggle()
    expect(model.readConnections).toBe('arc')
    // enabling read cloud while arcs are on switches mode (turns arcs off)
    rowProps(model, 'Show read cloud').onToggle()
    expect(model.readConnections).toBe('samplot')
    expect(rowProps(model, 'Show read arcs').checked).toBe(false)
  })

  test('row checked state reflects readConnections', () => {
    const model = makeModel()
    expect(rowProps(model, 'Show read arcs').checked).toBe(false)
    expect(rowProps(model, 'Show read cloud').checked).toBe(false)
    model.readConnections = 'arc'
    expect(rowProps(model, 'Show read arcs').checked).toBe(true)
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
    expect(rowProps(model, pairs).showDefault).toBe(false)
    // shown once the mode is on (nothing to promote while off)
    model.linkedReads = 'normal'
    expect(rowProps(model, pairs).showDefault).toBe(true)
  })

  test('default-for-all promotes the current linked-reads mode', () => {
    const model = makeModel()
    model.linkedReads = 'normal'
    rowProps(model, pairs).onToggleDefault()
    expect(model.isLinkedReadsDefault).toBe(true)
  })

  test('default-for-all promotes the current read-connections mode', () => {
    const model = makeModel()
    model.readConnections = 'arc'
    const arcs = rowProps(model, 'Show read arcs')
    expect(arcs.showDefault).toBe(true)
    arcs.onToggleDefault()
    expect(model.isReadConnectionsDefault).toBe(true)
  })
})
