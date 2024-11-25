import React from 'react'
import Dialog from '@jbrowse/core/ui/Dialog'
import { getSession, getEnv } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import AboutContents from './AboutDialogContents'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export function AboutDialog({
  config,
  handleClose,
}: {
  config: AnyConfigurationModel
  handleClose: () => void
}) {
  const session = getSession(config)
  const trackName = getTrackName(config, session)
  const { pluginManager } = getEnv(session)

  const AboutComponent = pluginManager.evaluateExtensionPoint(
    'Core-replaceAbout',
    AboutContents,
    { session, config },
  ) as React.FC<any>

  return (
    <Dialog open onClose={handleClose} title={trackName} maxWidth="xl">
      <AboutComponent config={config} />
    </Dialog>
  )
}
