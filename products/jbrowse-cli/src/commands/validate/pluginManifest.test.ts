/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-thenable -- `if`/`then` are JSON Schema keywords */
import { configManifest } from './configManifest.generated.ts'
import { configJsonSchema } from './configSchema.generated.ts'
import {
  pluginManifestOf,
  withPluginManifests,
  withPluginSchemas,
} from './pluginManifest.ts'
import { coreSchemaValidator, createSchemaValidator } from './schemaValidate.ts'
import { validateConfig } from './validateConfig.ts'

import type { PluginManifest } from './pluginManifest.ts'

// What `generateConfigManifest.ts --plugin` writes for a plugin registering
// one display: the type in the manifest, its definition, and core's `Display`
// union with the type among its branches.
function displayBranch(name: string) {
  return {
    if: {
      type: 'object',
      properties: { type: { const: name } },
      required: ['type'],
    },
    then: { $ref: `#/$defs/${name}` },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function coreDisplayUnion() {
  const { $defs } = configJsonSchema
  const display = isRecord($defs) ? $defs.Display : undefined
  return isRecord(display) && Array.isArray(display.allOf)
    ? { ...display, allOf: display.allOf }
    : { allOf: [] }
}

function pluginDisplay(name: string): PluginManifest {
  const coreDisplay = coreDisplayUnion()
  return {
    displays: {
      [name]: { slots: [{ name: 'height', type: 'number' }] },
    },
    schema: {
      $defs: {
        [name]: {
          type: 'object',
          properties: {
            type: { const: name },
            displayId: { type: 'string' },
            height: { type: 'number' },
          },
          required: ['type'],
          unevaluatedProperties: false,
        },
        Display: {
          ...coreDisplay,
          properties: {
            type: {
              type: 'string',
              anyOf: [
                { enum: ['LinearBasicDisplay', name] },
                { type: 'string' },
              ],
            },
          },
          allOf: [...coreDisplay.allOf, displayBranch(name)],
        },
      },
    },
  }
}

function configWith(display: Record<string, unknown>) {
  return {
    assemblies: [
      {
        name: 'hg38',
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'hg38-ref',
          adapter: { type: 'BgzipFastaAdapter', uri: 'hg38.fa.gz' },
        },
      },
    ],
    plugins: [{ name: 'Foo', esmUrl: 'https://example.com/foo.js' }],
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: 'genes',
        name: 'Genes',
        assemblyNames: ['hg38'],
        adapter: { type: 'Gff3TabixAdapter', uri: 'genes.gff3.gz' },
        displays: [{ displayId: 'genes-foo', ...display }],
      },
    ],
  }
}

function validateWith(config: unknown, plugins: PluginManifest[]) {
  return validateConfig(
    config,
    withPluginManifests(configManifest, plugins),
    createSchemaValidator(withPluginSchemas(configJsonSchema, plugins)),
  )
}

const where = (result: ReturnType<typeof validateConfig>) =>
  result.problems.map(p => `${p.level} ${p.where}`)

test('a plugin manifest checks the slots of the display it lists', () => {
  const config = configWith({ type: 'FooDisplay', heigth: 100 })
  expect(where(validateConfig(config))).toEqual([
    'warning tracks[0].displays[0].type',
  ])
  expect(where(validateWith(config, [pluginDisplay('FooDisplay')]))).toEqual([
    'error tracks[0].displays[0].heigth',
  ])
  expect(
    validateWith(configWith({ type: 'FooDisplay', height: 100 }), [
      pluginDisplay('FooDisplay'),
    ]).problems,
  ).toEqual([])
})

test("two plugins' types join one union, neither dropping the other's", () => {
  const plugins = [pluginDisplay('FooDisplay'), pluginDisplay('BarDisplay')]
  for (const type of ['FooDisplay', 'BarDisplay']) {
    expect(
      where(validateWith(configWith({ type, heigth: 1 }), plugins)),
    ).toEqual(['error tracks[0].displays[0].heigth'])
  }
})

test('core validation is unchanged without a plugin manifest', () => {
  expect(
    createSchemaValidator(
      withPluginSchemas(configJsonSchema, []),
    ).schemaProblems(configWith({ type: 'LinearBasicDisplay' })),
  ).toEqual(
    coreSchemaValidator.schemaProblems(
      configWith({ type: 'LinearBasicDisplay' }),
    ),
  )
})

test("a track's displayDefaults reach the plugin display the manifest lists for it", () => {
  const feature = configManifest.tracks.FeatureTrack!
  const plugin: PluginManifest = {
    ...pluginDisplay('FooDisplay'),
    tracks: {
      FeatureTrack: {
        ...feature,
        displayTypes: [...(feature.displayTypes ?? []), 'FooDisplay'],
      },
    },
  }
  const base = configWith({ type: 'FooDisplay' })
  const config = {
    ...base,
    tracks: base.tracks.map(track => ({
      ...track,
      displayDefaults: { height: 100 },
    })),
  }
  expect(validateWith(config, [plugin]).problems).toEqual([])
})

test('a plugin manifest declares the top-level key its rootConfigurationSchema adds, and checks inside it', () => {
  const plugin: PluginManifest = {
    schema: {
      properties: { msa: { $ref: '#/$defs/MSA' } },
      $defs: {
        MSA: {
          type: 'object',
          properties: { datasets: { type: 'array' } },
          additionalProperties: false,
        },
      },
    },
  }
  const config = { ...configWith({ type: 'LinearBasicDisplay' }) }
  expect(where(validateConfig({ ...config, msa: { datasets: [] } }))).toEqual([
    'warning msa',
  ])
  expect(
    validateWith({ ...config, msa: { datasets: [] } }, [plugin]).problems,
  ).toEqual([])
  expect(
    where(validateWith({ ...config, msa: { dataset: [] } }, [plugin])),
  ).toEqual(['error msa.dataset'])
})

test("a plugin's mark step is judged by the mark rules once its schema declares it", () => {
  const { $defs } = configJsonSchema
  const bin = isRecord($defs) ? $defs['MarkTransform.bin'] : undefined
  const plugin: PluginManifest = {
    schema: {
      $defs: {
        'MarkTransform.bin': {
          ...bin,
          properties: {
            ...(isRecord(bin) && isRecord(bin.properties)
              ? bin.properties
              : {}),
            fooWeight: { type: 'number' },
          },
        },
      },
    },
  }
  const config = configWith({
    type: 'LinearMarkDisplay',
    marks: [{ mark: 'bar', encoding: { y: 'score' } }],
    transform: [{ type: 'bin', step: -5, fooWeight: 1 }],
  })
  expect(where(validateConfig(config))).toEqual([
    'error tracks[0].displays[0].transform[0].fooWeight',
  ])
  expect(where(validateWith(config, [plugin]))).toEqual([
    'error tracks[0].displays[0].transform[0].step',
  ])
})

test("two plugins' names join the Display type hint, neither replacing the other's", () => {
  const { $defs } = withPluginSchemas(configJsonSchema, [
    pluginDisplay('FooDisplay'),
    pluginDisplay('BarDisplay'),
  ])
  const display = isRecord($defs) ? $defs.Display : undefined
  const type =
    isRecord(display) && isRecord(display.properties)
      ? display.properties.type
      : undefined
  const [hint] = isRecord(type) && Array.isArray(type.anyOf) ? type.anyOf : []
  const names = isRecord(hint) && Array.isArray(hint.enum) ? hint.enum : []
  expect(names).toEqual(
    expect.arrayContaining([
      'LinearBasicDisplay',
      'LinearAlignmentsDisplay',
      'FooDisplay',
      'BarDisplay',
    ]),
  )
  expect(new Set(names).size).toBe(names.length)
})

test('a file with no schema.$defs, such as a config.json, is not a plugin manifest', () => {
  expect(() =>
    pluginManifestOf({ assemblies: [], tracks: [] }, 'config.json'),
  ).toThrow('config.json is not a plugin manifest')
  expect(pluginManifestOf(pluginDisplay('FooDisplay'), 'foo.json')).toEqual(
    pluginDisplay('FooDisplay'),
  )
})
