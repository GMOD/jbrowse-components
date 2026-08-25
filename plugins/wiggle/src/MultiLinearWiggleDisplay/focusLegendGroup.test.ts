import { createTestEnvironment, makeSource } from './testEnv.ts'

// The color key lists one row per group, and one per ungrouped subtrack under
// its own name (`buildLegendItems`); clicking either focuses the rows it
// stands for.
test('focuses the subtracks a legend row names', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.setRpcData(0, {
    sources: [
      { ...makeSource('a'), group: 'T cell' },
      { ...makeSource('b'), group: 'B cell' },
      { ...makeSource('c'), group: 'T cell' },
      { ...makeSource('d'), label: 'Monocyte' },
    ],
  })

  display.focusLegendGroup('T cell')
  expect(display.sources.map(s => s.name)).toEqual(['a', 'c'])

  display.focusLegendGroup('Monocyte')
  expect(display.sources.map(s => s.name)).toEqual(['d'])
})
