import { ActionLink, CascadingMenuButton } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreHoriz from '@mui/icons-material/MoreHoriz'

import StarIcon from '../StarIcon.tsx'
import { sessionMenuItems } from './sessionMenuItems.ts'

import type { RecentSessionData } from '../types.ts'

const useStyles = makeStyles()({
  flexContainer: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
  },
  // text-overflow has no effect on a flex container, only on the flex item
  // holding the text
  name: {
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  icons: {
    display: 'flex',
    flexShrink: 0,
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
        className={classes.name}
        title={value}
        onClick={async () => {
          await launch(row.path)
        }}
      >
        {value}
      </ActionLink>
      <div className={classes.icons}>
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
    </div>
  )
}

export default SessionNameCell
