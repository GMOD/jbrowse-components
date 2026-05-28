import { Grid } from '@mui/material'

import SessionCard from './RecentSessionCard.tsx'

import type { RecentSessionData } from '../types.ts'

export default function RecentSessionsCards({
  sessions,
  setSessionsToDelete,
  setSessionToRename,
  launch,
  addToQuickstartList,
  favorites,
  toggleFavorite,
}: {
  setSessionsToDelete: (e: RecentSessionData[]) => void
  setSessionToRename: (arg: RecentSessionData) => void
  launch: (path: string) => Promise<void>
  sessions: RecentSessionData[]
  addToQuickstartList: (arg: RecentSessionData) => Promise<void>
  favorites: string[]
  toggleFavorite: (sessionPath: string) => void
}) {
  const favs = new Set(favorites)
  return (
    <Grid container spacing={4}>
      {sessions.map(session => (
        <SessionCard
          key={session.path}
          sessionData={session}
          isFavorite={favs.has(session.path)}
          onClick={async () => {
            await launch(session.path)
          }}
          onDelete={() => {
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
  )
}
