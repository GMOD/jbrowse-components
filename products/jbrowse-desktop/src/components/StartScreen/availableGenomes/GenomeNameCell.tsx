import { ActionLink, CascadingMenuButton } from '@jbrowse/core/ui'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import { observer } from 'mobx-react'

import type { LaunchCallback } from '../types.ts'

/**
 * The name column's cell in every genome table: the name launches the genome,
 * and the menu holds the less common actions.
 */
const GenomeNameCell = observer(function GenomeNameCell({
  displayName,
  jbrowseConfig,
  jbrowseMinimalConfig,
  websiteUrl,
  launch,
  onClose,
  children,
}: {
  displayName: string
  jbrowseConfig: string
  jbrowseMinimalConfig?: string
  websiteUrl: string
  launch: LaunchCallback
  onClose: () => void
  children?: React.ReactNode
}) {
  const launchConfig = (config: string) => {
    launch([config])
    onClose()
  }

  return (
    <div>
      <ActionLink
        title="Open in a new session"
        onClick={() => {
          launchConfig(jbrowseConfig)
        }}
      >
        {displayName}
      </ActionLink>{' '}
      {children}
      <CascadingMenuButton
        menuItems={[
          {
            label: 'More info',
            helpText: 'Opens external browser with more info about this genome',
            onClick: () => {
              window.open(websiteUrl, '_blank')
            },
          },
          ...(jbrowseMinimalConfig
            ? [
                {
                  label: 'Launch (minimal config)',
                  onClick: () => {
                    launchConfig(jbrowseMinimalConfig)
                  },
                },
              ]
            : []),
        ]}
      >
        <MoreHoriz />
      </CascadingMenuButton>
    </div>
  )
})

export default GenomeNameCell
