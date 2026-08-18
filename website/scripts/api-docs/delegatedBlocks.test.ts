import fs from 'fs'
import os from 'os'
import path from 'path'

import { createDocProgram, extractWithComment } from './util.ts'

import type { ExtractedNode } from './util.ts'

// A model file's members are bucketed by the FILE they are written in, and a
// bucket with no #stateModel header is dropped without a word. So moving a
// `.views()` block to a sibling module used to delete every row it declared
// from the model's page — which is what kept the display models one file each,
// however much of them is config-slot plumbing. These pin the follow that makes
// the move safe, and the fatal that catches a move it cannot follow.
//
// Driven through a real `ts.Program` over real files: the whole mechanism is
// symbol resolution across a module boundary, and a structural stand-in for the
// checker would be asserting on itself.

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb-delegated-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function write(name: string, source: string) {
  const file = path.join(dir, name)
  fs.writeFileSync(file, source)
  return file
}

function extract(files: string[]) {
  const nodes: ExtractedNode[] = []
  extractWithComment(
    createDocProgram(files),
    node => nodes.push(node),
    () => {},
  )
  return nodes
}

// name + kind + which file the row was attributed to, which is the only part of
// an ExtractedNode this mechanism decides.
function members(nodes: ExtractedNode[]) {
  return nodes
    .filter(n => n.type !== 'stateModel')
    .map(n => `${n.type} ${n.name} @ ${path.basename(n.filename)}`)
}

const HEADER = `
/**
 * #stateModel WidgetModel
 */
`

test('a delegated .views() block lands on the model page, in chain position', () => {
  const helper = write(
    'sharedViews.ts',
    `export function sharedViews(self: { a: number }) {
       return {
         /**
          * #getter
          */
         get second() {
           return self.a
         },
       }
     }`,
  )
  const model = write(
    'model.ts',
    `import { sharedViews } from './sharedViews.ts'
     ${HEADER}
     export function WidgetModel() {
       return types
         .model({})
         .views(() => ({
           /**
            * #getter
            */
           get first() {
             return 1
           },
         }))
         .views(sharedViews)
         .views(() => ({
           /**
            * #getter
            */
           get third() {
             return 3
           },
         }))
     }`,
  )

  // `second` is written in sharedViews.ts and attributed to model.ts — without
  // that it renders on no page at all — and it sits between its neighbours,
  // because a model page's tables are in source order.
  expect(members(extract([model, helper]))).toEqual([
    'getter first @ model.ts',
    'getter second @ model.ts',
    'getter third @ model.ts',
  ])
})

test('the extracted model documents exactly what the inline one did', () => {
  const inline = write(
    'inline.ts',
    `${HEADER}
     export function WidgetModel() {
       return types.model({}).views(() => ({
         /**
          * #getter
          * How many rows fit.
          */
         get rowCount() {
           return 2
         },
       }))
     }`,
  )
  const helper = write(
    'extractedViews.ts',
    `export function extractedViews() {
       return {
         /**
          * #getter
          * How many rows fit.
          */
         get rowCount() {
           return 2
         },
       }
     }`,
  )
  const extracted = write(
    'extracted.ts',
    `import { extractedViews } from './extractedViews.ts'
     ${HEADER}
     export function WidgetModel() {
       return types.model({}).views(extractedViews)
     }`,
  )

  const one = extract([inline]).filter(n => n.type === 'getter')
  const two = extract([extracted, helper]).filter(n => n.type === 'getter')
  expect(two.map(n => [n.type, n.name, n.comment])).toEqual(
    one.map(n => [n.type, n.name, n.comment]),
  )
})

test('an untagged delegated member is still recovered structurally', () => {
  const helper = write(
    'plainViews.ts',
    `export const plainViews = () => ({
       get untagged() {
         return 1
       },
     })`,
  )
  const model = write(
    'model.ts',
    `import { plainViews } from './plainViews.ts'
     ${HEADER}
     export function WidgetModel() {
       return types.model({}).views(plainViews)
     }`,
  )
  expect(members(extract([model, helper]))).toEqual([
    'getter untagged @ model.ts',
  ])
})

test('an action block delegates the same way, and lifecycle hooks stay out', () => {
  const helper = write(
    'sharedActions.ts',
    `export function sharedActions(self: { a: number }) {
       return {
         setA(n: number) {
           self.a = n
         },
         afterAttach() {},
       }
     }`,
  )
  const model = write(
    'model.ts',
    `import { sharedActions } from './sharedActions.ts'
     ${HEADER}
     export function WidgetModel() {
       return types.model({}).actions(sharedActions)
     }`,
  )
  expect(members(extract([model, helper]))).toEqual(['action setA @ model.ts'])
})

// The block is delegated to from inside the model's own file, so the tag pass
// reaches the same declaration on its own. One row, not two.
test('a block delegated within its own file is emitted once', () => {
  const model = write(
    'model.ts',
    `${HEADER}
     const localViews = () => ({
       /**
        * #getter
        */
       get once() {
         return 1
       },
     })
     export function WidgetModel() {
       return types.model({}).views(localViews)
     }`,
  )
  expect(members(extract([model]))).toEqual(['getter once @ model.ts'])
})

test('a shared block reached by two models lands on both pages', () => {
  const helper = write(
    'sharedViews.ts',
    `export function sharedViews() {
       return {
         /**
          * #getter
          */
         get shared() {
           return 1
         },
       }
     }`,
  )
  const one = write(
    'one.ts',
    `import { sharedViews } from './sharedViews.ts'
     /**
      * #stateModel OneModel
      */
     export function OneModel() {
       return types.model({}).views(sharedViews)
     }`,
  )
  const two = write(
    'two.ts',
    `import { sharedViews } from './sharedViews.ts'
     /**
      * #stateModel TwoModel
      */
     export function TwoModel() {
       return types.model({}).views(sharedViews)
     }`,
  )
  expect(members(extract([one, two, helper])).sort()).toEqual([
    'getter shared @ one.ts',
    'getter shared @ two.ts',
  ])
})

// A block needing an argument beyond `self` is written as a factory call. It
// resolves, because making the natural shape of an extracted block fatal while
// encouraging extraction would be the worst of both.
test('a factory call returning the callback resolves', () => {
  const helper = write(
    'makeViews.ts',
    `export function makeViews(label: string) {
       return () => ({
         /**
          * #getter
          */
         get made() {
           return label
         },
       })
     }`,
  )
  const model = write(
    'model.ts',
    `import { makeViews } from './makeViews.ts'
     ${HEADER}
     export function WidgetModel() {
       return types.model({}).views(makeViews('x'))
     }`,
  )
  expect(members(extract([model, helper]))).toEqual(['getter made @ model.ts'])
})

// The delegation says where the MEMBER rows go and nothing about any other home
// a node has. Dropping the whole node would take the #api entry with it.
test('a node also carrying a page-level tag keeps that tag', () => {
  const helper = write(
    'sharedViews.ts',
    `export function sharedViews() {
       return {
         /**
          * #getter
          * #api
          */
         get dual() {
           return 1
         },
       }
     }`,
  )
  const model = write(
    'model.ts',
    `import { sharedViews } from './sharedViews.ts'
     ${HEADER}
     export function WidgetModel() {
       return types.model({}).views(sharedViews)
     }`,
  )
  const nodes = extract([model, helper]).filter(n => n.type !== 'stateModel')
  // the getter row on the model's page, and the #api entry still in its own file
  expect(
    nodes.map(n => `${n.type} @ ${path.basename(n.filename)}`).sort(),
  ).toEqual([
    'api @ sharedViews.ts',
    'getter @ model.ts',
    'getter @ sharedViews.ts',
  ])
})

// The case the fatal exists for: the generator can see that the block holds
// members and cannot see which, so every row would be dropped in silence.
test('a delegation that cannot be resolved is fatal, and names the call', () => {
  const model = write(
    'model.ts',
    `${HEADER}
     export function WidgetModel(hook: any) {
       return types.model({}).views(hook)
     }`,
  )
  expect(() => extract([model])).toThrow(/\.views\(hook\)/)
})

// An inline callback the structural pass merely finds nothing in keeps its
// existing non-fatal treatment: there is no named declaration to point at, so
// the error would have nothing actionable in it.
test('an inline callback that yields no object literal is not fatal', () => {
  const model = write(
    'model.ts',
    `${HEADER}
     export function WidgetModel() {
       return types.model({}).views(() => {
         return undefined as any
       })
     }`,
  )
  expect(() => extract([model])).not.toThrow()
})

test('a member tag no model claims is reported, and a delegated one is not', () => {
  const orphan = write(
    'orphan.ts',
    `export function OrphanModel() {
       return types.model({}).views(() => ({
         /**
          * #getter
          */
         get stranded() {
           return 1
         },
       }))
     }`,
  )
  const helper = write(
    'sharedViews.ts',
    `export function sharedViews() {
       return {
         /**
          * #getter
          */
         get claimed() {
           return 1
         },
       }
     }`,
  )
  const model = write(
    'model.ts',
    `import { sharedViews } from './sharedViews.ts'
     ${HEADER}
     export function WidgetModel() {
       return types.model({}).views(sharedViews)
     }`,
  )
  const { orphanMembers } = extractWithComment(
    createDocProgram([model, helper, orphan]),
    () => {},
    () => {},
  )
  expect(orphanMembers.map(s => s.split('/').pop())).toEqual([
    'orphan.ts stranded',
  ])
})
