/**
 * @jest-environment node
 */
import { configJsonSchema } from './configSchema.generated.ts'
import { displayDefaultsForTrackType } from './displayDefaultKeys.ts'
import { misnamedByTitle } from './misnamed.ts'
import { createSchemaValidator } from './schemaValidate.ts'
import { didYouMeanKey, slotsDeclarePath, suggestKey } from './suggest.ts'

import type { ConfigManifest, TypeGroup } from './types.ts'

function manifestOf(tracks: TypeGroup, displays: TypeGroup): ConfigManifest {
  return {
    adapters: {},
    tracks,
    displays,
    textSearchAdapters: {},
    connections: {},
    internetAccounts: {},
    views: {},
    migratedDisplayKeys: {},
  }
}

const rowsManifest = manifestOf(
  { RowsTrack: { slots: [], displayTypes: ['RowsDisplay'] } },
  {
    RowsDisplay: {
      slots: [
        {
          name: 'rows',
          type: 'RowsWithStepConfigSchema',
          schema: 'RowsWithStep',
          subSlots: [{ name: 'step', type: 'number' }],
          misnamed: { height: 'step' },
        },
      ],
      misnamed: { rowHeight: 'rows.step' },
    },
  },
)

test('a misnamed word names its target before edit distance', () => {
  expect(suggestKey('height', ['step', 'weight'], { height: 'step' })).toBe(
    '"step"',
  )
  expect(didYouMeanKey('rowHeight', ['rows'], { rowHeight: 'rows.step' })).toBe(
    ' — did you mean "rows.step"?',
  )
})

test('a word that could mean two paths names both', () => {
  expect(
    didYouMeanKey('rowColor', ['rows'], {
      rowColor: ['rows.colors', 'rows.color'],
    }),
  ).toBe(' — did you mean "rows.colors" or "rows.color"?')
})

test('a key misnamed nowhere falls back to edit distance', () => {
  expect(suggestKey('heigth', ['height'], { rowHeight: 'rows.step' })).toBe(
    '"height"',
  )
  expect(didYouMeanKey('toString', ['step'])).toBe('')
})

test('a dotted key naming a declared path is spelled nested', () => {
  const declares = (members: readonly string[]) =>
    slotsDeclarePath(rowsManifest.displays.RowsDisplay!.slots, members)
  expect(didYouMeanKey('rows.step', ['rows'], {}, declares)).toBe(
    ' — did you mean "rows: { step }"?',
  )
  expect(suggestKey('rows.stpe', ['rows'], {}, declares)).toBeUndefined()
  expect(suggestKey('rows.step', ['rows'])).toBeUndefined()
})

test('the words sit under each title the JSON schema reports them against', () => {
  const byTitle = misnamedByTitle(rowsManifest)
  expect(byTitle.get('RowsDisplay')).toEqual({ rowHeight: 'rows.step' })
  expect(byTitle.get('RowsDisplayTrackEntry')).toEqual({
    rowHeight: 'rows.step',
  })
  expect(byTitle.get('RowsTrackDisplayDefaults')).toEqual({
    rowHeight: 'rows.step',
  })
  expect(byTitle.get('RowsWithStep')).toEqual({ height: 'step' })
})

test('a row display points a top-level axis at rows.axis', () => {
  const byTitle = misnamedByTitle()
  for (const display of [
    'LinearWiggleDisplay',
    'LinearMarkDisplay',
    'LinearMultiRowFeatureDisplay',
    'LinearMafDisplay',
    'LinearVariantDisplay',
  ]) {
    expect([display, byTitle.get(display)?.axis]).toEqual([
      display,
      'rows.axis',
    ])
  }
  expect(byTitle.get('MultiWaySyntenyDisplay')?.axis).toBeUndefined()
})

test("a track's displayDefaults carries its displays' words", () => {
  expect(
    displayDefaultsForTrackType('RowsTrack', rowsManifest).misnamed,
  ).toEqual({ rowHeight: 'rows.step' })
})

describe('the JSON schema report', () => {
  const validator = createSchemaValidator(
    configJsonSchema,
    misnamedByTitle(
      manifestOf(
        {
          AlignmentsTrack: {
            slots: [],
            displayTypes: ['LinearAlignmentsDisplay'],
          },
        },
        {
          LinearAlignmentsDisplay: {
            slots: [],
            misnamed: { thickness: 'height' },
          },
        },
      ),
    ),
  )

  function configWith(track: Record<string, unknown>) {
    return {
      assemblies: [
        {
          name: 'hg38',
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'hg38-ref',
            adapter: { type: 'BgzipFastaAdapter', uri: 'hg38.fa.gz' },
          },
        },
      ],
      tracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'sample_bam',
          name: 'Sample',
          assemblyNames: ['hg38'],
          adapter: { type: 'BamAdapter', uri: 'sample.bam' },
          ...track,
        },
      ],
    }
  }

  test('names the misnamed target on a display entry', () => {
    const [error] = validator.schemaProblems(
      configWith({
        displays: [{ type: 'LinearAlignmentsDisplay', thickness: 3 }],
      }),
    )
    expect(error?.where).toBe('tracks[0].displays[0].thickness')
    expect(error?.message).toMatch(
      /^unknown slot "thickness" — did you mean "height"\? — LinearAlignmentsDisplay takes /,
    )
  })

  test("names it in a track's displayDefaults", () => {
    const [error] = validator.schemaProblems(
      configWith({ displayDefaults: { thickness: 3 } }),
    )
    expect(error?.where).toBe('tracks[0].displayDefaults.thickness')
    expect(error?.message).toBe(
      'no display of this track declares "thickness" — did you mean "height"?',
    )
  })
})

describe('a dotted key in the JSON schema report', () => {
  const validator = createSchemaValidator(configJsonSchema)

  function configWith(track: Record<string, unknown>) {
    return {
      assemblies: [
        {
          name: 'hg38',
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'hg38-ref',
            adapter: { type: 'BgzipFastaAdapter', uri: 'hg38.fa.gz' },
          },
        },
      ],
      tracks: [
        {
          type: 'QuantitativeTrack',
          trackId: 'signal',
          name: 'Signal',
          assemblyNames: ['hg38'],
          adapter: { type: 'BigWigAdapter', uri: 'signal.bw' },
          ...track,
        },
      ],
    }
  }

  test('names the nested spelling on a display entry', () => {
    const [error] = validator.schemaProblems(
      configWith({
        displays: [{ type: 'LinearWiggleDisplay', 'rows.axis.width': 150 }],
      }),
    )
    expect(error?.where).toBe('tracks[0].displays[0].rows.axis.width')
    expect(error?.message).toMatch(
      /^unknown slot "rows\.axis\.width" — did you mean "rows: \{ axis: \{ width \} \}"\? — /,
    )
  })

  test('points a top-level axis on a row display at rows.axis', () => {
    const [error] = validator.schemaProblems(
      configWith({
        displays: [{ type: 'LinearWiggleDisplay', axis: { width: 150 } }],
      }),
    )
    expect(error?.message).toMatch(
      /^unknown slot "axis" — did you mean "rows\.axis"\? — /,
    )
  })

  test('says a displayDefaults key is one key, not a path', () => {
    const [error] = validator.schemaProblems(
      configWith({ displayDefaults: { 'rows.sort': ['a'] } }),
    )
    expect(error?.message).toBe(
      '"rows.sort" is one key, not a path, so no display of this track reads it — did you mean "rows: { sort }"?',
    )
  })

  test('a dotted key naming no declared path keeps the plain message', () => {
    const [error] = validator.schemaProblems(
      configWith({ displayDefaults: { 'rows.sortt': ['a'] } }),
    )
    expect(error?.message).toMatch(
      /^no display of this track declares "rows\.sortt"/,
    )
  })
})
