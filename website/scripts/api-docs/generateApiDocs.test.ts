import fs from 'fs'
import os from 'os'
import path from 'path'

import { createDocProgram, extractWithComment } from './docProgram.ts'
import {
  accumulateApi,
  declarations,
  nameBindingPatterns,
} from './generateApiDocs.ts'

import type { ExtractedNode } from './docProgram.ts'
import type { ApiGroup } from './generateApiDocs.ts'

describe('declarations', () => {
  test('a function type reads as a function declaration', () => {
    expect(declarations('f', '<T>(a: T, b?: number) => Promise<T>')).toBe(
      'function f<T>(a: T, b?: number): Promise<T>',
    )
  })

  test('anything else reads as a const', () => {
    expect(declarations('C', '"#fff"')).toBe('const C: "#fff"')
    expect(declarations('g', '((a: number) => void) | undefined')).toBe(
      'const g: ((a: number) => void) | undefined',
    )
  })

  test('each overload declares on its own line', () => {
    expect(
      declarations('h', '(a: string) => string\n(a: number) => number'),
    ).toBe('function h(a: string): string\nfunction h(a: number): number')
  })
})

describe('nameBindingPatterns', () => {
  test('a destructured parameter reads as a named one', () => {
    expect(
      nameBindingPatterns(
        '(pm: PluginManager, { a, b, }: { a: number; b?: string; }) => void',
      ),
    ).toBe('(pm: PluginManager, opts: { a: number; b?: string; }) => void')
  })

  test('a name the signature already uses is skipped', () => {
    expect(
      nameBindingPatterns(
        '(self: S, { start, end }: RegionLike, opts?: O) => R',
      ),
    ).toBe('(self: S, args: RegionLike, opts?: O) => R')
  })

  test('object types and returns stay as they are', () => {
    const sig = '(a: { b: { c: number }; }) => { d: string; }'
    expect(nameBindingPatterns(sig)).toBe(sig)
  })
})

describe('an #api type', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb-api-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test('prints its declaration without comments', () => {
    const file = path.join(dir, 'api.ts')
    fs.writeFileSync(
      file,
      `/**
 * #api
 * An op.
 */
export interface Op {
  /** which */
  op: 'sum' | 'mean'
  field?: string
}
`,
    )
    const nodes: ExtractedNode[] = []
    extractWithComment(
      createDocProgram([file]),
      node => nodes.push(node),
      () => {},
    )
    expect(nodes.map(n => [n.signature, n.declaresType])).toEqual([
      ["interface Op {\n  op: 'sum' | 'mean';\n  field?: string;\n}", true],
    ])
  })
})

test('an export imports from the entry point that re-exports it', () => {
  const docProgram = createDocProgram([
    'packages/cigar-utils/src/index.ts',
    'packages/cigar-utils/src/mismatchParser.ts',
  ])
  const api: Record<string, ApiGroup> = {}
  extractWithComment(
    docProgram,
    node => {
      accumulateApi(api, node, docProgram.program)
    },
    () => {},
  )
  const importAs = Object.fromEntries(
    Object.values(api)
      .flatMap(g => g.exports)
      .map(e => [e.name, e.importAs]),
  )
  expect(importAs.parseCigar).toEqual({
    specifier: '@jbrowse/cigar-utils',
    name: 'parseCigar',
  })
})
