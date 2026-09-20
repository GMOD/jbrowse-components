import {
  getConfigurationSchemaMetadata,
  isSlotDefinitionEntry,
  makeSlotFacade,
  slotChoices,
} from '@jbrowse/core/configuration'
import { getSnapshot, getType } from '@jbrowse/mobx-state-tree'

import { configSchemaFactory } from './configSchema.ts'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

// The config editor writes a mark one slot at a time through the slot facade,
// which runs no preprocessor, so every state a user can step through has to
// load again. A refusal of a slot COMBINATION at load drops the track from the
// session it was saved in (ADR-133 made the same call for a channel object).

const schema = configSchemaFactory()

const STARTS: Record<string, unknown> = {
  'a bar of score': { shape: 'bar', encoding: { y: 'score' } },
  'a point with a glyph scale': {
    shape: 'point',
    encoding: { y: 'score', glyph: { field: 'svtype' } },
  },
  'a span with a pinned ramp and a stack': {
    shape: 'span',
    transform: [{ type: 'stack' }],
    encoding: {
      color: { field: 'score', domain: [0, 10], ramp: ['white', 'red'] },
    },
  },
  'a density bar': {
    shape: 'bar',
    source: 'density',
    encoding: { y: 'count' },
  },
  'a binned count': {
    shape: 'bar',
    transform: [
      { type: 'bin', step: 1000 },
      { type: 'aggregate', ops: [{ op: 'mean', field: 'score' }] },
    ],
    encoding: { y: 'mean_score' },
  },
}

function samples(def: Parameters<typeof slotChoices>[0]): unknown[] {
  const maybe = def.type.startsWith('maybe') ? [undefined] : []
  const choices = slotChoices(def)
  if (choices) {
    return [...maybe, ...choices]
  }
  switch (def.type) {
    case 'stringArray':
      return [[], ['10'], ['10', '20', '30']]
    case 'color':
      return ['red']
    case 'string':
      return ['', 'x']
    case 'number':
      return [0, -1, 50]
    case 'boolean':
      return [true, false]
    default:
      return [...maybe, def.defaultValue]
  }
}

function slotsOf(node: IAnyStateTreeNode) {
  const meta = getConfigurationSchemaMetadata(getType(node))
  return Object.entries(meta?.definition ?? {}).flatMap(([slot, def]) =>
    isSlotDefinitionEntry(def) ? [[slot, samples(def)] as const] : [],
  )
}

type Path = (string | number)[]

function nodeAt(root: IAnyStateTreeNode, path: Path): IAnyStateTreeNode {
  return path.reduce<IAnyStateTreeNode>((node, key) => node[key], root)
}

function load(mark: unknown) {
  return schema.create({
    type: 'LinearMarkDisplay',
    displayId: 'd',
    marks: [mark],
  })
}

const NODES: Path[] = [
  ['marks', 0],
  ['marks', 0, 'encoding'],
  ['marks', 0, 'encoding', 'color'],
  ['marks', 0, 'encoding', 'glyph'],
]

test.each(Object.entries(STARTS))(
  'every one-slot write to %s loads again',
  (_name, start) => {
    const refused: string[] = []
    const steps = (load(start).marks[0].transform as unknown[]).map(
      (_, i): Path => ['marks', 0, 'transform', i],
    )
    for (const path of [...NODES, ...steps]) {
      for (const [slot, values] of slotsOf(nodeAt(load(start), path))) {
        for (const value of values) {
          const conf = load(start)
          let written = 'write refused'
          try {
            makeSlotFacade(nodeAt(conf, path), slot).set(value)
            written = 'reload refused'
            schema.create(getSnapshot(conf))
          } catch (error) {
            refused.push(
              `${path.join('.')}.${slot} = ${JSON.stringify(value)}: ${written}: ${String(error).slice(0, 80)}`,
            )
          }
        }
      }
    }
    expect(refused.filter(r => r.includes('reload refused'))).toEqual([])
  },
)
