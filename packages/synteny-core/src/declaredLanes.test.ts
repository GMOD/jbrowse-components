import {
  declaredAnchorColorOf,
  declaredLanes,
  declaredLanesOf,
} from './declaredLanes.ts'

test('a declared lane carries the color its source draws it in', () => {
  expect(
    declaredLanesOf({
      lanes: [
        {
          name: 'HG002#1',
          label: 'HG002 pat',
          group: 'HG002',
          color: '#e41a1c',
        },
        { name: 'HG002#2', color: 'rgb(55, 126, 184)' },
        { name: 'HG003#1' },
      ],
    }),
  ).toStrictEqual([
    {
      name: 'HG002#1',
      label: 'HG002 pat',
      group: 'HG002',
      color: '#e41a1c',
    },
    {
      name: 'HG002#2',
      label: undefined,
      group: undefined,
      color: 'rgb(55, 126, 184)',
    },
    { name: 'HG003#1', label: undefined, group: undefined, color: undefined },
  ])
})

test('a color that is no string is read as none', () => {
  expect(declaredLanes([{ name: 'HG1', color: 0xff0000 }])[0]?.color).toBe(
    undefined,
  )
})

test("the anchor's color is the header's anchorColor, a string or none", () => {
  expect(declaredAnchorColorOf({ anchorColor: 'black', lanes: [] })).toBe(
    'black',
  )
  expect(declaredAnchorColorOf({ anchorColor: 3 })).toBe(undefined)
  expect(declaredAnchorColorOf({ lanes: [] })).toBe(undefined)
  expect(declaredAnchorColorOf(undefined)).toBe(undefined)
})
