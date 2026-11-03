/**
 * @jest-environment node
 */
import { legacyKeySchema } from './configJsonSchema.ts'

test('a retired key whose lift writes nothing is described as dropped', () => {
  expect(legacyKeySchema(() => ({})).description).toMatch(/dropped/)
})

test('a retired key whose lift writes a slot is described as rewritten', () => {
  expect(
    legacyKeySchema(value => ({ rows: { step: value } })).description,
  ).toMatch(/rewrites it into current slots/)
  expect(
    legacyKeySchema(value => (value === 1 ? { height: value } : {}))
      .description,
  ).toMatch(/rewrites/)
})
