import fs from 'fs'
import os from 'os'
import path from 'path'

import { buildEnumConstantIndex } from './enumConstants.ts'
import {
  accumulateConfig,
  exampleObjects,
  looseTrackExample,
  mergeSpreadSlots,
  missingSlotNames,
  unknownExampleKeys,
} from './generateConfigDocs.ts'
import { createDocProgram, extractWithComment } from './util.ts'

import type {
  Config,
  ManifestSlot,
  TypedManifestEntry,
} from './generateConfigDocs.ts'

// The rule assertManifestSlotsAreDocumented applies to one runtime slot. Each
// exemption here is a shape that is absent from a page by design; getting one
// wrong is silent in the direction that reads as fact, so they are pinned
// rather than left to the run that happens to notice.
const page = (...names: string[]) => new Set(names)

const slot = (name: string, type = 'string'): ManifestSlot => ({ name, type })

test('a slot with no row is named', () => {
  expect(missingSlotNames(slot('filter'), page())).toEqual(['filter'])
  expect(missingSlotNames(slot('filter'), page('filter'))).toEqual([])
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
  ChordVariantDisplay: entry('displays', ['type', 'colorHover']),
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
        `{ type: 'VariantTrack', displayDefaults: { height: 1, colorHover: 'red' } }`,
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

describe('the loose { trackId, uri } form of an example', () => {
  const fence = (body: string) => ['```js', body, '```'].join('\n')
  const bam = `{
  type: 'AlignmentsTrack',
  trackId: 'ngs-reads',
  name: 'NGS reads',
  assemblyNames: ['hg38'],
  adapter: { type: 'BamAdapter', uri: 'https://example.com/sample.bam' },
}`

  test("carries the example's own id, uri and assemblies", () => {
    const loose = looseTrackExample(fence(bam))
    expect(loose).toContain('`sample.bam` infers `BamAdapter`')
    expect(loose).toContain("trackId: 'ngs-reads',")
    expect(loose).toContain("uri: 'https://example.com/sample.bam',")
    expect(loose).toContain("assemblyNames: ['hg38'],")
  })

  // The formats table decides, not the page: a name it routes elsewhere gets no
  // loose form, or the page would promise an inference that lands on another
  // adapter. `.bed.gz` is BedTabixAdapter's, deliberately left off GWAS.
  test("needs the file name to reach the page's own adapter", () => {
    expect(
      looseTrackExample(fence(bam.replace('sample.bam', 'x.bed.gz'))),
    ).toBe('')
    expect(
      looseTrackExample(
        fence(
          bam
            .replace('AlignmentsTrack', 'GWASTrack')
            .replace('BamAdapter', 'GWASAdapter')
            .replace('sample.bam', 'stats.bed.gz'),
        ),
      ),
    ).toBe('')
  })

  // A `.bedmethyl.gz` and a plain `.bed.gz` share BedTabixAdapter and are drawn
  // differently, so the file name has to reach the page's track type too — the
  // loose form of a FeatureTrack over one would open as a MultiQuantitativeTrack.
  test("needs it to reach the page's track type", () => {
    const bed = bam
      .replace('AlignmentsTrack', 'FeatureTrack')
      .replace('BamAdapter', 'BedTabixAdapter')
    expect(
      looseTrackExample(fence(bed.replace('sample.bam', 'x.bed.gz'))),
    ).not.toBe('')
    expect(
      looseTrackExample(fence(bed.replace('sample.bam', 'x.bedmethyl.gz'))),
    ).toBe('')
  })

  // Whatever the guessers do not rebuild from the file name is lost by writing
  // the track loose, so an example holding any of it keeps its full form alone.
  test('refuses an example whose keys it would drop', () => {
    expect(
      looseTrackExample(
        fence(
          bam.replace(
            "  adapter: { type: 'BamAdapter', uri: 'https://example.com/sample.bam' },",
            "  adapter: { type: 'BamAdapter', uri: 'https://example.com/sample.bam' },\n  displayDefaults: { height: 100 },",
          ),
        ),
      ),
    ).toBe('')
    expect(
      looseTrackExample(
        fence(bam.replace("sample.bam' }", "sample.bam', csi: true }")),
      ),
    ).toBe('')
    expect(
      looseTrackExample(fence(bam.replace("  assemblyNames: ['hg38'],\n", ''))),
    ).toBe('')
  })
})

// A schema composing a kit's slots keeps its page: a `#slot` section in the
// spread's JSDoc documents that slot at the spread's position.
describe('slots a spread brings in', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb-spread-slots-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const KIT = `
export function spreadKitPairT1({ alpha = 'kit alpha' }: { alpha?: string }) {
  return {
    alpha: { type: 'string', defaultValue: '', description: alpha },
    beta: { type: 'number', defaultValue: 1, description: 'kit beta' },
  } as const
}
export function spreadKitTailT1({ gamma = 'kit gamma' }: { gamma?: string }) {
  return {
    gamma: { type: 'boolean', defaultValue: false, description: gamma },
  } as const
}
`

  const schema = (spreadDoc: string[]) => `
/**
 * #config SpreadFixture
 */
export const spreadFixture = ConfigurationSchema('SpreadFixture', {
  /**
   * #slot first
   * Written in place.
   */
  first: { type: 'string', defaultValue: '' },
  /**
${spreadDoc.map(line => `   * ${line}`).join('\n')}
   */
  ...spreadKitPairT1({ alpha: 'passed alpha' }),
  /**
   * #slot last
   * Also written in place.
   */
  last: { type: 'string', defaultValue: '' },
  ...spreadKitTailT1({}),
})
`

  function slotsOf(spreadDoc: string[]) {
    const files = ['kit.ts', 'schema.ts'].map(name => path.join(dir, name))
    fs.writeFileSync(files[0]!, KIT)
    fs.writeFileSync(files[1]!, schema(spreadDoc))
    const program = createDocProgram(files)
    buildEnumConstantIndex(program.sources)
    const byFile: Record<string, Config> = {}
    extractWithComment(
      program,
      obj => {
        accumulateConfig(byFile, obj)
      },
      () => {},
    )
    mergeSpreadSlots(byFile)
    return Object.values(byFile).flatMap(c => c.slots)
  }

  test('render where the spread sits, with their section prose', () => {
    const slots = slotsOf([
      '#slot alpha',
      "Alpha's page prose.",
      '',
      '#slot beta',
      "Beta's page prose.",
    ])
    expect(slots.map(s => s.name)).toEqual([
      'first',
      'alpha',
      'beta',
      'last',
      'gamma',
    ])
    const [, alpha, beta, , gamma] = slots
    expect(alpha!.docs.trim()).toBe("Alpha's page prose.")
    expect(alpha!.code).toContain("description: 'passed alpha'")
    expect(beta!.docs.trim()).toBe("Beta's page prose.")
    expect(gamma!.docs).toBe('')
  })

  test('a slot the JSDoc leaves out follows the literal ones', () => {
    expect(slotsOf(['#slot alpha', 'Alpha only.']).map(s => s.name)).toEqual([
      'first',
      'alpha',
      'last',
      'beta',
      'gamma',
    ])
  })

  test('a section naming a slot the spread does not bring in fails', () => {
    expect(() => slotsOf(['#slot delta', 'No such slot.'])).toThrow(
      /schema\.ts: the JSDoc on `\.\.\.spreadKitPairT1.*#slot delta.*alpha, beta/,
    )
  })

  test('prose before the first section fails', () => {
    expect(() => slotsOf(['Whose?', '#slot alpha', 'Alpha.'])).toThrow(
      /schema\.ts: .*prose before its first `#slot`/,
    )
  })
})
