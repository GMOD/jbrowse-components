import { createTestEnvironment } from './testEnv.ts'

const MARKS = [{ mark: 'bar', encoding: { y: 'score' } }]

test("v4's unprefixed jexlFilters slot loads as a prefixed filter", () => {
  const { createDisplay } = createTestEnvironment({
    marks: MARKS,
    jexlFilters: ["get(feature,'score')>10"],
  })
  expect(createDisplay().display.activeFilters).toEqual([
    "jexl:get(feature,'score')>10",
  ])
})

test("a v4.3 session's jexlFiltersSetting loads as a prefixed filterSetting", () => {
  const { createDisplay } = createTestEnvironment({ marks: MARKS })
  const { display } = createDisplay({
    displaySnapshot: { jexlFiltersSetting: ["get(feature,'score')>99"] },
  })
  expect(display.filterSetting).toEqual(["jexl:get(feature,'score')>99"])
})
