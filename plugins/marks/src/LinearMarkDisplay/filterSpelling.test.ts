import { createTestEnvironment } from './testEnv.ts'

const MARKS = [{ mark: 'bar', encoding: { y: 'score' } }]

test("v4's unprefixed jexlFilters slot loads as a prefixed filter", () => {
  const { createDisplay } = createTestEnvironment({
    marks: MARKS,
    jexlFilters: ["get(feature,'score')>10"],
  })
  expect(createDisplay().display.configuredFilters()).toEqual([
    "jexl:get(feature,'score')>10",
  ])
})
