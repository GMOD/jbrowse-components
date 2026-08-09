/**
 * @module
 * Resolving the `formatDetails` config hook across its two tiers, on behalf of
 * the feature-details widget's autorun. Plain functions rather than model
 * members: an MST action runs untracked, so folding these into one would leave
 * the autorun with no observable reads and fire it exactly once.
 */
import {
  DEFAULT_FORMAT_DETAILS_DEPTH,
  getConf,
  mergeFormatCallbacks,
} from '../configuration/index.ts'
import { isEmpty } from './BaseFeatureDetail/util.ts'
import { formatSubfeatures } from './util.tsx'

import type { AnyConfigurationModel } from '../configuration/index.ts'
import type { SimpleFeatureSerialized } from '../util/index.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Anything carrying a `formatDetails` sub-schema: the session (whose
 * `configuration.formatDetails` applies to every track) and the clicked
 * feature's track. The track is absent when the widget was opened without one,
 * or outlived the one it had -- it is a `safeReference` -- and the session-wide
 * tier still has to run in that case.
 */
export interface FormatDetailsHolder extends IStateTreeNode {
  configuration: AnyConfigurationModel
}

export interface FormatDetailsTiers {
  session: FormatDetailsHolder
  track?: FormatDetailsHolder
}

/** Both tiers of one slot, session first, so a spread puts the track on top. */
function readTiers(
  { session, track }: FormatDetailsTiers,
  slot: string,
  args?: Record<string, unknown>,
) {
  return [
    getConf(session, ['formatDetails', slot], args),
    track ? getConf(track, ['formatDetails', slot], args) : undefined,
  ]
}

/**
 * `depth` or `maxDepth`: the track's value when the track sets one, else the
 * session's, else unset.
 *
 * These override rather than merge, unlike the callback objects. That is only
 * expressible because both are `maybeNumber` slots with no `defaultValue` --
 * given a schema default the track reported a value whether or not anyone set
 * one, so the session-wide tier could never apply to a track, and every real
 * config has a track.
 */
export function formatDetailsNumber(tiers: FormatDetailsTiers, slot: string) {
  const [fromSession, fromTrack] = readTiers(tiers, slot)
  return typeof fromTrack === 'number'
    ? fromTrack
    : typeof fromSession === 'number'
      ? fromSession
      : undefined
}

/**
 * A copy of the feature with each tier's callback output merged onto it (and
 * onto its subfeatures, down to `depth`) as `__jbrowsefmt`, which the detail
 * components spread over the raw fields at render.
 *
 * `__jbrowsefmt` is attached only where a callback produced something, so a
 * config with no `formatDetails` at all leaves the feature exactly as it came
 * in rather than stamping empty objects through the persisted snapshot.
 */
export function applyFormatDetails(
  tiers: FormatDetailsTiers,
  featureData: SimpleFeatureSerialized,
) {
  const feature = structuredClone(featureData)
  const fmt = mergeFormatCallbacks(...readTiers(tiers, 'feature', { feature }))
  if (!isEmpty(fmt)) {
    feature.__jbrowsefmt = fmt
  }
  const depth =
    formatDetailsNumber(tiers, 'depth') ?? DEFAULT_FORMAT_DETAILS_DEPTH
  formatSubfeatures(feature, depth, sub => {
    const subFmt = mergeFormatCallbacks(
      ...readTiers(tiers, 'subfeatures', { feature: sub }),
    )
    if (!isEmpty(subFmt)) {
      sub.__jbrowsefmt = subFmt
    }
  })
  return feature
}
