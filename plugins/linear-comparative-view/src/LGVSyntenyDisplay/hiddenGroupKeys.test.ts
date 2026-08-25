import { createDisplay } from './testEnv.ts'

function hidden(display: ReturnType<typeof createDisplay>) {
  display.setGroupBy({ type: 'mateAssembly' })
  display.setHideSelfAlignments(true)
  return [...display.hiddenGroupKeys].sort()
}

test('hides the lane keyed on the view assembly', () => {
  expect(hidden(createDisplay())).toEqual(['volvox'])
})

// The lane's key is the name the adapter resolved out of the track's
// `assemblyNames`, which need not be the view's spelling: a track declaring an
// alias of the view's assembly drew a self lane that the toggle left alone.
test('hides the lane keyed on an alias the track declares', () => {
  const display = createDisplay({
    trackAssemblyNames: ['volvox_alias', 'volvox_random'],
    getCanonicalAssemblyName: name =>
      name === 'volvox_alias' ? 'volvox' : undefined,
  })
  expect(hidden(display)).toEqual(['volvox', 'volvox_alias'])
})

test('nothing is hidden under another grouping, or with the option off', () => {
  const display = createDisplay()
  display.setHideSelfAlignments(true)
  display.setGroupBy({ type: 'strand' })
  expect(display.hiddenGroupKeys.size).toBe(0)
  display.setGroupBy({ type: 'mateAssembly' })
  display.setHideSelfAlignments(false)
  expect(display.hiddenGroupKeys.size).toBe(0)
})
