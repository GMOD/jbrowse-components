import fs from 'fs'
import os from 'os'
import path from 'path'

import { accumulateModel } from './generateStateModelDocs.ts'
import { createDocProgram, extractWithComment } from './util.ts'

import type { StateModel } from './generateStateModelDocs.ts'
import type { ExtractedNode } from './util.ts'

// Which untagged MST members a #stateModel page lists, driven through a real
// ts.Program since the rule is about which declarations the model reaches.

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb-model-members-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function extract(source: string) {
  const file = path.join(dir, 'model.ts')
  fs.writeFileSync(file, source)
  const nodes: ExtractedNode[] = []
  extractWithComment(
    createDocProgram([file]),
    node => nodes.push(node),
    () => {},
  )
  return nodes
}

function memberNames(nodes: ExtractedNode[]) {
  return nodes
    .filter(n => n.type !== 'stateModel')
    .map(n => `${n.type} ${n.name}`)
}

test('a model reached only as a property type lends the page no members', () => {
  const nodes = extract(`
    const Tab = types.model('Tab', { viewIds: types.array(types.string) })
    const Base = types.model({ shared: 1 })

    /**
     * #stateModel LayoutMixin
     */
    export function LayoutMixin() {
      return types
        .compose(Base, types.model({ tabs: types.array(Tab) }))
        .views(self => ({
          get count() {
            return self.tabs.length
          },
        }))
    }
  `)
  expect(memberNames(nodes)).toEqual([
    'property shared',
    'property tabs',
    'getter count',
  ])
})

test('a member a later block redefines is one row, with the override’s text', () => {
  const nodes = extract(`
    /**
     * #stateModel WiggleModel
     */
    export function WiggleModel() {
      return types
        .model({})
        .views(() => ({
          /**
           * #getter
           * empty here
           */
          get rules() {
            return []
          },
        }))
        .views(() => ({
          /**
           * #getter
           * the drawn rules
           */
          get rules() {
            return [1]
          },
        }))
    }
  `)
  const byFile: Record<string, StateModel> = {}
  for (const node of nodes) {
    accumulateModel(byFile, node)
  }
  const [model] = Object.values(byFile)
  expect(model!.members.getters.map(m => [m.name, m.docs.trim()])).toEqual([
    ['rules', 'the drawn rules'],
  ])
})
