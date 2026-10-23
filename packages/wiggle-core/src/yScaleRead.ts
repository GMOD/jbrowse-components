import { readConfObject } from '@jbrowse/core/configuration'

import type { ValueScaleRuleConfig } from './valueScaleConfigSchema.ts'
import type { YMember, YScalePaths } from './yScalePaths.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/** One y scale member's setting, unset where the map has no path for it. */
export function readYMember(
  conf: AnyConfigurationModel,
  paths: YScalePaths,
  member: YMember,
): any {
  const path = paths.members[member]
  return path && readConfObject(conf, [...path])
}

/** The config node a path ends on, for what a snapshot read cannot give. */
export function confNodeAt(
  conf: AnyConfigurationModel,
  path: readonly string[],
) {
  return path.reduce<unknown>(
    (node, segment) => (node as Record<string, unknown>)[segment],
    conf,
  ) as AnyConfigurationModel
}

/** The live rule nodes: a snapshot strips a slot at its default, and a rule at 0 is one. */
export function yRuleNodes(conf: AnyConfigurationModel, paths: YScalePaths) {
  return confNodeAt(
    conf,
    paths.members.rules,
  ) as unknown as ValueScaleRuleConfig[]
}
