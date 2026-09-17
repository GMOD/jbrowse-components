import Attributes from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Attributes'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { hydrateTrackConfig } from '@jbrowse/core/configuration'
import { PluggableComponent } from '@jbrowse/core/ui'
import Dialog from '@jbrowse/core/ui/Dialog'
import { getEnv } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { isStateTreeNode } from '@jbrowse/mobx-state-tree'

import AboutContents from './AboutDialogContents.tsx'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default function AboutDialog({
  config,
  session,
  handleClose,
}: {
  session: AbstractSessionModel
  /**
   * the in-view track label passes `track.configuration`, a live node; the
   * hierarchical selector passes a `session.tracks` entry, a plain object
   * until something references the track
   */
  config: AnyConfigurationModel | Record<string, unknown>
  handleClose: () => void
}) {
  const { pluginManager } = getEnv(session)
  // hydrated once here, so every panel and every plugin on the two About points
  // reads one live node: "Copy config" gives the same JSON whichever menu
  // opened the dialog, and a jexl `formatAbout` slot has an env to evaluate in
  const live = isStateTreeNode(config)
    ? config
    : hydrateTrackConfig(pluginManager, config)

  return (
    <Dialog
      open
      onClose={handleClose}
      title={getTrackName(config, session)}
      maxWidth="xl"
    >
      {live ? (
        <PluggableComponent
          pluginManager={pluginManager}
          name="Core-replaceAbout"
          component={AboutContents}
          props={{ config: live, session }}
        />
      ) : (
        // a config no registered track type can build: shown as authored
        <BaseCard title="Configuration">
          <Attributes attributes={config} />
        </BaseCard>
      )}
    </Dialog>
  )
}
