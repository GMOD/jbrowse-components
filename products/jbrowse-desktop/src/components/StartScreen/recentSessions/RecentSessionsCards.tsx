import { Grid } from '@mui/material'

import { useInnerDims } from '../availableGenomes/util.ts'
import SessionCard from './RecentSessionCard.tsx'

import type { RecentSessionData } from '../types.ts'

export default function RecentSessionsCards({
  sessions,
  setSessionsToDelete,
  setSessionToRename,
  launch,
  addToQuickstartList,
  isFavorite,
  toggleFavorite,
}: {
  setSessionsToDelete: (e: RecentSessionData[]) => void
  setSessionToRename: (arg: RecentSessionData) => void
  launch: (path: string) => Promise<void>
  sessions: RecentSessionData[]
  addToQuickstartList: (arg: RecentSessionData) => Promise<void>
  isFavorite: (sessionPath: string) => boolean
  toggleFavorite: (sessionPath: string) => void
}) {
  const { height: innerHeight } = useInnerDims()
  return (
    <div style={{ maxHeight: innerHeight / 2, overflow: 'auto' }}>
      <Grid container spacing={4}>
        {sessions.map(session => (
          <SessionCard
            key={session.path}
            sessionData={session}
            isFavorite={isFavorite(session.path)}
            launch={launch}
            onDelete={session => {
              setSessionsToDelete([session])
            }}
            onRename={setSessionToRename}
            onAddToQuickstartList={addToQuickstartList}
            onToggleFavorite={() => {
              toggleFavorite(session.path)
            }}
          />
        ))}
      </Grid>
    </div>
  )
}
