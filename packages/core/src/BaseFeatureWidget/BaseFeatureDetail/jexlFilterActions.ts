import { pathSubject, printCondition } from '@jbrowse/jexl'

import { activeJexlFilters } from '../../util/jexlFilters.ts'
import { ensureJexlPrefix } from '../../util/jexlStrings.ts'
import { getNotificationSink } from '../../util/sessionServices.ts'

import type { MenuItem } from '../../ui/MenuTypes.ts'
import type { JexlFilterModel } from '../../util/jexlFilters.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface JexlFilterDisplay extends JexlFilterModel, IStateTreeNode {}

const MAX_LABEL_VALUE = 30

export function isJexlFilterDisplay(
  thing: unknown,
): thing is JexlFilterDisplay {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'setJexlFilters' in thing &&
    'configuredFilters' in thing
  )
}

/** The first of a track's displays that takes jexl filters. */
export function jexlFilterDisplay(track?: { displays: readonly unknown[] }) {
  return track?.displays.find(isJexlFilterDisplay)
}

/**
 * "Show only" and "Hide" items for one feature attribute's value, and "Show
 * only ≥" for a number. Each appends a filter line to the display and offers
 * an undo.
 */
export function filterByValueItems(
  display: JexlFilterDisplay,
  path: string[],
  value: unknown,
): MenuItem[] {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return []
  }
  const field = path.join('.')
  const text = String(value)
  const shown =
    text.length > MAX_LABEL_VALUE ? `${text.slice(0, MAX_LABEL_VALUE)}…` : text
  const add = (op: '==' | '!=' | '>=') => () => {
    const previous = display.jexlFiltersSetting
    const line = printCondition({
      subject: pathSubject('feature', path),
      op,
      value,
    })
    display.setJexlFilters([
      ...activeJexlFilters(display),
      ensureJexlPrefix(line),
    ])
    getNotificationSink(display).notify('Filter added', 'info', {
      name: 'Undo',
      onClick: () => {
        display.setJexlFilters(previous && [...previous])
      },
    })
  }
  return [
    { label: `Show only ${field} = ${shown}`, onClick: add('==') },
    { label: `Hide ${field} = ${shown}`, onClick: add('!=') },
    ...(typeof value === 'number'
      ? [{ label: `Show only ${field} ≥ ${shown}`, onClick: add('>=') }]
      : []),
  ]
}
