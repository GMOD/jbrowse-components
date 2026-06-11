import PluginManager from '../PluginManager.ts'
import { buildAllTracksMenu } from './buildAllTracksMenu.ts'

import type { GroupOp, MenuItem } from './index.ts'

function makePM(extraOps: GroupOp[] = []) {
  const pm = new PluginManager([]).createPluggableElements()
  pm.configure()
  for (const op of extraOps) {
    pm.addToExtensionPoint('Core-extendAllTracksMenu', ops => [...ops, op])
  }
  return pm
}

function findSub(items: MenuItem[], label: string) {
  const item = items.find(i => 'label' in i && i.label === label)
  return item && 'subMenu' in item ? item.subMenu : undefined
}

function clickLabel(items: MenuItem[], label: string) {
  const item = items.find(i => 'label' in i && i.label === label)
  if (item && 'onClick' in item) {
    item.onClick()
  } else {
    throw new Error(`no clickable item labeled ${label}`)
  }
}

test('empty when no display supports any op', () => {
  const pm = makePM()
  expect(
    buildAllTracksMenu(pm, [{ displays: [{}] }, { displays: [{}] }]),
  ).toEqual([])
})

test('compactness op fans out to every compactable display', () => {
  const calls: string[] = []
  const a = { setCompactness: (v: string) => calls.push(`a:${v}`) }
  const b = { setCompactness: (v: string) => calls.push(`b:${v}`) }
  const pm = makePM()

  const menu = buildAllTracksMenu(pm, [
    { displays: [a, {}] },
    { displays: [b] },
  ])
  const allTracks = findSub(menu, 'All tracks')!
  clickLabel(findSub(allTracks, 'Compactness')!, 'Compact')

  expect(calls).toEqual(['a:compact', 'b:compact'])
})

test('contributed op only appears when a display supports it', () => {
  const settable = { setFoo: jest.fn() }
  const fooOp: GroupOp = displays =>
    displays.some(d => d !== null && typeof d === 'object' && 'setFoo' in d)
      ? [{ label: 'Foo', onClick: () => {} }]
      : []

  const withFoo = buildAllTracksMenu(makePM([fooOp]), [
    { displays: [settable] },
  ])
  expect(
    findSub(withFoo, 'All tracks')!.some(
      i => 'label' in i && i.label === 'Foo',
    ),
  ).toBe(true)

  const withoutFoo = buildAllTracksMenu(makePM([fooOp]), [{ displays: [{}] }])
  expect(findSub(withoutFoo, 'All tracks')).toBeUndefined()
})
