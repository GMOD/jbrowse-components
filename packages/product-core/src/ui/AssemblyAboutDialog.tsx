import Dialog from '@jbrowse/core/ui/Dialog'
import { getEnv, getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { observer } from 'mobx-react'

import AssemblyAboutDialogContents from './AssemblyAboutDialogContents'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const AssemblyAboutDialog = observer(function ({
  config,
  handleClose,
}: {
  config: AnyConfigurationModel
  handleClose: () => void
}) {
  const session = getSession(config)
  const trackName = getTrackName(config, session)
  const { pluginManager } = getEnv(session)

  const AssemblyAboutDialogContents2 = pluginManager.evaluateExtensionPoint(
    'Core-replaceAssemblyAbout',
    AssemblyAboutDialogContents,
    {
      session,
      config,
    },
  ) as React.FC<any>

  return (
    <Dialog open onClose={handleClose} title={trackName} maxWidth="xl">
      <AssemblyAboutDialogContents2 config={config} />
    </Dialog>
  )
})

export default AssemblyAboutDialog
