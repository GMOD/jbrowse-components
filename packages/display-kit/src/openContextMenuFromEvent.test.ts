import { openContextMenuFromEvent } from './DisplayContextMenu.tsx'

import type { MenuItem } from '@jbrowse/core/ui'

function fakeModel(items: MenuItem[]) {
  return {
    openContextMenu: jest.fn(),
    closeContextMenu: jest.fn(),
    contextMenuItems: () => items,
  }
}
const anchor = { clientX: 10, clientY: 20 }
const item: MenuItem = { label: 'x', onClick: () => {} }

test('a hit with items opens and suppresses the browser menu', () => {
  const model = fakeModel([item])
  const event = { preventDefault: jest.fn() }
  openContextMenuFromEvent(model, event, anchor)
  expect(model.openContextMenu).toHaveBeenCalledWith(anchor)
  expect(event.preventDefault).toHaveBeenCalled()
  expect(model.closeContextMenu).not.toHaveBeenCalled()
})

test('a hit whose menu is empty closes again and lets the browser menu through', () => {
  const model = fakeModel([])
  const event = { preventDefault: jest.fn() }
  openContextMenuFromEvent(model, event, anchor)
  expect(model.openContextMenu).toHaveBeenCalledWith(anchor)
  expect(model.closeContextMenu).toHaveBeenCalled()
  expect(event.preventDefault).not.toHaveBeenCalled()
})

test('no hit touches nothing', () => {
  const model = fakeModel([item])
  const event = { preventDefault: jest.fn() }
  openContextMenuFromEvent(model, event, undefined)
  expect(model.openContextMenu).not.toHaveBeenCalled()
  expect(event.preventDefault).not.toHaveBeenCalled()
})
