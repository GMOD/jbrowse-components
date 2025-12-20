import Dialog from '@jbrowse/core/ui/Dialog'
import { getEnv } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

import AboutContents from './AboutDialogContents'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export function AboutDialog({
  config,
  session,
  handleClose,
}: {
  config: AnyConfigurationModel | Record<string, unknown>
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
    config: AnyConfigurationModel | Record<string, unknown>
    session: AbstractSessionModel
  }>

  return (
    <Dialog open onClose={handleClose} title={trackName} maxWidth="xl">
      <AboutComponent config={config} session={session} />
    </Dialog>
  )
}
