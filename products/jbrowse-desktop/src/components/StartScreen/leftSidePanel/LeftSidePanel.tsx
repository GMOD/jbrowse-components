import { useState } from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { fetchJson as fetchjson, useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import deepmerge from 'deepmerge'

import FavoriteGenomesPanel from './FavoriteGenomesPanel.tsx'
import OpenSequencePanel from './OpenSequencePanel.tsx'
import QuickstartPanel from './QuickstartPanel.tsx'
import defaultFavs from '../defaultFavs.ts'
import { addRelativeUris, loadPluginManager } from '../util.tsx'

import type { Fav, JBrowseConfig } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()(theme => ({
  form: {
    marginTop: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
}))

async function fetchData(sel: { shortName: string; jbrowseConfig: string }[]) {
  return Promise.all(
    sel.map(async r => {
      const ret = (await fetchjson(r.jbrowseConfig)) as JBrowseConfig
      addRelativeUris(
        // @ts-expect-error
        ret as Record<string, unknown>,
        new URL(r.jbrowseConfig),
      )
      return ret
    }),
  )
}

async function getQuickstarts(sel: string[]) {
  return Promise.all(
    sel.map(entry => ipcRenderer.invoke('getQuickstart', entry)),
  )
}

export default function LauncherPanel({
  setPluginManager,
}: {
  setPluginManager: (arg0: PluginManager) => void
}) {
  const { classes } = useStyles()
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState('')

  const [favorites, setFavorites] = useLocalStorage<Fav[]>(
    'startScreen-favEntries',
    defaultFavs,
  )

  async function launchSession(getEntries: () => Promise<JBrowseConfig[]>) {
    try {
      setLoading('Loading session')
      const entries = await getEntries()
      setPluginManager(
        await loadPluginManager(
          await ipcRenderer.invoke('createInitialAutosaveFile', {
            ...deepmerge.all(entries),
            defaultSession: entries[0]?.defaultSession ?? {
              name: `New session ${new Date().toLocaleString('en-US')}`,
            },
          }),
        ),
      )
    } catch (e) {
      console.error(e)
      setError(e)
    } finally {
      setLoading('')
    }
  }

  const launchFromConfig = (sel: { shortName: string; jbrowseConfig: string }[]) =>
    launchSession(() => fetchData(sel))

  const launchFromSnap = (snap: JBrowseConfig) =>
    launchSession(async () => [snap])

  return (
    <div className={classes.form}>
      {error ? <ErrorMessage error={error} /> : null}
      {loading ? (
        <LoadingEllipses variant="h6" message={loading} />
      ) : (
        <>
          <OpenSequencePanel
            favorites={favorites}
            setFavorites={setFavorites}
            launch={launchFromConfig}
            launchFromSnap={launchFromSnap}
          />
          <FavoriteGenomesPanel
            favorites={favorites}
            setFavorites={setFavorites}
            launch={launchFromConfig}
          />
          <QuickstartPanel
            launch={sel => launchSession(() => getQuickstarts(sel))}
          />
        </>
      )}
    </div>
  )
}
