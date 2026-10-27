import PluginManager from '@jbrowse/core/PluginManager'
import {
  getConfigurationSchemaMetadata,
  isBareConfigurationSchemaType,
  mergeConfSettings,
  shorthandTargets,
} from '@jbrowse/core/configuration'
import { mergeTrackConfig } from '@jbrowse/core/util'
import { displayForms } from '@jbrowse/product-core'

import corePlugins from '../corePlugins.ts'

import type { IAnyType } from '@jbrowse/mobx-state-tree'

// Two settings bags combine member by member only once each side's bare
// values are lifted: merged raw, a bare `mark: "line"` replaces a whole
// `{ type, extent }` and drops `extent`. Every sub-schema a bag writes member
// by member and that takes a bare value is found by walking the registered
// displays, so a new one is covered the day it registers, and each merge path
// the app has is held to it.

interface Case {
  display: string
  path: string[]
  bare: unknown
  target: string
  other: string
}

const BARE = { string: 'bare', number: 7, list: ['bare'] } as const

function casesUnder(display: string, schema: IAnyType, path: string[]): Case[] {
  const meta = getConfigurationSchemaMetadata(schema)
  if (!meta || meta.options.writes === 'whole') {
    return []
  }
  const own =
    path.length === 0
      ? []
      : Object.entries(shorthandTargets(meta)).flatMap(([form, target]) => {
          const other = Object.keys(meta.definition).find(
            key =>
              key !== target && !(key in (meta.options.shorthandWith ?? {})),
          )
          return other
            ? [
                {
                  display,
                  path,
                  bare: BARE[form as keyof typeof BARE],
                  target,
                  other,
                },
              ]
            : []
        })
  return [
    ...own,
    ...Object.entries(meta.definition).flatMap(([key, entry]) =>
      isBareConfigurationSchemaType(entry)
        ? casesUnder(display, entry, [...path, key])
        : [],
    ),
  ]
}

const pluginManager = new PluginManager(
  corePlugins.map(P => new P()),
).createPluggableElements()

const cases = pluginManager
  .getElementTypesInGroup('display')
  .flatMap(
    ({ name, configSchema }: { name: string; configSchema?: IAnyType }) =>
      configSchema ? casesUnder(name, configSchema, []) : [],
  )

function nested(path: string[], value: unknown): Record<string, unknown> {
  return path.reduceRight<Record<string, unknown>>(
    (inner, key) => ({ [key]: inner }),
    value as Record<string, unknown>,
  )
}

function at(bag: unknown, path: string[]) {
  return path.reduce<unknown>(
    (node, key) => (node as Record<string, unknown> | undefined)?.[key],
    bag,
  )
}

const label = ({ display, path, bare }: Case) =>
  `${display} ${path.join('.')}: ${JSON.stringify(bare)}`

test('the walk finds the member-written shorthands', () => {
  expect(cases.map(c => c.path.join('.'))).toEqual(
    expect.arrayContaining(['mark', 'labels.name']),
  )
})

test.each(cases.map(c => [label(c), c] as const))(
  '%s over the object form keeps its other members, folded as displayDefaults is',
  (_label, { display, path, bare, target, other }) => {
    const schema = pluginManager.getDisplayType(display).configSchema
    const merged = mergeConfSettings(
      schema,
      nested(path, { [target]: 'old', [other]: 'kept' }),
      nested(path, bare),
    )
    expect(at(merged, path)).toMatchObject({ [target]: bare, [other]: 'kept' })
  },
)

test.each(cases.map(c => [label(c), c] as const))(
  '%s in a stored track edit keeps the base display’s other members',
  (_label, { display, path, bare, target, other }) => {
    const base = {
      trackId: 't',
      displays: [
        {
          type: display,
          displayId: 't-d',
          ...nested(path, { [target]: 'old', [other]: 'kept' }),
        },
      ],
    }
    const merged = mergeTrackConfig(
      base,
      { trackId: 't', displays: [{ displayId: 't-d', ...nested(path, bare) }] },
      displayForms(pluginManager),
    )
    expect(at(merged.displays[0], path)).toMatchObject({
      [target]: bare,
      [other]: 'kept',
    })
  },
)
