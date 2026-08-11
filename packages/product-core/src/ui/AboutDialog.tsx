import { PluggableComponent } from '@jbrowse/core/ui'
import Dialog from '@jbrowse/core/ui/Dialog'
import { getEnv } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

import AboutContents from './AboutDialogContents.tsx'

import type { AboutPanelProps } from './util.ts'

export default function AboutDialog({
  config,
  session,
  handleClose,
}: AboutPanelProps & { handleClose: () => void }) {
  const trackName = getTrackName(config, session)
  const { pluginManager } = getEnv(session)

  return (
    <Dialog open onClose={handleClose} title={trackName} maxWidth="xl">
      <PluggableComponent
        pluginManager={pluginManager}
        name="Core-replaceAbout"
        component={AboutContents}
        props={{ config, session }}
      />
    </Dialog>
  )
}
