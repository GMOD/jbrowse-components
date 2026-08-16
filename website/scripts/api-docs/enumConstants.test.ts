import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  buildEnumConstantIndex,
  enumConstantValues,
  numericConstantValue,
  scalarConstantValue,
  slotFieldConstantPairs,
  slotFieldFactoryPairs,
} from './enumConstants.ts'
import { parseSourceFileSyntactic } from './util.ts'

// The index is module-level and additive, so every constant used here carries a
// suffix unique to this file rather than being reset between tests.
let dir: string

// The index reads parsed trees (the generator hands it the shared program's),
// so a test fixture is written to disk and parsed the same way.
function sourceFile(name: string, text: string) {
  const file = path.join(dir, name)
  writeFileSync(file, text)
  return parseSourceFileSyntactic(file)
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

describe('enumConstantValues, derived constants', () => {
  test('a projection of a tuple table resolves to the tuple heads', () => {
    buildEnumConstantIndex([
      sourceFile(
        'derived.ts',
        `const TABLE_T9 = [['a', 'A'], ['b', 'B']] as const
         const VALUES_T9 = TABLE_T9.map(([value]) => value)`,
      ),
    ])
    expect(enumConstantValues('VALUES_T9')).toEqual(['a', 'b'])
  })

  test('a flatMap over a grouped table resolves to every inner head', () => {
    buildEnumConstantIndex([
      sourceFile(
        'grouped.ts',
        `const GROUPS_T10 = [['Group', [['a', 'A'], ['b', 'B']]]] as const
         const VALUES_T10 = GROUPS_T10.flatMap(([, opts]) => opts.map(([v]) => v))`,
      ),
    ])
    expect(enumConstantValues('VALUES_T10')).toEqual(['a', 'b'])
  })

  test('an ambiguous source table drops the constant derived from it', () => {
    buildEnumConstantIndex([
      sourceFile('table-a.ts', `const AMBIG_TABLE_T11 = [['a', 'A']] as const`),
      sourceFile('table-b.ts', `const AMBIG_TABLE_T11 = [['z', 'Z']] as const`),
      sourceFile(
        'table-use.ts',
        `const DERIVED_T11 = AMBIG_TABLE_T11.map(([value]) => value)`,
      ),
    ])
    // the table's own name is ambiguous, and so is anything projected from it —
    // otherwise the projection documents whichever file parsed last
    expect(enumConstantValues('AMBIG_TABLE_T11')).toBeUndefined()
    expect(enumConstantValues('DERIVED_T11')).toBeUndefined()
  })

  test('the same table declared twice still resolves its derived constant', () => {
    buildEnumConstantIndex([
      sourceFile(
        'agree-a.ts',
        `const AGREED_TABLE_T12 = [['a', 'A']] as const`,
      ),
      sourceFile(
        'agree-b.ts',
        `const AGREED_TABLE_T12 = [
           ['a', 'A'],
         ] as const`,
      ),
      sourceFile(
        'agree-use.ts',
        `const DERIVED_T12 = AGREED_TABLE_T12.map(([value]) => value)`,
      ),
    ])
    // formatting differs, values don't — comparing projections rather than
    // source text keeps this resolving
    expect(enumConstantValues('DERIVED_T12')).toEqual(['a'])
  })

  test('a derived name projected from two different tables is dropped', () => {
    buildEnumConstantIndex([
      sourceFile(
        'two-src-a.ts',
        `const LEFT_T13 = [['a', 'A']] as const
         const DERIVED_T13 = LEFT_T13.map(([value]) => value)`,
      ),
      sourceFile(
        'two-src-b.ts',
        `const RIGHT_T13 = [['z', 'Z']] as const
         const DERIVED_T13 = RIGHT_T13.map(([value]) => value)`,
      ),
    ])
    expect(enumConstantValues('DERIVED_T13')).toBeUndefined()
  })
})

describe('slotFieldConstantPairs', () => {
  test('a shared slot table resolves to its slots, in declaration order', () => {
    buildEnumConstantIndex([
      sourceFile(
        'slot-fields.ts',
        `export const WIGGLE_FIELDS_T6 = {
           minScore: { type: 'number', defaultValue: 0 },
           lineWidth: { type: 'maybeNumber', promotedBase: 1 },
         } as const`,
      ),
    ])
    const pairs = slotFieldConstantPairs('WIGGLE_FIELDS_T6')
    expect(pairs?.map(([name]) => name)).toEqual(['minScore', 'lineWidth'])
    expect(pairs?.[1]?.[1]).toContain('promotedBase: 1')
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

describe('numericConstantValue', () => {
  test('resolves a numeric constant so a slot default documents the number', () => {
    buildEnumConstantIndex([
      sourceFile(
        'numeric.ts',
        `export const GROW_CEILING_T9 = 800
         const SEPARATED_T9 = 1_000_000
         const NEGATIVE_T9 = -1`,
      ),
    ])
    expect(numericConstantValue('GROW_CEILING_T9')).toBe('800')
    // the author's own source, so a separated literal keeps its separators
    expect(numericConstantValue('SEPARATED_T9')).toBe('1_000_000')
    expect(numericConstantValue('NEGATIVE_T9')).toBe('-1')
  })

  test('a string constant stays on the string index, so it keeps its quotes', () => {
    buildEnumConstantIndex([
      sourceFile('numeric-str.ts', `const A_STRING_T10 = 'juicebox'`),
    ])
    expect(numericConstantValue('A_STRING_T10')).toBeUndefined()
    expect(scalarConstantValue('A_STRING_T10')).toBe('juicebox')
  })

  test('a name defined twice with different numbers is dropped', () => {
    buildEnumConstantIndex([
      sourceFile('num-a.ts', `const AMBIG_NUM_T11 = 1`),
      sourceFile('num-b.ts', `const AMBIG_NUM_T11 = 2`),
    ])
    expect(numericConstantValue('AMBIG_NUM_T11')).toBeUndefined()
  })
})

describe('slotFieldFactoryPairs', () => {
  // The shape both in-tree factories use: one destructured parameter whose
  // properties are the descriptions, and a body that is a single return.
  const factory = `export function rowFields_T12({
      tree,
      branchLength = 'the shared sentence',
    }: {
      tree: string
      branchLength?: string
    }) {
      return {
        showTree: { type: 'boolean', defaultValue: true, description: tree },
        showBranchLength: {
          type: 'boolean',
          defaultValue: true,
          description: branchLength,
        },
      } as const
    }`

  test("a call site's arguments become the slots' descriptions", () => {
    buildEnumConstantIndex([sourceFile('factory.ts', factory)])
    const pairs = slotFieldFactoryPairs(
      'rowFields_T12',
      new Map([['tree', `'show the species tree sidebar'`]]),
    )
    expect(pairs?.map(([name]) => name)).toEqual([
      'showTree',
      'showBranchLength',
    ])
    expect(pairs?.[0]?.[1]).toContain(
      `description: 'show the species tree sidebar'`,
    )
    // a parameter the call omits falls back to the default the factory declares,
    // which for a display-independent sentence is the only way it is ever read
    expect(pairs?.[1]?.[1]).toContain(`description: 'the shared sentence'`)
  })

  test('substitution is by AST position, so a matching string literal survives', () => {
    // `heightMode` is both a parameter and the enum's own name inside the same
    // slot. A textual substitution rewrites the second one too, replacing the
    // enum name with a paragraph of prose.
    buildEnumConstantIndex([
      sourceFile(
        'collide.ts',
        `export function heightFields_T13({ heightMode }: { heightMode: string }) {
           return {
             heightMode: {
               type: 'maybeStringEnum',
               model: types.enumeration('heightMode', [...HEIGHT_MODE_VALUES]),
               description: heightMode,
             },
           } as const
         }`,
      ),
    ])
    const [[, source] = []] =
      slotFieldFactoryPairs(
        'heightFields_T13',
        new Map([['heightMode', `'Track-sizing strategy'`]]),
      ) ?? []
    expect(source).toContain(`types.enumeration('heightMode',`)
    expect(source).toContain(`description: 'Track-sizing strategy'`)
  })

  test('a function that is not a slot table resolves to nothing', () => {
    buildEnumConstantIndex([
      sourceFile(
        'not-factory.ts',
        `export function notATable_T14({ a }: { a: string }) {
           return { label: a }
         }
         export function twoParams_T14({ a }: { a: string }, b: number) {
           return { x: { type: 'number', description: a, defaultValue: b } }
         }`,
      ),
    ])
    // no property carries a `type`, so it is not slot-shaped
    expect(slotFieldFactoryPairs('notATable_T14', new Map())).toBeUndefined()
    // more than the single destructured parameter the substitution understands
    expect(slotFieldFactoryPairs('twoParams_T14', new Map())).toBeUndefined()
  })

  test('a name defined twice is dropped rather than guessed at', () => {
    buildEnumConstantIndex([
      sourceFile(
        'factory-a.ts',
        `export function ambigFactory_T15({ a }: { a: string }) {
           return { x: { type: 'number', description: a } }
         }`,
      ),
      sourceFile(
        'factory-b.ts',
        `export function ambigFactory_T15({ a }: { a: string }) {
           return { y: { type: 'string', description: a } }
         }`,
      ),
    ])
    expect(slotFieldFactoryPairs('ambigFactory_T15', new Map())).toBeUndefined()
  })
})
