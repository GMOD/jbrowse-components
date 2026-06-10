import { ActionLink, CascadingMenuButton } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreHoriz from '@mui/icons-material/MoreHoriz'

import StarIcon from '../StarIcon.tsx'

import type { RecentSessionData } from '../types.ts'

const { ipcRenderer } = window.require('electron')

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
  launch,
  toggleFavorite,
  setSessionToRename,
  addToQuickstartList,
}: {
  value: string
  row: RecentSessionData
  isFavorite: boolean
  launch: (path: string) => Promise<void>
  toggleFavorite: (sessionPath: string) => void
  setSessionToRename: (arg: RecentSessionData) => void
  addToQuickstartList?: (entry: RecentSessionData) => Promise<void>
}) {
  const { classes } = useStyles()

  return (
    <div className={classes.flexContainer}>
      <ActionLink
        onClick={async () => {
          await launch(row.path)
        }}
      >
        {value}
      </ActionLink>
      <StarIcon
        isFavorite={isFavorite}
        onClick={() => {
          toggleFavorite(row.path)
        }}
      />
      <CascadingMenuButton
        menuItems={[
          {
            label: 'Launch',
            onClick: async () => {
              await launch(row.path)
            },
          },
          {
            label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
            onClick: () => {
              toggleFavorite(row.path)
            },
          },
          ...(addToQuickstartList
            ? [
                {
                  label: 'Add to quickstart list',
                  onClick: async () => {
                    await addToQuickstartList(row)
                  },
                },
              ]
            : []),
          {
            label: 'Rename',
            onClick: () => {
              setSessionToRename(row)
            },
          },
          {
            label: 'Show in folder',
            onClick: () => {
              ipcRenderer.invoke('showItemInFolder', row.path).catch(console.error)
            },
          },
        ]}
      >
        <MoreHoriz />
      </CascadingMenuButton>
    </div>
  )
}

export default SessionNameCell
