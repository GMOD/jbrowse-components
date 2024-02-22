import React from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import SessionCard from './SessionCard'
import { loadPluginManager, RecentSessionData } from './util'
import { Grid } from '@mui/material'

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
      {sessions?.map(session => (
        <Grid item key={session.path}>
          <SessionCard
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
            onDelete={del => setSessionsToDelete([del])}
            onRename={setSessionToRename}
            onAddToQuickstartList={addToQuickstartList}
          />
        </Grid>
      ))}
    </Grid>
  )
}
