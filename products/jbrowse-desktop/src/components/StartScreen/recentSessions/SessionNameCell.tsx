import { formatSessionSummary } from '@jbrowse/app-core'
import { ActionLink, CascadingMenuButton } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import { observer } from 'mobx-react'

import StarIcon from '../StarIcon.tsx'
import { sessionMenuItems } from './sessionMenuItems.ts'

import type { RecentSessionData } from '../types.ts'

const useStyles = makeStyles()(theme => ({
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
  summary: {
    color: theme.palette.text.secondary,
  },
  icons: {
    display: 'flex',
    flexShrink: 0,
  },
}))

const SessionNameCell = observer(function SessionNameCell({
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
  const summary = row.summary && formatSessionSummary(row.summary)

  return (
    <div className={classes.flexContainer}>
      <div
        className={classes.name}
        title={
          summary
            ? `${value}
${summary}`
            : value
        }
      >
        <ActionLink
          onClick={async () => {
            await launch(row.path)
          }}
        >
          {value}
        </ActionLink>
        {summary ? <span className={classes.summary}> · {summary}</span> : null}
      </div>
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
})

export default SessionNameCell
