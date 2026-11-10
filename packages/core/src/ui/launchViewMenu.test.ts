import { resolveSubMenu } from './MenuTypes.ts'
import { nestLaunchInAdvanced, pushIntoSubMenu } from './launchViewMenu.ts'

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

test('a created Launch submenu carries the Launch icon, another group none', () => {
  const items: MenuItem[] = []
  pushIntoSubMenu(items, 'Launch', { label: 'a', onClick: () => {} })
  pushIntoSubMenu(items, 'Export', { label: 'b', onClick: () => {} })
  const [launch, other] = items
  expect(launch && 'icon' in launch ? launch.icon : undefined).toBeDefined()
  expect(other && 'icon' in other ? other.icon : undefined).toBeUndefined()
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

describe('nestLaunchInAdvanced', () => {
  const row = (label: string): MenuItem => ({ label, onClick: () => {} })
  const sub = (label: string, rows: MenuItem[]): MenuItem => ({
    label,
    type: 'subMenu',
    subMenu: rows,
  })

  test('moves Launch to the end of Advanced', () => {
    const items = nestLaunchInAdvanced([
      row('Color by'),
      sub('Launch', [row('Consensus')]),
      sub('Advanced', [row('Edit plot...')]),
    ])
    expect(labels(items)).toEqual(['Color by', 'Advanced'])
    const advanced = items[1]!
    expect(
      'subMenu' in advanced ? labels(resolveSubMenu(advanced)) : [],
    ).toEqual(['Edit plot...', 'Launch'])
  })

  test('drops the Launch icon inside Advanced', () => {
    const items: MenuItem[] = [sub('Advanced', [row('Edit plot...')])]
    pushIntoSubMenu(items, 'Launch', row('Consensus'))
    const [advanced] = nestLaunchInAdvanced(items)
    const nested =
      advanced && 'subMenu' in advanced ? resolveSubMenu(advanced) : []
    expect(nested.some(i => 'icon' in i && i.icon)).toBe(false)
  })

  test('keeps Launch where it is on a menu without Advanced', () => {
    const items = [row('Color by'), sub('Launch', [row('Consensus')])]
    expect(nestLaunchInAdvanced(items)).toBe(items)
  })
})
