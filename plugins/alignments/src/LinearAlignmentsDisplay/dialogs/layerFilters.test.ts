import {
  junctionEntries,
  junctionFilterOf,
  withFields,
} from '../../shared/alignmentsFilter.ts'
import { basesFilterOf, withBasesFields } from '../../shared/basesFilter.ts'
import {
  defaultLayerFilterState,
  layerBasesPatch,
  layerFilterEntries,
  layerFilterStateOf,
} from './layerFilters.ts'

import type { BaseLayer, BasesPatch } from '../../shared/types.ts'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

// A display's filter and per-base slots, read and written as the display does
interface ModelOptions {
  filter?: FieldPredicate[]
  bases?: FieldPredicate[]
  layer?: BaseLayer['field']
  unmodified?: boolean
  types?: string[]
  showSashimi?: boolean
  drawnReadConnections?: 'off' | 'arc' | 'cloud'
}

function makeModel({
  filter = [],
  bases = [],
  layer,
  unmodified = false,
  types = ['m', 'h'],
  showSashimi = false,
  drawnReadConnections = 'off',
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
    get baseLayer(): BaseLayer | undefined {
      return layer === 'modifications' || layer === 'bisulfite'
        ? { field: layer, unmodified, filter: this.basesFilter }
        : layer
          ? { field: layer }
          : undefined
    },
    setFilterFields(
      patch: Readonly<Record<string, readonly FieldPredicate[] | undefined>>,
    ) {
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
  model.setFilterFields(layerFilterEntries(state, initial))
  const patch = layerBasesPatch(state, false)
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
            drawnReadConnections: 'arc',
            layer: 'modifications',
          }),
        ),
      ),
    ).toEqual(['alone', 'junctions', 'connections', 'bases'])
  })

  test('the probability floor shows in the by-type view, the context in the blue view', () => {
    const byType = layerFilterStateOf(makeModel({ layer: 'modifications' }))
    expect(byType.bases).toMatchObject({ probabilityPercent: '10' })
    expect(byType.bases?.context).toBeUndefined()
    const blue = layerFilterStateOf(
      makeModel({ layer: 'modifications', unmodified: true }),
    )
    expect(blue.bases).toMatchObject({ context: 'CG' })
    expect(blue.bases?.probabilityPercent).toBeUndefined()
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

  // an empty type list is "every type", so the layer goes off instead
  test('unticking every type turns the layer off', () => {
    const model = makeModel({ layer: 'modifications' })
    submit(model, s => ({ ...s, bases: { ...s.bases!, shown: [] } }))
    expect(model.shown).toBe(false)
  })

  test('Reset returns every shown layer to its defaults', () => {
    const model = makeModel({
      layer: 'modifications',
      bases: [
        { field: 'probability', gte: 0.8 },
        { field: 'code', oneOf: ['m'] },
      ],
      filter: [{ field: 'alone', equal: false }],
    })
    submit(model, defaultLayerFilterState)
    expect(model.filterPredicates).toEqual([])
    expect(model.bases).toEqual([])
  })
})
