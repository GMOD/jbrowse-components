import { readConnectionsGroupOp } from './allTracksGroupOps.ts'

import type { MenuItem } from '@jbrowse/core/ui'

function clickLabel(items: MenuItem[], label: string) {
  const item = items.find(i => 'label' in i && i.label === label)
  if (item && 'onClick' in item) {
    item.onClick()
  } else {
    throw new Error(`no clickable item labeled ${label}`)
  }
}

test('empty when no display has setReadConnections', () => {
  expect(readConnectionsGroupOp([{}, { setOther: () => {} }])).toEqual([])
})

test('sets read connection mode on every settable display', () => {
  const a = { setReadConnections: jest.fn() }
  const b = { setReadConnections: jest.fn() }

  const [item] = readConnectionsGroupOp([a, {}, b])
  if (item && 'subMenu' in item) {
    clickLabel(item.subMenu, 'Arcs')
  }

  expect(a.setReadConnections).toHaveBeenCalledWith('arc')
  expect(b.setReadConnections).toHaveBeenCalledWith('arc')
})
