import { ActionLink, CascadingMenuButton } from '@jbrowse/core/ui'
import { CellOverhang } from '@jbrowse/core/ui/VirtualTable'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import { observer } from 'mobx-react'

import type { LaunchCallback } from '../types.ts'

const useStyles = makeStyles()({
  cell: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
  },
  name: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

/**
 * Shared cell renderer for the name column in both UCSC and non-UCSC genome tables.
 * Renders launch links, a context menu, and optional badge children (e.g. reference/suppressed indicators).
 */
const GenomeNameCell = observer(function GenomeNameCell({
  displayName,
  jbrowseConfig,
  jbrowseMinimalConfig,
  websiteUrl,
  isFavorite,
  launch,
  onClose,
  toggleFavorite,
  children,
}: {
  displayName?: string
  jbrowseConfig: string
  jbrowseMinimalConfig?: string
  websiteUrl: string
  isFavorite: boolean
  launch: LaunchCallback
  onClose: () => void
  toggleFavorite: () => void
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  const handleLaunch = () => {
    launch([jbrowseConfig])
    onClose()
  }

  const handleMinimalLaunch = jbrowseMinimalConfig
    ? () => {
        launch([jbrowseMinimalConfig])
        onClose()
      }
    : undefined

  return (
    <div className={classes.cell}>
      <span className={classes.name}>
        {displayName} (
        <ActionLink
          onClick={() => {
            handleLaunch()
          }}
        >
          launch
        </ActionLink>
        ){' '}
        {handleMinimalLaunch ? (
          <>
            (
            <ActionLink
              onClick={() => {
                handleMinimalLaunch()
              }}
            >
              minimal
            </ActionLink>
            ){' '}
          </>
        ) : null}
      </span>
      <CellOverhang>
        {children}
        <CascadingMenuButton
          menuItems={[
            {
              label: 'More info',
              helpText:
                'Opens external browser with more info about this genome',
              onClick: () => {
                window.open(websiteUrl, '_blank')
              },
            },
            {
              label: 'Launch',
              onClick: () => {
                handleLaunch()
              },
            },
            ...(handleMinimalLaunch
              ? [
                  {
                    label: 'Launch (minimal config)',
                    onClick: () => {
                      handleMinimalLaunch()
                    },
                  },
                ]
              : []),
            {
              label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
              onClick: () => {
                toggleFavorite()
              },
            },
          ]}
        >
          <MoreHoriz />
        </CascadingMenuButton>
      </CellOverhang>
    </div>
  )
})

export default GenomeNameCell
