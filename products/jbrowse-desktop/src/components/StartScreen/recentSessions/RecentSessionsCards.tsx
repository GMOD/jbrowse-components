import { Grid } from '@mui/material'

import SessionCard from './RecentSessionCard'
import { loadPluginManager } from '../util'

import type { RecentSessionData } from '../types'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function RecentSessionsCards({
  sessions,
  setError,
  setSessionsToDelete,
  setSessionToRename,
  setPluginManager,
  addToQuickstartList,
}: {
  setError: (e: unknown) => void
  setSessionsToDelete: (e: RecentSessionData[]) => void
  setSessionToRename: (arg: RecentSessionData) => void
  setPluginManager: (pm: PluginManager) => void
  sessions: RecentSessionData[]
  addToQuickstartList: (arg: RecentSessionData) => void
}) {
  return (
    <Grid container spacing={4}>
      {sessions.map(session => (
        <SessionCard
          key={session.path}
          sessionData={session}
          onClick={async () => {
            try {
              const pm = await loadPluginManager(session.path)
              setPluginManager(pm)
            } catch (e) {
              console.error(e)
              setError(e)
            }
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
