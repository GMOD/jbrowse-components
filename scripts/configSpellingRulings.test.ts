/**
 * @jest-environment node
 */
import { configJsonSchema } from '../products/jbrowse-cli/src/commands/validate/configSchema.generated.ts'
import { RULINGS } from './configSpellingRulings.ts'
import { divergentShapes } from './configSpellingShapes.ts'

test('every path that differs between displays names its ruling, and no ruling outlives its difference', () => {
  expect([...divergentShapes(configJsonSchema).keys()].sort()).toEqual(
    Object.keys(RULINGS).sort(),
  )
})

test("a channel under a part compares with the display's own", () => {
  const scale = divergentShapes(configJsonSchema).get('encoding.color.scale')
  expect([...(scale?.values() ?? [])].flat()).toEqual(
    expect.arrayContaining([
      'MultiWaySynteny',
      'MultiWaySynteny `ribbons`',
      'LinearMark `marks[]`',
    ]),
  )
})
