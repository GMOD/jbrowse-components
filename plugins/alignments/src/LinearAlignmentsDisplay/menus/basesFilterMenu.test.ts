import { basesFilterOf, withBasesFields } from '../../shared/basesFilter.ts'
import { basesFilterNarrowing } from './basesFilterMenu.ts'

import type {
  BaseColorField,
  BaseLayer,
  BasesPatch,
} from '../../shared/types.ts'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

// Mirrors the display's `pileup.bases`, whose `unmodified` and `filter`
// outlive a switch to another layer
function makeModel(
  field: BaseColorField | undefined,
  {
    types = ['m', 'h'],
    unmodified = false,
    filter = [],
  }: { types?: string[]; unmodified?: boolean; filter?: FieldPredicate[] } = {},
) {
  return {
    detectedModificationTypes: types,
    bases: { show: field !== undefined, field, unmodified, filter },
    get baseLayer(): BaseLayer | undefined {
      const { show, field, unmodified, filter } = this.bases
      return !show || field === undefined
        ? undefined
        : field === 'modifications' || field === 'bisulfite'
          ? { field, unmodified, filter: basesFilterOf(filter) }
          : { field }
    },
    get basesFilter() {
      return basesFilterOf(this.bases.filter)
    },
    setBases({ show, field, unmodified, filter }: BasesPatch) {
      const { bases } = this
      this.bases = {
        show: show ?? bases.show,
        field: field ?? bases.field,
        unmodified: unmodified ?? bases.unmodified,
        filter: withBasesFields(bases.filter, filter ?? {}),
      }
    },
  }
}

describe('the per-base refinements in the Filter by... count', () => {
  test('nothing counts at the defaults', () => {
    expect(basesFilterNarrowing(makeModel('modifications')).count).toBe(0)
  })

  test('a raised floor and an unticked type count, and clear', () => {
    const model = makeModel('modifications', {
      filter: [
        { field: 'probability', gte: 0.8 },
        { field: 'code', oneOf: ['m'] },
      ],
    })
    const narrowing = basesFilterNarrowing(model)
    expect(narrowing.count).toBe(2)
    narrowing.clear()
    expect(model.bases.filter).toEqual([])
  })

  // the 2-color view paints every call, so its floor changes nothing drawn
  test('a floor the drawn view ignores does not count, and survives a clear', () => {
    const floor = { field: 'probability', gte: 0.8 }
    const model = makeModel('modifications', {
      unmodified: true,
      filter: [floor],
    })
    const narrowing = basesFilterNarrowing(model)
    expect(narrowing.count).toBe(0)
    narrowing.clear()
    expect(model.bases.filter).toEqual([floor])
  })

  test('a context under bisulfite counts', () => {
    const model = makeModel('bisulfite', {
      filter: [{ field: 'context', oneOf: ['CHH'] }],
    })
    expect(basesFilterNarrowing(model).count).toBe(1)
  })

  test('nothing counts with the layer off', () => {
    const model = makeModel(undefined, {
      filter: [{ field: 'probability', gte: 0.8 }],
    })
    expect(basesFilterNarrowing(model).count).toBe(0)
  })
})
