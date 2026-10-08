/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-thenable -- `if`/`then` are JSON Schema keywords */
import { configJsonSchema } from '../products/jbrowse-cli/src/commands/validate/configSchema.generated.ts'
import { slotPaths } from './configSlotPaths.ts'

const ref = (name: string) => ({ $ref: `#/$defs/${name}` })

const schema = {
  properties: {
    tracks: { type: 'array', items: ref('Track') },
    defaultSession: { properties: { name: { type: 'string' } } },
  },
  $defs: {
    Track: {
      if: { properties: { type: { const: 'DemoTrack' } } },
      then: ref('DemoTrack'),
    },
    DemoTrackSlots: {
      properties: {
        height: { if: { type: 'null' }, else: { type: 'number' } },
        mode: {
          anyOf: [{ enum: ['a', 'b'] }, { enum: ['old'], deprecated: true }],
        },
        gone: { deprecated: true },
        scales: { if: { type: 'null' }, else: ref('Scales2') },
        steps: { type: 'array', items: ref('Step') },
      },
    },
    DemoTrack: {
      allOf: [ref('DemoTrackSlots')],
      properties: { type: { const: 'DemoTrack' } },
    },
    Scales2: { properties: { y: ref('Axis'), nested: ref('Scales2') } },
    Axis: { properties: { domainMin: { type: 'number' } } },
    Step: {
      if: { properties: { type: { const: 'filter' } } },
      then: { properties: { expr: { type: 'string' } } },
      else: {
        if: { properties: { type: { const: 'bin' } } },
        then: { properties: { expr: { type: 'number' } } },
      },
    },
  },
}

test('one line per slot path and enum member, rooted at the registered type', () => {
  expect(slotPaths(schema)).toEqual([
    'DemoTrack.gone',
    'DemoTrack.height',
    'DemoTrack.mode',
    'DemoTrack.mode=a',
    'DemoTrack.mode=b',
    'DemoTrack.mode=old',
    'DemoTrack.scales',
    'DemoTrack.scales.nested',
    'DemoTrack.scales.y',
    'DemoTrack.scales.y.domainMin',
    'DemoTrack.steps',
    'DemoTrack.steps[]<bin>.expr',
    'DemoTrack.steps[]<filter>.expr',
    'DemoTrack.type',
    'config.tracks',
  ])
})

test('the published schema lists a nested slot, a retired key and an enum member', () => {
  const paths = new Set(slotPaths(configJsonSchema))
  expect(paths).toContain('LinearWiggleDisplay.scales.y.domainMin')
  expect(paths).toContain('LinearAlignmentsDisplay.filter.tagFilter')
  expect(paths).toContain('CytobandAdapter.cytobandsLocation')
  expect(paths).toContain('LinearWiggleDisplay.mark=bar')
  expect(paths).toContain('config.configuration')
  expect([...paths].filter(path => path.includes('defaultSession'))).toEqual([])
})
