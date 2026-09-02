import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'
import { compareStructural } from 'mobx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

type TrackConfInput = { trackId: string; type: string } & Record<
  string,
  unknown
>

// What a config means once its defaults are resolved: a live config node
// answers with its snapshot, and a plain object (desktop's `jbrowse.tracks` is
// frozen, so its entries are the input as written) is hydrated through the
// same schema first. Two inputs that would build the same node compare equal.
function resolvedTrackConf(
  pluginManager: PluginManager,
  conf: AnyConfigurationModel | TrackConfInput,
) {
  return isStateTreeNode(conf)
    ? getSnapshot(conf)
    : getSnapshot(
        pluginManager
          .pluggableConfigSchemaType('track')
          .create(conf, { pluginManager }),
      )
}

// Re-adding a trackId the session already holds returns the existing config,
// which is what keeps a content-hashed trackId idempotent. It is also the trap
// a recomputed track walks into: the new features arrive under the old id, the
// old config is handed back, nothing is said, and the track keeps showing the
// first values it saw. Same id with different content is therefore refused,
// naming the two-step that works.
export function assertNotReaddedDifferently(
  pluginManager: PluginManager,
  existing: AnyConfigurationModel | TrackConfInput,
  trackConf: TrackConfInput,
) {
  const same = compareStructural(
    resolvedTrackConf(pluginManager, existing),
    resolvedTrackConf(pluginManager, trackConf),
  )
  if (!same) {
    throw new Error(
      `Track "${trackConf.trackId}" is already in this session with a different configuration, and adding it again would keep the old one. Delete it first (session.deleteTrackConf(session.getTrackById("${trackConf.trackId}"))), then add — and give a recomputed FromConfigAdapter a new adapterId, since the adapter cache is keyed on it.`,
    )
  }
}
