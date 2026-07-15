import { ActionLink, CascadingMenuButton } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreHoriz from '@mui/icons-material/MoreHoriz'

import { sessionMenuItems } from './sessionMenuItems.ts'
import StarIcon from '../StarIcon.tsx'

import type { RecentSessionData } from '../types.ts'

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
  setSessionsToDelete,
  addToQuickstartList,
}: {
  value: string
  row: RecentSessionData
  isFavorite: boolean
  launch: (path: string) => Promise<void>
  toggleFavorite: (sessionPath: string) => void
  setSessionToRename: (arg: RecentSessionData) => void
  setSessionsToDelete: (arg: RecentSessionData[]) => void
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
        menuItems={sessionMenuItems({
          session: row,
          isFavorite,
          launch,
          onRename: setSessionToRename,
          onDelete: session => {
            setSessionsToDelete([session])
          },
          onToggleFavorite: () => {
            toggleFavorite(row.path)
          },
          onAddToQuickstartList: addToQuickstartList,
          includeLaunch: true,
        })}
      >
        <MoreHoriz />
      </CascadingMenuButton>
    </div>
  )
}

export default SessionNameCell
