import { Grid } from '@mui/material'

import SessionCard from './RecentSessionCard.tsx'
import { navigateToSession } from '../../../navigation.ts'

import type { RecentSessionData } from '../types.ts'

export default function RecentSessionsCards({
  sessions,
  setSessionsToDelete,
  setSessionToRename,
  addToQuickstartList,
}: {
  setSessionsToDelete: (e: RecentSessionData[]) => void
  setSessionToRename: (arg: RecentSessionData) => void
  sessions: RecentSessionData[]
  addToQuickstartList: (arg: RecentSessionData) => void
}) {
  return (
    <Grid container spacing={4}>
      {sessions.map(session => (
        <SessionCard
          key={session.path}
          sessionData={session}
          onClick={() => {
            navigateToSession(session.path)
          }}
          onDelete={del => {
            setSessionsToDelete([del])
          }}
          onRename={setSessionToRename}
          onAddToQuickstartList={addToQuickstartList}
        />
      ))}
    </Grid>
  )
}
