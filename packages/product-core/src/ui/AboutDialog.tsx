import React from 'react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import Dialog from '@jbrowse/core/ui/Dialog'
import { getSession, getEnv } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import AboutContents from './AboutDialogContents'

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as React.FC<any>

  return (
    <Dialog open onClose={handleClose} title={trackName} maxWidth="xl">
      <AboutComponent config={config} />
    </Dialog>
  )
}
