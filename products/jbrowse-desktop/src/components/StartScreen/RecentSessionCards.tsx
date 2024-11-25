import React from 'react'
import { Grid } from '@mui/material'
import SessionCard from './SessionCard'
import { loadPluginManager } from './util'
import type { RecentSessionData } from './util'
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
            onDelete={del => {
              setSessionsToDelete([del])
            }}
            onRename={setSessionToRename}
            onAddToQuickstartList={addToQuickstartList}
          />
        </Grid>
      ))}
    </Grid>
  )
}
