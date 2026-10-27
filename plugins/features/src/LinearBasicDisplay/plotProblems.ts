import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import {
  jexlProblemText,
  jexlProblems,
} from '@jbrowse/core/util/jexlDiagnostics'
import { isJexl } from '@jbrowse/core/util/jexlStrings'

import type { FeatureFacet } from './facet.ts'
import type { Plot } from '@jbrowse/core/configuration'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'
import type { JexlChecker } from '@jbrowse/core/util/jexlDiagnostics'

/**
 * A facet as the plot writes it, its field alone while it lists no order and
 * hides no section.
 */
export function facetOf(
  facet: FeatureFacet | undefined,
  hidden: readonly string[] = [],
) {
  return facet
    ? {
        field: facet.field,
        ...(facet.sort.length ? { sort: [...facet.sort] } : {}),
        ...(hidden.length ? { hidden: [...hidden] } : {}),
      }
    : null
}

/** A plot's color channel as an object, its field shorthand unfolded. */
export function colorOf(color: unknown): ColorSlots {
  return typeof color === 'string'
    ? { field: color }
    : ((color as ColorSlots | undefined) ?? {})
}

interface Expression {
  setting: string
  code: unknown
}

function membersOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

function membersAt(value: unknown, setting: string, keys: readonly string[]) {
  const members = membersOf(value)
  return keys.map(key => ({ setting: `${setting}.${key}`, code: members[key] }))
}

function channelExpressions(encoding: unknown): Expression[] {
  return Object.entries(membersOf(encoding)).flatMap(([channel, spec]) => {
    const setting = `encoding.${channel}`
    return typeof spec === 'string'
      ? [{ setting, code: spec }]
      : membersAt(spec, setting, ['field', 'value', 'refName', 'pos'])
  })
}

function transformExpressions(transform: unknown): Expression[] {
  return Array.isArray(transform)
    ? transform.flatMap((step, i) =>
        membersAt(step, `transform[${i}]`, ['expr']),
      )
    : []
}

/** Every `jexl:` string a plot holds, by the setting holding it. */
export function plotJexlExpressions(draft: Plot) {
  const { encoding, facet, filter, transform, labels } = draft
  return [
    ...channelExpressions(encoding),
    typeof facet === 'string'
      ? { setting: 'facet', code: facet }
      : { setting: 'facet.field', code: membersOf(facet).field },
    ...predicatesOf(filter).map(p => ({ setting: 'filter', code: p.field })),
    ...transformExpressions(transform),
    ...membersAt(labels, 'labels', ['name', 'description']),
  ].filter((entry): entry is { setting: string; code: string } =>
    isJexl(entry.code),
  )
}

/**
 * A draft's `jexl:` expression that does not parse or calls a function
 * `jexl` does not register, by setting.
 */
export function plotJexlProblems(draft: Plot, jexl: JexlChecker) {
  return plotJexlExpressions(draft).flatMap(({ setting, code }) =>
    jexlProblems(code, jexl)
      .filter(problem => problem.severity === 'error')
      .map(problem => jexlProblemText(setting, problem)),
  )
}
