import { setConf } from '@jbrowse/core/configuration'

import { createTestEnvironment } from './testEnv.ts'

const { createDisplay } = createTestEnvironment()

test('a default LD track lists no config problem', () => {
  const { display } = createDisplay()
  expect(display.notices).toEqual([])
})

test('inverted domain ends reach the corner and the plot editor as one line', () => {
  const { display } = createDisplay()
  setConf(display.configuration, 'color', { domainMin: 0.8, domainMax: 0.2 })
  expect(display.notices).toHaveLength(1)
  expect(display.notices[0]).toMatch(
    /^color\.domainMax: domainMax is below domainMin/,
  )
  expect(display.plotProblems(display.plot)).toEqual(display.notices)
  expect(display.colorDomain).toEqual([0.2, 0.8])
})
