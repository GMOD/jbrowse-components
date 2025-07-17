import { useCallback, useMemo } from 'react'

import { CascadingMenuButton } from '@jbrowse/core/ui'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import StarIcon from '@mui/icons-material/Star'
import { Link } from '@mui/material'

import { loadPluginManager } from '../util'

import type { RecentSessionData } from '../types'
import type PluginManager from '@jbrowse/core/PluginManager'

function SessionNameCell({
  value,
  row,
  isFavorite,
  classes,
  setPluginManager,
  setError,
  toggleFavorite,
  setSessionToRename,
}: {
  value: string
  row: any
  isFavorite: boolean
  classes: any
  setPluginManager: (pm: PluginManager) => void
  setError: (e: unknown) => void
  toggleFavorite: (sessionPath: string) => void
  setSessionToRename: (arg: RecentSessionData) => void
}) {
  const handleLaunch = useCallback(async () => {
    try {
      setPluginManager(await loadPluginManager(row.path))
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }, [row.path, setPluginManager, setError])

  const handleToggleFavorite = useCallback(() => {
    toggleFavorite(row.id)
  }, [row.id, toggleFavorite])

  const handleRename = useCallback(() => {
    const { lastModified, ...rest } = row
    setSessionToRename(rest)
  }, [row, setSessionToRename])

  const handleLinkClick = useCallback(
    async (event: React.MouseEvent) => {
      event.preventDefault()
      await handleLaunch()
    },
    [handleLaunch],
  )

  const menuItems = useMemo(
    () => [
      {
        label: 'Launch',
        onClick: handleLaunch,
      },
      {
        label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
        onClick: handleToggleFavorite,
      },
      {
        label: 'Rename',
        onClick: handleRename,
      },
    ],
    [isFavorite, handleLaunch, handleToggleFavorite, handleRename],
  )

  return (
    <div className={classes.flexContainer}>
      <Link href="#" className={classes.cell} onClick={handleLinkClick}>
        {value}
      </Link>
      {isFavorite ? <StarIcon className={classes.starIcon} /> : null}
      <CascadingMenuButton menuItems={menuItems}>
        <MoreHoriz />
      </CascadingMenuButton>
    </div>
  )
}

export default SessionNameCell

