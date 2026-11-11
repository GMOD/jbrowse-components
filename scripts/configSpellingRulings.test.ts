/**
 * @jest-environment node
 */
import { configJsonSchema } from '../products/jbrowse-cli/src/commands/validate/configSchema.generated.ts'
import { RULINGS } from './configSpellingRulings.ts'
import { divergentShapes, rulingProblems } from './configSpellingShapes.ts'

const holdersOf = (slot: string) =>
  [...(divergentShapes(configJsonSchema).get(slot)?.values() ?? [])].flat()

test('every differing path names its ruling and its shape count, and no ruling outlives its difference', () => {
  expect(rulingProblems(configJsonSchema, RULINGS)).toEqual([])
})

test('a path with no ruling, a moved count and a stale ruling are each a problem', () => {
  const { tooltip, ...rest } = RULINGS
  expect(
    rulingProblems(configJsonSchema, {
      ...rest,
      mark: { variants: 1, why: '' },
      nowhere: { variants: 2, why: '' },
    }).map(problem => problem.split('\n')[0]),
  ).toEqual([
    expect.stringContaining('mark has 6 shapes and its ruling says 1'),
    expect.stringContaining(`tooltip differs with no ruling`),
    'nowhere no longer differs; delete its ruling',
  ])
  expect(tooltip?.variants).toBe(3)
})

test("a channel under a part compares with the display's own", () => {
  expect(holdersOf('encoding.color.scale')).toEqual(
    expect.arrayContaining([
      'MultiWaySynteny',
      'MultiWaySynteny `ribbons`',
      'LinearMark `marks[]`',
    ]),
  )
})

test("a part's facet, mark and placement compare with the display's own", () => {
  expect(holdersOf('facet')).toContain('LinearVariant `records`')
  expect(holdersOf('mark')).toEqual(
    expect.arrayContaining(['LinearBasic', 'LinearAlignments `pileup`']),
  )
  expect(holdersOf('placement')).toEqual(
    expect.arrayContaining([
      'LinearAlignments `sashimi`',
      'LinearBasic `labels.subfeatures`',
    ]),
  )
})
