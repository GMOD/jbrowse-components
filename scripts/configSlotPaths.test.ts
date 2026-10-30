import { configManifest } from '../products/jbrowse-cli/src/commands/validate/configManifest.generated.ts'
/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-thenable -- `if`/`then` are JSON Schema keywords */
import { configJsonSchema } from '../products/jbrowse-cli/src/commands/validate/configSchema.generated.ts'
import {
  sessionKeyPaths,
  slotPaths,
  slotPathsByType,
} from './configSlotPaths.ts'

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

test('live paths leave out a retired key and a legacy enum value', () => {
  const live = slotPaths(schema, { live: true })
  expect(live).toContain('DemoTrack.mode=a')
  expect(live).not.toContain('DemoTrack.mode=old')
  expect(live).not.toContain('DemoTrack.gone')
  expect(live).toHaveLength(slotPaths(schema).length - 2)
})

test('by type, a path drops its type and its union member markers', () => {
  const byType = slotPathsByType(schema)
  expect([...byType.keys()]).toEqual(['DemoTrack', 'config'])
  expect([...byType.get('DemoTrack')!]).toEqual(
    expect.arrayContaining(['mode=a', 'scales.y.domainMin', 'steps[].expr']),
  )
})

test('the published schema lists a nested slot and an enum member', () => {
  const paths = new Set(slotPaths(configJsonSchema))
  expect(paths).toContain('LinearWiggleDisplay.encoding.y.scale.domainMin')
  expect(paths).toContain('CytobandAdapter.cytobandsLocation')
  expect(paths).toContain('LinearWiggleDisplay.mark=bar')
  expect(paths).toContain('config.configuration')
  expect([...paths].filter(path => path.includes('defaultSession'))).toEqual([])
})

test('the session half lists session keys, launch keys and the legacy spellings of both', () => {
  expect(
    sessionKeyPaths(
      { $defs: { Session: { properties: { views: {}, name: {} } } } },
      { DemoView: { launchKeys: ['loc'], passThrough: ['bpPerPx'] } },
    ),
  ).toEqual([
    'DemoView.bpPerPx',
    'DemoView.loc',
    'Session.name',
    'Session.views',
  ])

  const paths = sessionKeyPaths(configJsonSchema, configManifest.views)
  expect(paths).toContain('Session.useWorkspaces')
  expect(paths).toContain('LinearGenomeView.loc')
  expect(paths).not.toContain('LinearGenomeView.hideHeader')
})
