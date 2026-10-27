import {
  junctionEntries,
  junctionFilterOf,
  withFields,
} from '../../shared/alignmentsFilter.ts'
import { basesFilterOf, withBasesFields } from '../../shared/basesFilter.ts'
import {
  declaredLayerFilterState,
  layerBasesPatch,
  layerFilterEntries,
  layerFilterStateOf,
} from './layerFilters.ts'

import type { BaseLayer, BasesPatch } from '../../shared/types.ts'
import type {
  FieldPredicate,
  FieldsPatch,
} from '@jbrowse/core/util/fieldPredicate'

// A display's filter and per-base slots, read and written as the display does
interface ModelOptions {
  filter?: FieldPredicate[]
  bases?: FieldPredicate[]
  layer?: BaseLayer['field']
  unmodified?: boolean
  types?: string[]
  showSashimi?: boolean
  drawnReadConnections?: 'off' | 'link' | 'rule'
  // What the track's config declares, for Reset
  declared?: { filter?: FieldPredicate[]; bases?: FieldPredicate[] }
}

function makeModel({
  filter = [],
  bases = [],
  layer,
  unmodified = false,
  types = ['m', 'h'],
  showSashimi = false,
  drawnReadConnections = 'off',
  declared = {},
}: ModelOptions = {}) {
  return {
    filterPredicates: filter,
    bases,
    showSashimi,
    drawnReadConnections,
    showConnectors: false,
    detectedModificationTypes: types,
    get junctionFilter() {
      return junctionFilterOf(this.filterPredicates)
    },
    connectionFilter: { minInterchromReads: 1 },
    get basesFilter() {
      return basesFilterOf(this.bases)
    },
    get declaredFilters() {
      const filterPredicates = declared.filter ?? []
      return {
        filterPredicates,
        junctionFilter: junctionFilterOf(filterPredicates),
        connectionFilter: this.connectionFilter,
        basesFilter: basesFilterOf(declared.bases ?? []),
      }
    },
    get baseLayer(): BaseLayer | undefined {
      return layer === 'modifications' || layer === 'bisulfite'
        ? { field: layer, unmodified, filter: this.basesFilter }
        : layer
          ? { field: layer }
          : undefined
    },
    setFilterFields(patch: FieldsPatch) {
      this.filterPredicates = withFields(this.filterPredicates, patch)
    },
    shown: true,
    setBases({ show, filter }: BasesPatch) {
      this.shown = show ?? this.shown
      this.bases = withBasesFields(this.bases, filter ?? {})
    },
  }
}

// What the dialog's Submit does with its layer state
function submit(
  model: ReturnType<typeof makeModel>,
  edit: (
    s: ReturnType<typeof layerFilterStateOf>,
  ) => ReturnType<typeof layerFilterStateOf>,
) {
  const initial = layerFilterStateOf(model)
  const state = edit(initial)
  model.setFilterFields(
    layerFilterEntries(state, initial, model.filterPredicates),
  )
  const patch = layerBasesPatch(state, initial)
  if (patch) {
    model.setBases(patch)
  }
}

describe('the More filters... layer sections', () => {
  test('each layer shows only while it draws', () => {
    expect(Object.keys(layerFilterStateOf(makeModel()))).toEqual(['alone'])
    expect(
      Object.keys(
        layerFilterStateOf(
          makeModel({
            showSashimi: true,
            drawnReadConnections: 'link',
            layer: 'modifications',
          }),
        ),
      ),
    ).toEqual(['alone', 'junctions', 'connections', 'bases'])
  })

  // the cytosine context is a Color by row, so neither view shows it here
  test('the probability floor shows in the by-type view only', () => {
    const byType = layerFilterStateOf(makeModel({ layer: 'modifications' }))
    expect(byType.bases).toMatchObject({ probabilityPercent: '10' })
    const blue = layerFilterStateOf(
      makeModel({ layer: 'modifications', unmodified: true }),
    )
    expect(blue.bases?.probabilityPercent).toBeUndefined()
    expect(Object.keys(blue.bases ?? {})).toEqual([
      'types',
      'shown',
      'unloaded',
      'strict',
    ])
  })

  test('a Submit that changes nothing writes the filter back unchanged', () => {
    const filter = withFields(
      [],
      junctionEntries({ classes: ['splice', 'deletion'], minReads: 3 }),
    )
    const model = makeModel({ filter, showSashimi: true })
    submit(model, s => s)
    expect(model.filterPredicates).toEqual(filter)
  })

  test('a Submit that changes nothing keeps entries the dialog shows another way', () => {
    const filter = [
      { field: 'alone', equal: true },
      { field: 'junction.reads', gt: 4 },
      { field: 'breakpoint.reads', gte: 3, lte: 50 },
    ]
    const model = makeModel({
      filter,
      showSashimi: true,
      drawnReadConnections: 'link',
    })
    submit(model, s => s)
    expect(model.filterPredicates).toEqual(filter)
  })

  test('a raised floor keeps the cap the field declares', () => {
    const model = makeModel({
      filter: [{ field: 'junction.reads', gte: 3, lte: 100 }],
      showSashimi: true,
    })
    submit(model, s => ({
      ...s,
      junctions: { ...s.junctions!, minReads: '5' },
    }))
    expect(model.filterPredicates).toEqual([
      { field: 'junction.reads', lte: 100, gte: 5 },
    ])
  })

  test('Reset writes a field back as the config declares it', () => {
    const declared = [{ field: 'junction.reads', gt: 4 }]
    const model = makeModel({
      filter: [{ field: 'junction.reads', gte: 7 }],
      showSashimi: true,
      declared: { filter: declared },
    })
    const reset = declaredLayerFilterState(model)
    model.setFilterFields(
      layerFilterEntries(
        reset,
        layerFilterStateOf(model),
        model.filterPredicates,
        { predicates: model.declaredFilters.filterPredicates, reading: reset },
      ),
    )
    expect(model.filterPredicates).toEqual(declared)
  })

  test('hiding split-read junctions writes junction.source', () => {
    const model = makeModel({ showSashimi: true })
    submit(model, s => ({
      ...s,
      junctions: { ...s.junctions!, split: 'exclude' },
    }))
    expect(model.junctionFilter.classes).toEqual(['splice'])
  })

  test('reads with no mate in view is a category on `alone`', () => {
    const model = makeModel()
    submit(model, s => ({ ...s, alone: 'exclude' }))
    expect(model.filterPredicates).toEqual([{ field: 'alone', equal: false }])
  })

  test('a raised floor and an unticked type write the per-base filter', () => {
    const model = makeModel({ layer: 'modifications' })
    submit(model, s => ({
      ...s,
      bases: { ...s.bases!, shown: ['m'], probabilityPercent: '80' },
    }))
    expect(model.basesFilter).toMatchObject({
      codes: ['m'],
      probability: { min: 0.8 },
    })
  })

  // The boxes list only the types loaded now, and a Submit rewrote the list
  // from them: a type no read in view carries dropped out, and with none of
  // the listed types loaded the layer went off
  test.each([[['h']], [['m', 'h']]])(
    'a Submit that changes nothing keeps the type list %j',
    codes => {
      const model = makeModel({
        layer: 'modifications',
        types: ['m', 'a'],
        bases: [{ field: 'code', oneOf: codes }],
      })
      submit(model, s => s)
      expect(model.shown).toBe(true)
      expect(model.basesFilter.codes).toEqual(codes)
    },
  )

  test('an edit keeps the listed types no loaded read carries', () => {
    const model = makeModel({
      layer: 'modifications',
      types: ['m', 'a'],
      bases: [{ field: 'code', oneOf: ['m', 'h'] }],
    })
    submit(model, s => ({ ...s, bases: { ...s.bases!, shown: [] } }))
    expect(model.shown).toBe(true)
    expect(model.basesFilter.codes).toEqual(['h'])
  })

  // an empty type list is "every type", so the layer goes off instead
  test('unticking every type turns the layer off', () => {
    const model = makeModel({ layer: 'modifications' })
    submit(model, s => ({ ...s, bases: { ...s.bases!, shown: [] } }))
    expect(model.shown).toBe(false)
  })

  // The track's config, not the built-in defaults: "Clear all filters" puts a
  // declared filter back, so Reset in the dialog must not take it away.
  test('Reset returns every shown layer to what the config declares', () => {
    const model = makeModel({
      layer: 'modifications',
      bases: [{ field: 'code', oneOf: ['m'] }],
      declared: {
        filter: [{ field: 'alone', equal: false }],
        bases: [{ field: 'probability', gt: 0.8 }],
      },
    })
    submit(model, () => declaredLayerFilterState(model))
    expect(model.filterPredicates).toEqual([{ field: 'alone', equal: false }])
    expect(model.bases).toEqual([{ field: 'probability', gt: 0.8 }])
  })
})
