import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  buildEnumConstantIndex,
  enumConstantValues,
  literalConstantValue,
  numericConstantValue,
  scalarConstantValue,
  slotFieldConstantPairs,
  slotFieldFactoryPairs,
} from './enumConstants.ts'
import { parseSlotMeta } from './slotSource.ts'
import { parseSourceFileSyntactic } from './sourceCorpus.ts'

import type * as ts from 'typescript'

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
    const constants = buildEnumConstantIndex([
      sourceFile(
        'scalar.ts',
        `export const DEFAULT_SCHEME_T1 = 'juicebox'
         const NOT_EXPORTED_T1 = 'still-indexed'`,
      ),
    ])
    expect(scalarConstantValue(constants, 'DEFAULT_SCHEME_T1')).toBe('juicebox')
    // export-ness is irrelevant; the generator resolves by name
    expect(scalarConstantValue(constants, 'NOT_EXPORTED_T1')).toBe(
      'still-indexed',
    )
  })

  test('an unknown name stays unresolved, so the identifier keeps printing', () => {
    expect(
      scalarConstantValue(
        buildEnumConstantIndex([]),
        'NEVER_DECLARED_ANYWHERE',
      ),
    ).toBeUndefined()
  })

  test('a name defined twice with different values is dropped, not guessed', () => {
    const constants = buildEnumConstantIndex([
      sourceFile('dupe-a.ts', `const AMBIGUOUS_T3 = 'one'`),
      sourceFile('dupe-b.ts', `const AMBIGUOUS_T3 = 'two'`),
    ])
    expect(scalarConstantValue(constants, 'AMBIGUOUS_T3')).toBeUndefined()
  })

  test('the same value declared twice still resolves', () => {
    const constants = buildEnumConstantIndex([
      sourceFile('same-a.ts', `const AGREED_T4 = 'x'`),
      sourceFile('same-b.ts', `const AGREED_T4 = 'x'`),
    ])
    expect(scalarConstantValue(constants, 'AGREED_T4')).toBe('x')
  })

  test('a string-array constant is not mistaken for a scalar', () => {
    const constants = buildEnumConstantIndex([
      sourceFile('arr.ts', `export const SCHEMES_T5 = ['a', 'b'] as const`),
    ])
    expect(scalarConstantValue(constants, 'SCHEMES_T5')).toBeUndefined()
    expect(enumConstantValues(constants, 'SCHEMES_T5')).toEqual(['a', 'b'])
  })
})

describe('enumConstantValues, derived constants', () => {
  test('a projection of a tuple table resolves to the tuple heads', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'derived.ts',
        `const TABLE_T9 = [['a', 'A'], ['b', 'B']] as const
         const VALUES_T9 = TABLE_T9.map(([value]) => value)`,
      ),
    ])
    expect(enumConstantValues(constants, 'VALUES_T9')).toEqual(['a', 'b'])
  })

  // A menu option table whose rows carry more than a label — a subLabel, help
  // text — cannot be a pair, so it is objects. The enum still spreads a
  // projection of it, and the values still have to reach the page.
  test('a projection of an object table resolves to the value properties', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'objects.ts',
        `const OPTIONS_T20 = [
           { value: 'a', label: 'A', helpText: 'why a' },
           { value: 'b', label: 'B' },
         ] as const
         const VALUES_T20 = OPTIONS_T20.map(o => o.value)`,
      ),
    ])
    expect(enumConstantValues(constants, 'VALUES_T20')).toEqual(['a', 'b'])
  })

  test('an object table missing a value on one row resolves to nothing', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'objects-partial.ts',
        `const PARTIAL_T21 = [{ value: 'a' }, { label: 'B' }] as const
         const VALUES_T21 = PARTIAL_T21.map(o => o.value)`,
      ),
    ])
    expect(enumConstantValues(constants, 'VALUES_T21')).toBeUndefined()
  })

  test('a flatMap over a grouped table resolves to every inner head', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'grouped.ts',
        `const GROUPS_T10 = [['Group', [['a', 'A'], ['b', 'B']]]] as const
         const VALUES_T10 = GROUPS_T10.flatMap(([, opts]) => opts.map(([v]) => v))`,
      ),
    ])
    expect(enumConstantValues(constants, 'VALUES_T10')).toEqual(['a', 'b'])
  })

  test('an ambiguous source table drops the constant derived from it', () => {
    const constants = buildEnumConstantIndex([
      sourceFile('table-a.ts', `const AMBIG_TABLE_T11 = [['a', 'A']] as const`),
      sourceFile('table-b.ts', `const AMBIG_TABLE_T11 = [['z', 'Z']] as const`),
      sourceFile(
        'table-use.ts',
        `const DERIVED_T11 = AMBIG_TABLE_T11.map(([value]) => value)`,
      ),
    ])
    // the table's own name is ambiguous, and so is anything projected from it —
    // otherwise the projection documents whichever file parsed last
    expect(enumConstantValues(constants, 'AMBIG_TABLE_T11')).toBeUndefined()
    expect(enumConstantValues(constants, 'DERIVED_T11')).toBeUndefined()
  })

  test('the same table declared twice still resolves its derived constant', () => {
    const constants = buildEnumConstantIndex([
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
    expect(enumConstantValues(constants, 'DERIVED_T12')).toEqual(['a'])
  })

  test('a derived name projected from two different tables is dropped', () => {
    const constants = buildEnumConstantIndex([
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
    expect(enumConstantValues(constants, 'DERIVED_T13')).toBeUndefined()
  })

  test('a list spread from other constants and naming a string constant resolves', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'composed-a.ts',
        `const ALL_T21 = [...SOME_T21, 'log', LAST_T21] as const`,
      ),
      sourceFile(
        'composed-b.ts',
        `const SOME_T21 = ['ordinal', 'threshold'] as const
         const LAST_T21 = 'identity'`,
      ),
    ])
    expect(enumConstantValues(constants, 'ALL_T21')).toEqual([
      'ordinal',
      'threshold',
      'log',
      'identity',
    ])
  })

  test('a list under `as const satisfies` resolves', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'satisfies.ts',
        `const MODES_T22 = ['fixed', 'fit'] as const satisfies readonly Mode[]`,
      ),
    ])
    expect(enumConstantValues(constants, 'MODES_T22')).toEqual(['fixed', 'fit'])
  })
})

describe('slotFieldConstantPairs', () => {
  test('a shared slot table resolves to its slots, in declaration order', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'slot-fields.ts',
        `export const WIGGLE_FIELDS_T6 = {
           minScore: { type: 'number', defaultValue: 0 },
           lineWidth: { type: 'number', defaultValue: 1 },
         } as const`,
      ),
    ])
    const pairs = slotFieldConstantPairs(constants, 'WIGGLE_FIELDS_T6')
    expect(pairs?.map(([name]) => name)).toEqual(['minScore', 'lineWidth'])
    expect(pairs?.[1]?.[1]).toContain('defaultValue: 1')
  })

  test('an object of anything other than slots is not a slot table', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'not-slots.ts',
        `const RENDER_OPTS_T7 = { mode: { fast: true }, label: 'x' }
         const NO_SLOT_TYPE_T7 = { color: { defaultValue: 'red' } }`,
      ),
    ])
    expect(slotFieldConstantPairs(constants, 'RENDER_OPTS_T7')).toBeUndefined()
    // every property must look like a slot (have a `type`), or the whole
    // constant is left alone rather than half-documented
    expect(slotFieldConstantPairs(constants, 'NO_SLOT_TYPE_T7')).toBeUndefined()
  })

  test('a name defined twice is dropped rather than guessed at', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'fields-a.ts',
        `const AMBIG_FIELDS_T8 = { a: { type: 'number' } }`,
      ),
      sourceFile(
        'fields-b.ts',
        `const AMBIG_FIELDS_T8 = { b: { type: 'string' } }`,
      ),
    ])
    expect(slotFieldConstantPairs(constants, 'AMBIG_FIELDS_T8')).toBeUndefined()
  })

  // The arc displays' color object shares its field slots as a table of
  // display-kit factory calls, so the table has no literal slot of its own.
  test('a table of factory calls resolves through them, with the call arguments substituted', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'call-table.ts',
        `export function fieldSlot_T16({ field }: { field: string }) {
           return { field: { type: 'string', description: field } } as const
         }
         export function rangeSlot_T16({
           range = 'the default sentence',
         }: {
           range?: string
         }) {
           return { range: { type: 'colorArray', description: range } } as const
         }
         export const COLOR_FIELDS_T16 = {
           ...fieldSlot_T16({ field: 'the field that paints' }),
           ...rangeSlot_T16({}),
         } as const`,
      ),
    ])
    const pairs = slotFieldConstantPairs(constants, 'COLOR_FIELDS_T16')
    expect(pairs?.map(([name]) => name)).toEqual(['field', 'range'])
    expect(pairs?.[0]?.[1]).toContain(`description: 'the field that paints'`)
    expect(pairs?.[1]?.[1]).toContain(`description: 'the default sentence'`)
  })

  test('a table of nothing but slot tables by name is one', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'spread-only.ts',
        `export const TITLE_T18 = { title: { type: 'maybeString' } } as const
         export const DESC_T18 = { descending: { type: 'maybeBoolean' } } as const
         export const LEGEND_T18 = { ...TITLE_T18, ...DESC_T18 }
         export const NOT_SLOTS_T18 = { ...RENDER_OPTS_UNKNOWN_T18 }`,
      ),
    ])
    expect(
      slotFieldConstantPairs(constants, 'LEGEND_T18')?.map(([n]) => n),
    ).toEqual(['title', 'descending'])
    expect(slotFieldConstantPairs(constants, 'NOT_SLOTS_T18')).toBeUndefined()
  })

  // colorDiscreteSchemeSlots rewrites colorRampSlots.scheme's prose and
  // nothing else, so its `type` and `model` arrive through the spread
  test("a slot spreading another table's slot reads as the merged object", () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'member-spread.ts',
        `export const RAMP_T19 = {
           scheme: { type: 'maybeStringEnum', description: 'ramp prose' },
         } as const
         export const DISCRETE_T19 = {
           scheme: { ...RAMP_T19.scheme, description: 'discrete prose' },
         } as const`,
      ),
    ])
    const [[name, source] = []] =
      slotFieldConstantPairs(constants, 'DISCRETE_T19') ?? []
    expect(name).toBe('scheme')
    expect(source).toContain(`type: 'maybeStringEnum'`)
    expect(source).toContain(`description: 'discrete prose'`)
    expect(source).not.toContain('ramp prose')
  })

  test('a table calling something that is not a slot factory is left alone', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'call-not-table.ts',
        `function opts_T17({ mode }: { mode: string }) {
           return { mode }
         }
         export const RENDER_T17 = { ...opts_T17({ mode: 'fast' }) } as const`,
      ),
    ])
    expect(slotFieldConstantPairs(constants, 'RENDER_T17')).toBeUndefined()
  })
})

describe('numericConstantValue', () => {
  test('resolves a numeric constant so a slot default documents the number', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'numeric.ts',
        `export const GROW_CEILING_T9 = 800
         const SEPARATED_T9 = 1_000_000
         const NEGATIVE_T9 = -1`,
      ),
    ])
    expect(numericConstantValue(constants, 'GROW_CEILING_T9')).toBe('800')
    // the author's own source, so a separated literal keeps its separators
    expect(numericConstantValue(constants, 'SEPARATED_T9')).toBe('1_000_000')
    expect(numericConstantValue(constants, 'NEGATIVE_T9')).toBe('-1')
  })

  test('a string constant stays on the string index, so it keeps its quotes', () => {
    const constants = buildEnumConstantIndex([
      sourceFile('numeric-str.ts', `const A_STRING_T10 = 'juicebox'`),
    ])
    expect(numericConstantValue(constants, 'A_STRING_T10')).toBeUndefined()
    expect(scalarConstantValue(constants, 'A_STRING_T10')).toBe('juicebox')
  })

  test('a name defined twice with different numbers is dropped', () => {
    const constants = buildEnumConstantIndex([
      sourceFile('num-a.ts', `const AMBIG_NUM_T11 = 1`),
      sourceFile('num-b.ts', `const AMBIG_NUM_T11 = 2`),
    ])
    expect(numericConstantValue(constants, 'AMBIG_NUM_T11')).toBeUndefined()
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
    const constants = buildEnumConstantIndex([
      sourceFile('factory.ts', factory),
    ])
    const pairs = slotFieldFactoryPairs(
      constants,
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
    const constants = buildEnumConstantIndex([
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
        constants,
        'heightFields_T13',
        new Map([['heightMode', `'Track-sizing strategy'`]]),
      ) ?? []
    expect(source).toContain(`types.enumeration('heightMode',`)
    expect(source).toContain(`description: 'Track-sizing strategy'`)
  })

  test('a function that is not a slot table resolves to nothing', () => {
    const constants = buildEnumConstantIndex([
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
    expect(
      slotFieldFactoryPairs(constants, 'notATable_T14', new Map()),
    ).toBeUndefined()
    // more than the single destructured parameter the substitution understands
    expect(
      slotFieldFactoryPairs(constants, 'twoParams_T14', new Map()),
    ).toBeUndefined()
  })

  test('a positional factory takes its arguments by position', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'positional.ts',
        `export function scaleFields_T20(scaleName: string, prose = 'default prose') {
           return {
             type: {
               type: 'maybeStringEnum',
               model: types.enumeration(scaleName, ['linear']),
               description: prose,
             },
           } as const
         }`,
      ),
    ])
    const [[, source] = []] =
      slotFieldFactoryPairs(
        constants,
        'scaleFields_T20',
        new Map([[0, `'ScaleType'`]]),
      ) ?? []
    expect(source).toContain(`types.enumeration('ScaleType',`)
    expect(source).toContain(`description: 'default prose'`)
  })

  test('an argument no parameter takes resolves nothing', () => {
    const constants = buildEnumConstantIndex([
      sourceFile('factory.ts', factory),
    ])
    expect(
      slotFieldFactoryPairs(
        constants,
        'rowFields_T12',
        new Map([[0, `someObject`]]),
      ),
    ).toBeUndefined()
  })

  test('a name defined twice is dropped rather than guessed at', () => {
    const constants = buildEnumConstantIndex([
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
    expect(
      slotFieldFactoryPairs(constants, 'ambigFactory_T15', new Map()),
    ).toBeUndefined()
  })
})

describe('literalConstantValue', () => {
  // a reference parsed the way the config generator parses a slot's default
  const reference = (text: string) =>
    (sourceFile(`ref-${text}.ts`, text).statements[0] as ts.ExpressionStatement)
      .expression

  test('reads a constant object member, through the constants it names', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'literal.ts',
        `const CANONICAL_T16 = { field: 'tag', tags: ['MANE Select', 'RefSeq Select'] } as const
         export const GLYPH_DEFAULTS_T16: Settings = {
           subParts: 'CDS,UTR',
           impliedUTRs: true,
           field: CANONICAL_T16.field,
           tags: [...CANONICAL_T16.tags, 'extra'],
           color: computeColor(),
         }`,
      ),
    ])
    expect(
      literalConstantValue(constants, reference('GLYPH_DEFAULTS_T16.subParts')),
    ).toBe("'CDS,UTR'")
    expect(
      literalConstantValue(
        constants,
        reference('GLYPH_DEFAULTS_T16.impliedUTRs'),
      ),
    ).toBe('true')
    expect(
      literalConstantValue(constants, reference('GLYPH_DEFAULTS_T16.field')),
    ).toBe("'tag'")
    expect(
      literalConstantValue(constants, reference('GLYPH_DEFAULTS_T16.tags')),
    ).toBe("['MANE Select', 'RefSeq Select', 'extra']")
    // a member that isn't a literal, and so the object as a whole
    expect(
      literalConstantValue(constants, reference('GLYPH_DEFAULTS_T16.color')),
    ).toBeUndefined()
    expect(
      literalConstantValue(constants, reference('GLYPH_DEFAULTS_T16')),
    ).toBeUndefined()
  })

  test('one name written with and without `as const` is one value', () => {
    const constants = buildEnumConstantIndex([
      sourceFile('lit-a.ts', `const FIELDS_T17 = ['start', 'end'] as const`),
      sourceFile(
        'lit-b.ts',
        `const FIELDS_T17: [string, string] = ['start', 'end']`,
      ),
    ])
    expect(literalConstantValue(constants, reference('FIELDS_T17'))).toBe(
      "['start', 'end']",
    )
  })

  test('a name defined twice with different values is dropped', () => {
    const constants = buildEnumConstantIndex([
      sourceFile('lit-c.ts', `const AMBIG_LIT_T18 = { height: 300 }`),
      sourceFile('lit-d.ts', `const AMBIG_LIT_T18 = { height: 200 }`),
    ])
    expect(
      literalConstantValue(constants, reference('AMBIG_LIT_T18.height')),
    ).toBeUndefined()
  })

  test("reads a constant array's element and a copy spread from it", () => {
    const constants = buildEnumConstantIndex([
      sourceFile('lit-e.ts', `const DOMAIN_T19 = [5, 20] as const`),
    ])
    expect(literalConstantValue(constants, reference('DOMAIN_T19[1]'))).toBe(
      '20',
    )
    expect(literalConstantValue(constants, reference('[...DOMAIN_T19]'))).toBe(
      '[5, 20]',
    )
    expect(
      literalConstantValue(constants, reference('DOMAIN_T19[2]')),
    ).toBeUndefined()
  })
})

describe('parseSlotMeta, through the constant index', () => {
  test('a slot written as a shared slot constant reads as that slot', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'slot-ref.ts',
        `const RAMP_T23 = { mid: { type: 'maybeNumber', description: 'the middle' } } as const`,
      ),
    ])
    expect(
      parseSlotMeta('RAMP_T23.mid', { constants, locals: new Map() }),
    ).toEqual({
      type: 'maybeNumber',
      description: 'the middle',
    })
  })

  test('an enumeration over a named list documents its members', () => {
    const constants = buildEnumConstantIndex([
      sourceFile(
        'slot-enum.ts',
        `const UNITS_T24 = ['base', 'codon'] as const`,
      ),
    ])
    expect(
      parseSlotMeta(
        `{ type: 'stringEnum', model: types.enumeration('Unit', UNITS_T24) }`,
        { constants, locals: new Map() },
      ).enumValues,
    ).toEqual(['base', 'codon'])
  })
})
