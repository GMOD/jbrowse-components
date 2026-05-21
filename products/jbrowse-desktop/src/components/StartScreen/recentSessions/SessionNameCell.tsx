import { CascadingMenuButton } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import { Link } from '@mui/material'

import { navigateToSession } from '../../../navigation.ts'
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
  toggleFavorite,
  setSessionToRename,
  addToQuickstartList,
}: {
  value: string
  row: any
  isFavorite: boolean
  toggleFavorite: (sessionPath: string) => void
  setSessionToRename: (arg: RecentSessionData) => void
  addToQuickstartList?: (entry: RecentSessionData) => Promise<void>
}) {
  const { classes } = useStyles()

  return (
    <div className={classes.flexContainer}>
      <Link
        href="#"
        onClick={(e: React.MouseEvent) => {
          e.preventDefault()
          navigateToSession(row.path)
        }}
      >
        {value}
      </Link>
      {isFavorite ? (
        <StarIcon
          isFavorite={isFavorite}
          onClick={() => {
            toggleFavorite(row.id)
          }}
        />
      ) : null}
      <CascadingMenuButton
        menuItems={[
          {
            label: 'Launch',
            onClick: () => {
              navigateToSession(row.path)
            },
          },
          {
            label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
            onClick: () => {
              toggleFavorite(row.id)
            },
          },
          ...(addToQuickstartList
            ? [
                {
                  label: 'Add to quickstart list',
                  onClick: async () => {
                    const { lastModified, ...rest } = row
                    await addToQuickstartList(rest)
                  },
                },
              ]
            : []),
          {
            label: 'Rename',
            onClick: () => {
              const { lastModified, ...rest } = row
              setSessionToRename(rest)
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
