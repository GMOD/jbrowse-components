/**
 * @jest-environment node
 */
import { configJsonSchema } from '../products/jbrowse-cli/src/commands/validate/configSchema.generated.ts'
import { RULINGS } from './configSpellingRulings.ts'
import { divergentShapes } from './configSpellingShapes.ts'

const divergent = divergentShapes(configJsonSchema)

test('every differing path names its ruling and its shape count, and no ruling outlives its difference', () => {
  expect(
    Object.fromEntries(
      [...divergent].map(([slot, bySlot]) => [slot, bySlot.size]),
    ),
  ).toEqual(
    Object.fromEntries(
      Object.entries(RULINGS).map(([slot, { variants }]) => [slot, variants]),
    ),
  )
})

test("a channel under a part compares with the display's own", () => {
  expect(
    [...(divergent.get('encoding.color.scale')?.values() ?? [])].flat(),
  ).toEqual(
    expect.arrayContaining([
      'MultiWaySynteny',
      'MultiWaySynteny `ribbons`',
      'LinearMark `marks[]`',
    ]),
  )
})
