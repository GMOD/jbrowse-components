import { CascadingMenuButton } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import { Link } from '@mui/material'

import StarIcon from '../StarIcon.tsx'
import { loadPluginManager } from '../util.tsx'

import type { RecentSessionData } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

const useStyles = makeStyles()({
  flexContainer: {
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

function SessionNameCell({
  value,
  row,
  isFavorite,
  setPluginManager,
  setError,
  toggleFavorite,
  setSessionToRename,
  addToQuickstartList,
}: {
  value: string
  row: RecentSessionData
  isFavorite: boolean
  setPluginManager: (pm: PluginManager) => void
  setError: (e: unknown) => void
  toggleFavorite: (sessionPath: string) => void
  setSessionToRename: (arg: RecentSessionData) => void
  addToQuickstartList?: (entry: RecentSessionData) => Promise<void>
}) {
  const { classes } = useStyles()
  const handleLaunch = async () => {
    try {
      setPluginManager(await loadPluginManager(row.path))
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }

  const handleToggleFavorite = () => {
    toggleFavorite(row.path)
  }

  const handleRename = () => {
    setSessionToRename(row)
  }

  const handleAddToQuickstartList = async () => {
    if (addToQuickstartList) {
      await addToQuickstartList(row)
    }
  }
  const handleLinkClick = async (event: React.MouseEvent) => {
    event.preventDefault()
    await handleLaunch()
  }

  return (
    <div className={classes.flexContainer}>
      <Link href="#" onClick={handleLinkClick}>
        {value}
      </Link>
      {isFavorite ? (
        <StarIcon isFavorite={isFavorite} onClick={handleToggleFavorite} />
      ) : null}
      <CascadingMenuButton
        menuItems={[
          {
            label: 'Launch',
            onClick: handleLaunch,
          },
          {
            label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
            onClick: handleToggleFavorite,
          },
          ...(addToQuickstartList
            ? [
                {
                  label: 'Add to quickstart list',
                  onClick: handleAddToQuickstartList,
                },
              ]
            : []),
          {
            label: 'Rename',
            onClick: handleRename,
          },
        ]}
      >
        <MoreHoriz />
      </CascadingMenuButton>
    </div>
  )
}

export default SessionNameCell
