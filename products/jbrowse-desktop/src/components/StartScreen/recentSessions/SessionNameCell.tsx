import { useCallback, useMemo } from 'react'

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
  row: any
  isFavorite: boolean
  setPluginManager: (pm: PluginManager) => void
  setError: (e: unknown) => void
  toggleFavorite: (sessionPath: string) => void
  setSessionToRename: (arg: RecentSessionData) => void
  addToQuickstartList?: (entry: RecentSessionData) => Promise<void>
}) {
  const { classes } = useStyles()
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

  const handleAddToQuickstartList = useCallback(async () => {
    if (addToQuickstartList) {
      const { lastModified, ...rest } = row
      await addToQuickstartList(rest)
    }
  }, [row, addToQuickstartList])

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
    ],
    [
      isFavorite,
      handleLaunch,
      handleToggleFavorite,
      handleRename,
      addToQuickstartList,
      handleAddToQuickstartList,
    ],
  )

  return (
    <div className={classes.flexContainer}>
      <Link href="#" onClick={handleLinkClick}>
        {value}
      </Link>
      {isFavorite ? (
        <StarIcon isFavorite={isFavorite} onClick={handleToggleFavorite} />
      ) : null}
      <CascadingMenuButton menuItems={menuItems}>
        <MoreHoriz />
      </CascadingMenuButton>
    </div>
  )
}

export default SessionNameCell
