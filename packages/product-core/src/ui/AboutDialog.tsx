import React from 'react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import Dialog from '@jbrowse/core/ui/Dialog'
import { getEnv, AbstractSessionModel } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

// locals
import AboutContents from './AboutDialogContents'

export function AboutDialog({
  config,
  session,
  handleClose,
}: {
  config: AnyConfigurationModel
  session: AbstractSessionModel
  handleClose: () => void
}) {
  const trackName = getTrackName(config, session)
  const { pluginManager } = getEnv(session)

  const AboutComponent = pluginManager.evaluateExtensionPoint(
    'Core-replaceAbout',
    AboutContents,
    { session, config },
  ) as React.FC<{
    config: AnyConfigurationModel
    session: AbstractSessionModel
  }>

  return (
    <Dialog open onClose={handleClose} title={trackName} maxWidth="xl">
      <AboutComponent config={config} session={session} />
    </Dialog>
  )
}
