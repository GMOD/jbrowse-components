import { floorOf, predicatesOf } from '@jbrowse/core/util/fieldPredicate'

import type { HicCountFloors } from '../RenderHicDataRPC/types.ts'
import type { HicColorField } from './hicColorConfigSchema.ts'

/** The counts a cell's `filter` can floor: the map's, and the control's. */
const HIC_FILTER_FIELDS = ['observed', 'control']

const FLOOR_TESTS = new Set(['field', 'gte', 'gt'])

/** The floors the worker drops a cell below, read off the `filter` list. */
export function hicCountFloors(filter: unknown): HicCountFloors {
  const predicates = predicatesOf(filter)
  return {
    observed: floorOf(predicates, 'observed'),
    control: floorOf(predicates, 'control'),
  }
}

/**
 * The `filter` entries the worker cannot apply: a field it has no count for,
 * a test other than a floor, and a `control` floor where the cells carry no
 * control count.
 */
export function hicFilterProblems(filter: unknown, field: HicColorField) {
  const predicates = predicatesOf(filter)
  return [
    ...predicates.flatMap(p =>
      !HIC_FILTER_FIELDS.includes(p.field)
        ? [
            `filter: no field ${JSON.stringify(p.field)}; it takes ${HIC_FILTER_FIELDS.join(', ')}`,
          ]
        : Object.entries(p).some(
              ([k, v]) => v !== undefined && !FLOOR_TESTS.has(k),
            )
          ? [`filter: ${p.field} takes gte or gt, not ${JSON.stringify(p)}`]
          : [],
    ),
    ...(field !== 'observed/control' &&
    predicates.some(p => p.field === 'control')
      ? [
          "filter: control is the control map's count, which only an encoding.color.field of observed/control reads",
        ]
      : []),
  ]
}
