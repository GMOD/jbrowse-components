import { getConfigurationSchemaDefinition } from '@jbrowse/core/configuration'

import configSchemaF from './configSchemaF.ts'
import { createDisplay } from './testEnv.ts'

// A synteny block has no introns, basecaller tags or qualities, so the schema
// stops at the alignments base and the shared model answers these off.
test('the schema declares no sashimi, pileup.bases or modifications', () => {
  const definition = getConfigurationSchemaDefinition(configSchemaF())!
  for (const slot of ['sashimi', 'modifications']) {
    expect(definition).not.toHaveProperty(slot)
  }
  const partOf = (name: string) =>
    getConfigurationSchemaDefinition(
      definition[name] as Parameters<
        typeof getConfigurationSchemaDefinition
      >[0],
    )!
  expect(partOf('pileup')).not.toHaveProperty('bases')
  expect(partOf('pileup')).toHaveProperty('mismatches')
})

// The filter list is the alignments display's, so a junction field is a
// config the display cannot apply, and it says so
test('a junction field in the filter is a config problem', () => {
  const display = createDisplay()
  const conf = configSchemaF().create({
    type: 'LGVSyntenyDisplay',
    displayId: 'p',
    filter: [{ field: 'junction.reads', gte: 5 }],
  })
  expect(display.configProblemsOf(conf)).toContainEqual(
    'filter: junction.reads tests splice junctions, which this display does not draw',
  )
})

test('the model answers the four off and fetches no junctions', () => {
  const display = createDisplay()
  display.setShowCoverage(true)
  expect(display.hasSashimi).toBe(false)
  expect(display.showSashimi).toBe(false)
  expect(display.showSashimiCounts).toBe(false)
  expect(display.baseLayer).toBeUndefined()
  expect(display.modificationSettings).toEqual({})
  expect(display.rpcProps().junctions).toBe(false)
})

test('a write to one of the four throws rather than landing nowhere', () => {
  const display = createDisplay()
  expect(() => {
    display.setShowSashimi(true)
  }).toThrow('LGVSyntenyDisplay has no sashimi')
  expect(() => {
    display.setJunctionFilter({ minReads: 5 })
  }).toThrow('LGVSyntenyDisplay has no sashimi')
  expect(() => {
    display.setBaseLayer({ type: 'baseQuality' })
  }).toThrow('LGVSyntenyDisplay has no sashimi')
})
