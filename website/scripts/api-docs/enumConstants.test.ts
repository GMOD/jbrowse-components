import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  buildEnumConstantIndex,
  enumConstantValues,
  scalarConstantValue,
  slotFieldConstantPairs,
} from './enumConstants.ts'

// The index is module-level and additive, so every constant used here carries a
// suffix unique to this file rather than being reset between tests.
let dir: string

function sourceFile(name: string, text: string) {
  const file = path.join(dir, name)
  writeFileSync(file, text)
  return file
}

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'enum-constants-'))
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('scalarConstantValue', () => {
  test('resolves a string constant so a slot default documents its value', () => {
    buildEnumConstantIndex([
      sourceFile(
        'scalar.ts',
        `export const DEFAULT_SCHEME_T1 = 'juicebox'
         const NOT_EXPORTED_T1 = 'still-indexed'`,
      ),
    ])
    expect(scalarConstantValue('DEFAULT_SCHEME_T1')).toBe('juicebox')
    // export-ness is irrelevant; the generator resolves by name
    expect(scalarConstantValue('NOT_EXPORTED_T1')).toBe('still-indexed')
  })

  test('an unknown name stays unresolved, so the identifier keeps printing', () => {
    expect(scalarConstantValue('NEVER_DECLARED_ANYWHERE')).toBeUndefined()
  })

  test('a name defined twice with different values is dropped, not guessed', () => {
    buildEnumConstantIndex([
      sourceFile('dupe-a.ts', `const AMBIGUOUS_T3 = 'one'`),
      sourceFile('dupe-b.ts', `const AMBIGUOUS_T3 = 'two'`),
    ])
    expect(scalarConstantValue('AMBIGUOUS_T3')).toBeUndefined()
  })

  test('the same value declared twice still resolves', () => {
    buildEnumConstantIndex([
      sourceFile('same-a.ts', `const AGREED_T4 = 'x'`),
      sourceFile('same-b.ts', `const AGREED_T4 = 'x'`),
    ])
    expect(scalarConstantValue('AGREED_T4')).toBe('x')
  })

  test('a string-array constant is not mistaken for a scalar', () => {
    buildEnumConstantIndex([
      sourceFile('arr.ts', `export const SCHEMES_T5 = ['a', 'b'] as const`),
    ])
    expect(scalarConstantValue('SCHEMES_T5')).toBeUndefined()
    expect(enumConstantValues('SCHEMES_T5')).toEqual(['a', 'b'])
  })
})

describe('slotFieldConstantPairs', () => {
  test('a shared slot table resolves to its slots, in declaration order', () => {
    buildEnumConstantIndex([
      sourceFile(
        'slot-fields.ts',
        `export const WIGGLE_FIELDS_T6 = {
           minScore: { type: 'number', defaultValue: 0 },
           lineWidth: { type: 'maybeNumber', promotable: true, promotedBase: 1 },
         } as const`,
      ),
    ])
    const pairs = slotFieldConstantPairs('WIGGLE_FIELDS_T6')
    expect(pairs?.map(([name]) => name)).toEqual(['minScore', 'lineWidth'])
    expect(pairs?.[1]?.[1]).toContain('promotable: true')
  })

  test('an object of anything other than slots is not a slot table', () => {
    buildEnumConstantIndex([
      sourceFile(
        'not-slots.ts',
        `const RENDER_OPTS_T7 = { mode: { fast: true }, label: 'x' }
         const NO_SLOT_TYPE_T7 = { color: { defaultValue: 'red' } }`,
      ),
    ])
    expect(slotFieldConstantPairs('RENDER_OPTS_T7')).toBeUndefined()
    // every property must look like a slot (have a `type`), or the whole
    // constant is left alone rather than half-documented
    expect(slotFieldConstantPairs('NO_SLOT_TYPE_T7')).toBeUndefined()
  })

  test('a name defined twice is dropped rather than guessed at', () => {
    buildEnumConstantIndex([
      sourceFile(
        'fields-a.ts',
        `const AMBIG_FIELDS_T8 = { a: { type: 'number' } }`,
      ),
      sourceFile(
        'fields-b.ts',
        `const AMBIG_FIELDS_T8 = { b: { type: 'string' } }`,
      ),
    ])
    expect(slotFieldConstantPairs('AMBIG_FIELDS_T8')).toBeUndefined()
  })
})
