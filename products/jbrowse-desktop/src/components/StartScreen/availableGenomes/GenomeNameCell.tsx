import { CascadingMenuButton } from '@jbrowse/core/ui'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import { Link } from '@mui/material'

import type { LaunchCallback } from '../types.ts'

/**
 * Shared cell renderer for the name column in both UCSC and non-UCSC genome tables.
 * Renders launch links, a context menu, and optional badge children (e.g. reference/suppressed indicators).
 */
export default function GenomeNameCell({
  displayName,
  shortName,
  jbrowseConfig,
  jbrowseMinimalConfig,
  websiteUrl,
  isFavorite,
  launch,
  onClose,
  toggleFavorite,
  children,
}: {
  displayName: string
  shortName: string
  jbrowseConfig: string
  jbrowseMinimalConfig?: string
  websiteUrl: string
  isFavorite: boolean
  launch: LaunchCallback
  onClose: () => void
  toggleFavorite: () => void
  children?: React.ReactNode
}) {
  const handleLaunch = () => {
    launch([{ jbrowseConfig, shortName }])
    onClose()
  }

  const handleMinimalLaunch = () => {
    launch([{ jbrowseConfig: jbrowseMinimalConfig!, shortName }])
    onClose()
  }

  return (
    <div>
      {displayName} (
      <Link
        href="#"
        onClick={e => {
          e.preventDefault()
          handleLaunch()
        }}
      >
        launch
      </Link>
      ){' '}
      {jbrowseMinimalConfig ? (
        <>
          (
          <Link
            href="#"
            onClick={e => {
              e.preventDefault()
              handleMinimalLaunch()
            }}
          >
            minimal
          </Link>
          ){' '}
        </>
      ) : null}
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
          { label: 'Launch', onClick: handleLaunch },
          ...(jbrowseMinimalConfig
            ? [{ label: 'Launch (minimal)', onClick: handleMinimalLaunch }]
            : []),
          {
            label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
            onClick: toggleFavorite,
          },
        ]}
      >
        <MoreHoriz />
      </CascadingMenuButton>
    </div>
  )
}
