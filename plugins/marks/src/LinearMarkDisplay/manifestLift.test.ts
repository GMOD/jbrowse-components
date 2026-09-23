import fs from 'node:fs'

import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { configManifest } from '../../../../products/jbrowse-cli/src/commands/validate/configManifest.generated.ts'
import { liftToSnapshot } from '../../../../products/jbrowse-cli/src/commands/validate/liftConfig.ts'
import { configSchemaFactory } from './configSchema.ts'

// `jbrowse validate` lifts a file's spellings from the manifest's record of
// this schema before the rule list reads it. The schema does the lifting in
// the app, so the two have to hold the same thing for every spelling a file
// may use.

const schema = configSchemaFactory()
const slots = configManifest.displays.LinearMarkDisplay!.slots

function written(display: Record<string, unknown>) {
  const { marks, facet, transform } = display
  return Object.fromEntries(
    Object.entries({ marks, facet, transform }).filter(
      ([, value]) => value !== undefined,
    ),
  )
}

function loaded(display: Record<string, unknown>) {
  const { marks, facet, transform } = getSnapshot(
    schema.create({ displayId: 'd', ...written(display) }),
  ) as Record<string, unknown>
  return written({ marks, facet, transform })
}

interface ShippedConfig {
  tracks: { displays?: Record<string, unknown>[] }[]
}

const shipped = [
  'test_data/volvox/config_marks.json',
  'test_data/alu_age/config.json',
  'demos/read_marks/config.json',
].flatMap(file =>
  (
    JSON.parse(
      fs.readFileSync(`${__dirname}/../../../../${file}`, 'utf8'),
    ) as ShippedConfig
  ).tracks
    .flatMap(track => track.displays ?? [])
    .filter(display => display.type === 'LinearMarkDisplay')
    .map((display, i): [string, Record<string, unknown>] => [
      `${file} #${i}`,
      display,
    ]),
)

const EVERY_SPELLING: Record<string, unknown> = {
  facet: 'HP',
  transform: [{ type: 'formula', expr: "jexl:getTag(feature,'HP')", as: 'HP' }],
  marks: [
    {
      mark: 'point',
      encoding: { y: 'score', color: 'red', shape: 'triangle' },
      transform: [{ type: 'coverage', as: 'depth' }],
    },
    {
      mark: 'span',
      encoding: {
        color: {
          field: 'score',
          scale: 'linear',
          range: ['white', 'red'],
          domainMin: 0,
          domainMax: 10,
          reverse: true,
        },
        shape: { field: 'svtype', domain: [1, 2] },
      },
      transform: [{ type: 'bin', step: 1000, as: ['from', 'to'] }],
    },
  ],
}

// A snapshot leaves a slot at its default off and the lift keeps what the file
// wrote, so the lifted file holds everything the snapshot does, spelled the
// same way, and loads to the same config.
test.each([...shipped, ['every spelling a file may use', EVERY_SPELLING]])(
  'the manifest lifts %s as the schema does',
  (_, display) => {
    const lifted = liftToSnapshot(written(display), slots)
    expect(lifted).toMatchObject(loaded(display))
    expect(loaded(lifted as Record<string, unknown>)).toEqual(loaded(display))
  },
)

test('the shipped configs hold a mark display to compare', () => {
  expect(shipped.length).toBeGreaterThan(3)
})
