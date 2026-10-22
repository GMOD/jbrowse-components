import { createDisplay } from './testEnv.ts'

test("the gene color's threshold cuts are judged as every color object's are", () => {
  expect(
    createDisplay().plotProblems({
      encoding: {
        color: {
          field: 'score',
          scale: { type: 'threshold', domain: ['5', '1'] },
        },
      },
    }),
  ).toEqual([
    'encoding.color.scale.domain: threshold cuts are distinct numbers, read in ascending order, with the range running from the lowest interval; a repeated cut leaves an interval no value falls in',
  ])
  expect(
    createDisplay().plotProblems({
      encoding: {
        color: {
          field: 'score',
          scale: { type: 'threshold', domain: ['1', '5'], range: ['red'] },
        },
      },
    }),
  ).toEqual([
    'encoding.color.scale.range: 2 threshold cuts make 3 intervals, one color each, and range lists 1: a missing color comes from the default palette and an extra one is never read',
  ])
})

test("the ribbon color's names are judged under its own setting", () => {
  expect(
    createDisplay().plotProblems({
      ribbons: {
        encoding: {
          color: {
            field: 'group',
            scale: { domain: ['core'], names: ['a', 'b'] },
          },
        },
      },
    }),
  ).toEqual([
    'ribbons.encoding.color.scale.names: names gives one value each its name in the key, and 2 names meet 1 value: a name past them names nothing',
  ])
  expect(
    createDisplay().plotProblems({
      ribbons: {
        encoding: {
          color: {
            field: 'group',
            scale: { domain: ['core'], names: ['Core'] },
          },
        },
      },
    }),
  ).toEqual([])
})
