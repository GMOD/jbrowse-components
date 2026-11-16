import fs from 'fs'
import os from 'os'
import path from 'path'

import { createDocProgram, extractWithComment } from './docProgram.ts'
import { modelAnchor } from './generateSpecKeyDocs.ts'
import {
  MEMBER_KINDS,
  accumulateModel,
  renderModels,
} from './generateStateModelDocs.ts'

import type { ExtractedNode } from './docProgram.ts'
import type { StateModel } from './generateStateModelDocs.ts'

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

// MST resolved from where the packages see it, so a fixture outside the repo
// gets its real types
const MST_IMPORT = `import { types } from '${path.resolve(
  'packages/core/node_modules/@jbrowse/mobx-state-tree/dist/index',
)}'`

function modelsOf(nodes: ExtractedNode[]) {
  const byFile: Record<string, StateModel> = {}
  for (const node of nodes) {
    accumulateModel(byFile, node)
  }
  return byFile
}

function propertyRows(nodes: ExtractedNode[]) {
  const [model] = Object.values(modelsOf(nodes))
  const properties = MEMBER_KINDS.find(k => k.key === 'properties')
  return model?.members.properties.map(m => [
    properties?.memberCode(m),
    m.propertyDefault,
  ])
}

function renderedPage(files: Record<string, string>, name: string) {
  const paths = Object.entries(files).map(([file, source]) => {
    const full = path.join(dir, file)
    fs.writeFileSync(full, source)
    return full
  })
  const nodes: ExtractedNode[] = []
  extractWithComment(
    createDocProgram(paths),
    node => nodes.push(node),
    () => {},
  )
  return renderModels(modelsOf(nodes), new Set()).find(
    r => r.model.header.name === name,
  )?.page
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

// What a snapshot holds and what MST fills in, read off the `types.*`
// combinators: the checker alone prints `IOptionalIType<ISimpleType<number>,
// [undefined]>`
test('a property reads as its instance type and default', () => {
  const nodes = extract(`
    ${MST_IMPORT}
    declare function stored(key: string): boolean
    const zero = 0
    /**
     * #stateModel WindowModel
     */
    export function WindowModel() {
      return types.model({
        /** #property */
        windowStartBp: types.stripDefault(types.number, zero),
        /** #property */
        regions: types.optional(types.frozen<{ refName: string }[]>(), []),
        /** #property */
        type: types.literal('WindowModel') as unknown as string,
        /** #property */
        mode: types.maybe(types.enumeration(['b', 'a'])),
        /** #property */
        names: types.array(types.maybe(types.string)),
        /** #property */
        bpPerPx: 1,
        /** #property */
        shown: types.optional(types.boolean, () => stored('shown')),
      })
    }
  `)
  expect(propertyRows(nodes)).toEqual([
    ['number', '0'],
    ['{ refName: string; }[]', '[]'],
    ['"WindowModel"', undefined],
    ['"a" | "b" | undefined', undefined],
    ['(string | undefined)[]', undefined],
    ['number', '1'],
    ['boolean', "stored('shown')"],
  ])
})

// The row's name cell already carries the name, so the code under it starts at
// the value, as a config slot's does
test("a property whose type cannot be read shows its value's source", () => {
  const nodes = extract(`
    ${MST_IMPORT}
    declare const pluggable: any
    /**
     * #stateModel WindowModel
     */
    export function WindowModel() {
      return types.model({
        /** #property */
        tracks: types.array(pluggable),
      })
    }
  `)
  expect(propertyRows(nodes)).toEqual([['types.array(pluggable)', undefined]])
})

test('a model lists a name once, at its nearest definition of any kind', () => {
  const page = renderedPage(
    {
      'base.ts': `
        ${MST_IMPORT}
        /**
         * #stateModel BaseView
         */
        export function BaseView() {
          return types.model({}).volatile(() => ({
            /** #volatile */
            width: 0,
            /** #volatile */
            problems: [] as string[],
          }))
        }
      `,
      'model.ts': `
        ${MST_IMPORT}
        import { BaseView } from './base'
        /**
         * #stateModel ChildView
         */
        export function ChildView() {
          return types
            .compose(BaseView(), types.model({
              /** #property */
              id: types.identifier,
              /** #property */
              type: types.literal('ChildView'),
            }))
            .views(() => ({
              /** #getter */
              get width() {
                return 1
              },
            }))
        }
      `,
    },
    'ChildView',
  )
  expect(page).toContain('getter-width')
  expect(page).not.toContain('volatile-width')
  expect(page).toContain(
    'Always `"ChildView"`, the name a snapshot selects this model by.',
  )
  expect(page).toContain(
    'The identifier references to this node resolve through. A snapshot must set it.',
  )
  // ChildView declares no volatile, so its inherited volatiles are the
  // section's only content and start open
  expect(page).toContain(
    '<details class="inherited-members" data-pagefind-ignore open>',
  )
})

// The URL parameters page links a key to the row on the declaring model's page,
// so it has to spell that page and that row the way the model page does
test('a spec key links the page id and anchor the model page writes', () => {
  expect(modelAnchor('Track$View', 'windowStartBp')).toBe(
    '/docs/models/trackdollarview#property-windowstartbp',
  )
})
