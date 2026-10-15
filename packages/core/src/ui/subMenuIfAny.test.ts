import { subMenuIfAny } from './MenuTypes.ts'

test('an empty submenu leaves no row', () => {
  expect(subMenuIfAny({ label: 'Launch', subMenu: [] })).toEqual([])
})

test('a submenu with rows is one row holding them', () => {
  const row = { label: 'A', onClick: () => {} }
  expect(
    subMenuIfAny({ label: 'Launch', priority: 5, subMenu: [row] }),
  ).toEqual([{ label: 'Launch', priority: 5, type: 'subMenu', subMenu: [row] }])
})
