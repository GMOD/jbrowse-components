import {
  exampleObjects,
  missingSlotNames,
  unknownExampleKeys,
} from './generateConfigDocs.ts'

import type { ManifestSlot, TypedManifestEntry } from './generateConfigDocs.ts'

// The rule assertManifestSlotsAreDocumented applies to one runtime slot. Each
// exemption here is a shape that is absent from a page by design; getting one
// wrong is silent in the direction that reads as fact, so they are pinned
// rather than left to the run that happens to notice.
const page = (...names: string[]) => new Set(names)

const slot = (name: string, type = 'string'): ManifestSlot => ({ name, type })

test('a slot with no row is named', () => {
  expect(missingSlotNames(slot('jexlFilters'), page())).toEqual(['jexlFilters'])
  expect(missingSlotNames(slot('jexlFilters'), page('jexlFilters'))).toEqual([])
})

test('the type discriminator is exempt', () => {
  expect(missingSlotNames(slot('type', '"BamAdapter"'), page())).toEqual([])
})

// By manifest type, not by name: HtsgetBamAdapter's `htsgetTrackId` is an
// ordinary string slot that the page does owe a row for.
test('identifier slots are exempt, `Id`-suffixed strings are not', () => {
  expect(missingSlotNames(slot('displayId', 'identifier'), page())).toEqual([])
  expect(missingSlotNames(slot('htsgetTrackId'), page())).toEqual([
    'htsgetTrackId',
  ])
})

describe('a container sub-schema', () => {
  const index: ManifestSlot = {
    name: 'index',
    type: 'BamIndexConfigurationSchema',
    subSlots: [slot('indexType'), slot('location')],
  }

  test('is covered by its own row', () => {
    expect(missingSlotNames(index, page('index'))).toEqual([])
  })

  test('is covered by every child', () => {
    expect(
      missingSlotNames(index, page('index.indexType', 'index.location')),
    ).toEqual([])
  })

  test('names the children it is missing', () => {
    expect(missingSlotNames(index, page('index.indexType'))).toEqual([
      'index.location',
    ])
    expect(missingSlotNames(index, page())).toEqual([
      'index.indexType',
      'index.location',
    ])
  })
})

// assertExampleKeysAreSlots walks an example for objects it can attribute to a
// type. What it reaches decides what gets checked at all, and an object it
// misses is silently unchecked — which is how three display examples came to
// document a key JBrowse drops.
const entry = (
  category: string,
  slots: string[],
  extra: Partial<TypedManifestEntry> = {},
): TypedManifestEntry => ({
  category,
  slots: slots.map(name => slot(name)),
  ...extra,
})

const MANIFEST: Record<string, TypedManifestEntry> = {
  VariantTrack: entry('tracks', ['type', 'trackId', 'adapter', 'displays']),
  ReferenceSequenceTrack: entry('tracks', ['type', 'trackId', 'adapter']),
  LinearVariantDisplay: entry('displays', ['type', 'height'], {
    stateModelProps: ['layout'],
  }),
  ChordVariantDisplay: entry('displays', ['type', 'strokeColor']),
  MultiWiggleAdapter: {
    category: 'adapters',
    slots: [slot('type'), slot('subadapters', '(JexlString | frozen)')],
  },
  BigWigAdapter: entry('adapters', ['type', 'bigWigLocation']),
}

const found = (code: string) =>
  exampleObjects(code, MANIFEST).map(o => o.typeName)

test('a display entry nested in a track example is reached', () => {
  expect(
    found(`{
      type: 'VariantTrack',
      displays: [{ type: 'LinearVariantDisplay', height: 400 }],
    }`),
  ).toEqual(['VariantTrack', 'LinearVariantDisplay'])
})

// The value of a frozen slot passes through no ConfigurationSchema, so
// MultiWiggleAdapter's per-subadapter `name`/`group`/`color` are not the
// subadapter type's to declare and checking them would reject correct docs.
test('the walk stops at a frozen slot', () => {
  expect(
    found(`{
      type: 'MultiWiggleAdapter',
      subadapters: [{ type: 'BigWigAdapter', name: 'a', color: 'red' }],
    }`),
  ).toEqual(['MultiWiggleAdapter'])
})

// ReferenceSequenceTrack's example names its parent key, which is not an
// expression on its own.
test('an example written as a `key: {…}` fragment is still walked', () => {
  expect(
    found(`sequence: { type: 'ReferenceSequenceTrack', trackId: 'refseq' }`),
  ).toEqual(['ReferenceSequenceTrack'])
})

describe('the keys of one example object', () => {
  const displaysOfTrack = new Map([
    ['VariantTrack', ['LinearVariantDisplay', 'ChordVariantDisplay']],
  ])
  const keysOf = (code: string) =>
    exampleObjects(code, MANIFEST).flatMap(o =>
      unknownExampleKeys(o, MANIFEST, displaysOfTrack),
    )

  test('a state-model property is named as one', () => {
    const [[key, why]] = keysOf(
      `{ type: 'VariantTrack', displays: [{ type: 'LinearVariantDisplay', layout: [] }] }`,
    )
    expect(key).toBe('layout')
    expect(why).toMatch(/state-model property/)
  })

  test('a key that is no slot at all reads differently', () => {
    expect(
      keysOf(`{ type: 'ReferenceSequenceTrack', assemblyNames: ['hg38'] }`),
    ).toEqual([['assemblyNames', 'not a slot it declares']])
  })

  // displayDefaults routes each key to whichever display of the track declares
  // it, so a key owned by the track's OTHER display is correct here.
  test('displayDefaults is checked against every display of the track', () => {
    expect(
      keysOf(
        `{ type: 'VariantTrack', displayDefaults: { height: 1, strokeColor: 'red' } }`,
      ),
    ).toEqual([])
    expect(
      keysOf(`{ type: 'VariantTrack', displayDefaults: { nonesuch: 1 } }`),
    ).toEqual([
      [
        'nonesuch',
        'in displayDefaults, and no display of a VariantTrack declares it',
      ],
    ])
  })
})
