import { readConfObject } from '@jbrowse/core/configuration'

import type {
  ValueScaleRuleConfig,
  YChannelConfigSchema,
} from './yChannelConfigSchema.ts'
import type { YMember, YScalePaths } from './yScalePaths.ts'
import type {
  AnyConfigurationModel,
  ConfigurationSlotPathValue,
} from '@jbrowse/core/configuration'

interface YMemberPathInChannel {
  type: ['scale', 'type']
  zero: ['scale', 'zero']
  domainMin: ['scale', 'domainMin']
  domainMax: ['scale', 'domainMax']
  fence: ['scale', 'fenceQuantile']
  constant: ['scale', 'constant']
  group: ['scale', 'group']
  title: ['axis', 'title']
  grid: ['axis', 'grid']
}

/** What a read of one y scale member yields, off the schema every y channel shares. */
export type YMemberValue<M extends Exclude<YMember, 'rules'>> =
  ConfigurationSlotPathValue<YChannelConfigSchema, YMemberPathInChannel[M]>

/** One y scale member's setting; `yRuleNodes` reads the rules. */
export function readYMember<M extends Exclude<YMember, 'rules'>>(
  conf: AnyConfigurationModel,
  paths: YScalePaths,
  member: M,
): YMemberValue<M> {
  return readConfObject(conf, [...paths.members[member]])
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
