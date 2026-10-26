import { getConf } from '@jbrowse/core/configuration'

import { createTestEnvironment } from './testEnv.ts'

// A session spec or share link applies v4's label words to a display whose
// config may already hide them, so a "show" has to write as much as a "hide".
test.each([
  [{ showLabels: true }, [true, false]],
  [{ showLabels: 'nameAndDescription' }, [true, true]],
  [{ showLabels: 'auto' }, [true, true]],
  [{ showDescriptions: true }, [false, true]],
])('the settings %j show labels the config hid', (settings, expected) => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.applyDisplaySettings({
    labels: { name: { show: false }, description: { show: false } },
  })
  display.applyDisplaySettings(settings)
  expect([
    getConf(display, ['labels', 'name', 'show']),
    getConf(display, ['labels', 'description', 'show']),
  ]).toEqual(expected)
})

test('subfeatureLabels below shows the labels a config hid', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.applyDisplaySettings({ labels: { subfeatures: { show: false } } })
  display.applyDisplaySettings({ subfeatureLabels: 'below' })
  expect(getConf(display, ['labels', 'subfeatures', 'show'])).toBe(true)
  expect(getConf(display, ['labels', 'subfeatures', 'placement'])).toBe('below')
})
