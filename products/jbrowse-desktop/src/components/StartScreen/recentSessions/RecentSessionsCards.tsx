import { Grid } from '@mui/material'

import SessionCard from './RecentSessionCard.tsx'

import type { RecentSessionData } from '../types.ts'

export default function RecentSessionsCards({
  sessions,
  setSessionsToDelete,
  setSessionToRename,
  launch,
  addToQuickstartList,
}: {
  setSessionsToDelete: (e: RecentSessionData[]) => void
  setSessionToRename: (arg: RecentSessionData) => void
  launch: (path: string) => Promise<void>
  sessions: RecentSessionData[]
  addToQuickstartList: (arg: RecentSessionData) => Promise<void>
}) {
  return (
    <Grid container spacing={4}>
      {sessions.map(session => (
        <SessionCard
          key={session.path}
          sessionData={session}
          onClick={async () => {
            await launch(session.path)
          }}
          onDelete={() => {
            setSessionsToDelete([session])
          }}
          onRename={setSessionToRename}
          onAddToQuickstartList={addToQuickstartList}
        />
      ))}
    </Grid>
  )
}
