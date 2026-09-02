import { resolveSubMenu } from './MenuTypes.ts'
import { pushIntoSubMenu } from './launchViewMenu.ts'

import type { MenuItem } from './MenuTypes.ts'

function labels(items: MenuItem[]) {
  return items.map(i => ('label' in i ? i.label : i.type))
}

test('creates the submenu once and appends to it after', () => {
  const items: MenuItem[] = []
  pushIntoSubMenu(items, 'Launch', { label: 'a', onClick: () => {} })
  pushIntoSubMenu(items, 'Launch', { label: 'b', onClick: () => {} })
  expect(items).toHaveLength(1)
  const [launch] = items
  expect(
    launch && 'subMenu' in launch ? labels(resolveSubMenu(launch)) : [],
  ).toEqual(['a', 'b'])
})

test('appends to a function-form submenu without calling it', () => {
  const build = jest.fn((): MenuItem[] => [{ label: 'a', onClick: () => {} }])
  const items: MenuItem[] = [
    { label: 'Launch', type: 'subMenu', subMenu: build },
  ]
  pushIntoSubMenu(items, 'Launch', { label: 'b', onClick: () => {} })
  expect(build).not.toHaveBeenCalled()
  const [launch] = items
  expect(
    launch && 'subMenu' in launch ? labels(resolveSubMenu(launch)) : [],
  ).toEqual(['a', 'b'])
  expect(build).toHaveBeenCalledTimes(1)
})
