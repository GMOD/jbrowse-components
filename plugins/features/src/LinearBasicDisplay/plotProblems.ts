import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import {
  jexlProblemText,
  jexlProblems,
} from '@jbrowse/core/util/jexlDiagnostics'
import { isJexl } from '@jbrowse/core/util/jexlStrings'

import type { Plot } from '@jbrowse/core/configuration'
import type { JexlChecker } from '@jbrowse/core/util/jexlDiagnostics'

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

// A label is its field alone until `show` is written beside it.
function labelExpressions(labels: unknown): Expression[] {
  const members = membersOf(labels)
  return ['name', 'description'].map(key => {
    const label = members[key]
    return typeof label === 'string'
      ? { setting: `labels.${key}`, code: label }
      : { setting: `labels.${key}.field`, code: membersOf(label).field }
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
    ...labelExpressions(labels),
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
