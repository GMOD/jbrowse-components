import { getConfigurationSchemaDefinition } from '@jbrowse/core/configuration'

import configSchemaF from './configSchemaF.ts'
import { createDisplay } from './testEnv.ts'

// A synteny block has no introns, basecaller tags or qualities, so the schema
// stops at the alignments base and the shared model answers these off.
test('the schema declares no sashimi, junction filter, pileup.bases or modifications', () => {
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
  expect(partOf('filter')).not.toHaveProperty('junctions')
  expect(partOf('filter')).toHaveProperty('connections')
  expect(partOf('pileup')).not.toHaveProperty('bases')
  expect(partOf('pileup')).toHaveProperty('mismatches')
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
