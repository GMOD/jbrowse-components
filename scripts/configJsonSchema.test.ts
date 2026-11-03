/**
 * @jest-environment node
 */
import { dropsRetiredKey, legacyKeySchema } from './configJsonSchema.ts'

test('a retired lift writing nothing drops its key, and says so', () => {
  expect(dropsRetiredKey(() => ({}))).toBe(true)
  expect(legacyKeySchema(true).description).toMatch(/dropped/)
})

test('a retired lift writing a slot rewrites its key, and says so', () => {
  expect(dropsRetiredKey(value => ({ rows: { step: value } }))).toBe(false)
  expect(dropsRetiredKey(() => ({ height: 100 }))).toBe(false)
  expect(legacyKeySchema(false).description).toMatch(
    /rewrites it into current slots/,
  )
})
