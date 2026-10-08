import { createDisplay } from './testEnv.ts'

test("the gene color's threshold cuts are judged as every color object's are", () => {
  expect(
    createDisplay().plotProblems({
      color: { field: 'score', scale: 'threshold', domain: ['5', '1'] },
    }),
  ).toEqual([
    'color.domain: threshold cuts are distinct numbers, read in ascending order, with the range running from the lowest interval; a repeated cut leaves an interval no value falls in',
  ])
  expect(
    createDisplay().plotProblems({
      color: {
        field: 'score',
        scale: 'threshold',
        domain: ['1', '5'],
        range: ['red'],
      },
    }),
  ).toEqual([
    'color.range: 2 threshold cuts make 3 intervals, one color each, and range lists 1: a missing color comes from the default palette and an extra one is never read',
  ])
})

test("the ribbon color's labels are judged under its own setting", () => {
  expect(
    createDisplay().plotProblems({
      ribbonColor: { field: 'group', domain: ['core'], labels: ['a', 'b'] },
    }),
  ).toEqual([
    'ribbonColor.labels: labels names one value each, and 2 labels name 1 value: a label past them names nothing',
  ])
  expect(
    createDisplay().plotProblems({
      ribbonColor: { field: 'group', domain: ['core'], labels: ['Core'] },
    }),
  ).toEqual([])
})
