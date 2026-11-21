/**
 * @jest-environment node
 */
import { configJsonSchema } from '../products/jbrowse-cli/src/commands/validate/configSchema.generated.ts'
import { RULINGS } from './configSpellingRulings.ts'
import { divergentShapes, rulingProblems } from './configSpellingShapes.ts'

const holdersOf = (slot: string) =>
  [...(divergentShapes(configJsonSchema).get(slot)?.values() ?? [])].flat()

test('every differing path names its ruling and its variants, and no ruling outlives its difference', () => {
  expect(rulingProblems(configJsonSchema, RULINGS)).toEqual([])
})

test('a path with no ruling, a changed variant and a stale ruling are each a problem', () => {
  const { tooltip, mark, ...rest } = RULINGS
  const problems = rulingProblems(configJsonSchema, {
    ...rest,
    mark: {
      ...mark!,
      shapes: [
        'depth',
        'height',
        'gone',
        'type',
        'interpolate',
        'extent interpolate type',
      ],
    },
    nowhere: { shapes: ['a', 'b'], why: '' },
  })
  expect(problems.map(problem => problem.split('\n')[0])).toEqual([
    expect.stringContaining('mark changed shape since its why was written'),
    expect.stringContaining(`tooltip differs with no ruling`),
    'nowhere no longer differs; delete its ruling',
  ])
  expect(tooltip?.shapes).toHaveLength(3)
})

test('variant order does not matter', () => {
  expect(
    rulingProblems(configJsonSchema, {
      ...RULINGS,
      tooltip: {
        ...RULINGS.tooltip!,
        shapes: [...RULINGS.tooltip!.shapes].reverse(),
      },
    }),
  ).toEqual([])
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
      'LinearAlignments `junctions`',
      'LinearBasic `labels.subfeatures`',
    ]),
  )
})
