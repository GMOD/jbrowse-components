import { createDisplay } from './testEnv.ts'

function hidden(display: ReturnType<typeof createDisplay>) {
  display.facetByField('mateAssembly')
  display.setSelfLaneHidden(true)
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

// The self lane is a `facet.hidden` entry like a chip's, so it shares the
// chips' fate: another grouping drops it, and Show all brings it back.
test('the self lane is one more facet.hidden key', () => {
  const display = createDisplay()
  display.facetByField('mateAssembly')
  display.setSelfLaneHidden(true)
  expect(display.selfLaneHidden).toBe(true)
  display.hideGroup('volvox_random')
  expect([...display.hiddenGroupKeys].sort()).toEqual([
    'volvox',
    'volvox_random',
  ])
  display.setSelfLaneHidden(false)
  expect([...display.hiddenGroupKeys]).toEqual(['volvox_random'])
  display.setSelfLaneHidden(true)
  display.showAllGroups()
  expect(display.selfLaneHidden).toBe(false)
  display.setSelfLaneHidden(true)
  display.facetByField('strand')
  expect(display.hiddenGroupKeys.size).toBe(0)
})

// A group key names a lane only within the grouping that issued it, so the
// key-space reset drops what the user hid along with the collapses.
test('changing the grouping forgets what was hidden', () => {
  const display = createDisplay()
  display.facetByField('mateAssembly')
  display.hideGroup('volvox_random')
  expect(display.hiddenGroupKeys.has('volvox_random')).toBe(true)
  display.facetByField('strand')
  expect(display.hiddenGroupKeys.size).toBe(0)
})
