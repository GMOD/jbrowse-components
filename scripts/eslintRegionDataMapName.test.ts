import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'

import { regionDataMapNamesItsField } from './eslintRegionDataMapName.ts'

// The gate itself was previously proved by hand — point a field at another
// field's name, watch the message, revert. That proof does not survive the
// commit that breaks it, which is the whole objection to a check nothing
// checks. These run the rule against the shapes it has to see and the shapes it
// has to ignore, including the two the scope resolution exists for.

const IMPORT =
  "import { regionDataMap } from '@jbrowse/render-core/regionDataMap'\n"

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  },
})

ruleTester.run('region-data-map-names-its-field', regionDataMapNamesItsField, {
  valid: [
    {
      name: 'the name matches the field',
      code: `${IMPORT}const v = { rpcDataMap: regionDataMap<Data>('rpcDataMap') }`,
    },
    {
      name: 'a type argument does not hide the call',
      code: `${IMPORT}const v = { flatbushes: regionDataMap<Flatbush>('flatbushes') }`,
    },
    {
      name: 'a local const names itself, so there is no field to compare',
      code: `${IMPORT}const stored = regionDataMap<Data>('rpcDataMap')`,
    },
    {
      name: 'an unrelated function of the same name is not this one',
      code: "function regionDataMap(n) { return n }\nconst v = { a: regionDataMap('b') }",
    },
    {
      name: 'a computed key has no static name to compare against',
      code: `${IMPORT}const v = { [k]: regionDataMap<Data>('rpcDataMap') }`,
    },
  ],
  invalid: [
    {
      name: 'a copy-pasted name reports the wrong map, and is fixed to the field',
      code: `${IMPORT}const v = { summaryDataMap: regionDataMap<Data>('rpcDataMap') }`,
      output: `${IMPORT}const v = { summaryDataMap: regionDataMap<Data>('summaryDataMap') }`,
      errors: [
        {
          messageId: 'mismatch',
          data: { key: 'summaryDataMap', name: 'rpcDataMap' },
        },
      ],
    },
    {
      // The scope resolution earns its keep here: matching `callee.name` alone
      // would go silent on this, which is a gate you leave by writing ordinary
      // code.
      name: 'an aliased import is still the same function',
      code: "import { regionDataMap as perRegionMap } from '@jbrowse/render-core/regionDataMap'\nconst v = { flatbushes: perRegionMap<Flatbush>('rpcDataMap') }",
      output:
        "import { regionDataMap as perRegionMap } from '@jbrowse/render-core/regionDataMap'\nconst v = { flatbushes: perRegionMap<Flatbush>('flatbushes') }",
      errors: [
        {
          messageId: 'mismatch',
          data: { key: 'flatbushes', name: 'rpcDataMap' },
        },
      ],
    },
    {
      name: 'a non-literal name cannot be checked, and is not a name',
      code: `${IMPORT}const v = { rpcDataMap: regionDataMap<Data>(someName) }`,
      errors: [{ messageId: 'notLiteral', data: { key: 'rpcDataMap' } }],
    },
    {
      name: 'a missing name is the anonymous message the parameter exists to remove',
      code: `${IMPORT}const v = { rpcDataMap: regionDataMap<Data>() }`,
      errors: [{ messageId: 'notLiteral', data: { key: 'rpcDataMap' } }],
    },
  ],
})
