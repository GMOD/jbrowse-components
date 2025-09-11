import { useState } from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { useLocalStorage } from '@jbrowse/core/util'
import deepmerge from 'deepmerge'
import { makeStyles } from 'tss-react/mui'

import FavoriteGenomesPanel from './FavoriteGenomesPanel'
import OpenSequencePanel from './OpenSequencePanel'
import QuickstartPanel from './QuickstartPanel'
import { useDefaultFavs } from '../const'
import { addRelativeUris, fetchjson, loadPluginManager } from '../util'

import type { Fav, JBrowseConfig } from '../types'
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
  const { defaultFavs, isLoading: defaultFavsLoading, error: defaultFavsError } = useDefaultFavs()
  const [favorites, setFavorites] = useLocalStorage<Fav[]>(
    'startScreen-favEntries',
    defaultFavs || [],
  )

  async function initializeSession(entries: JBrowseConfig[]) {
    try {
      setLoading('Creating session')
      setPluginManager(
        await loadPluginManager(
          await ipcRenderer.invoke('createInitialAutosaveFile', {
            ...deepmerge.all(entries),
            defaultSession: {
              name: `New session ${new Date().toLocaleString('en-US')}`,
            },
          }),
        ),
      )
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }

  async function structuredCb(cb: () => Promise<void>) {
    try {
      setLoading('Launching')
      await cb()
    } catch (e) {
      setError(e)
    } finally {
      setLoading('')
    }
  }

  return (
    <div className={classes.form}>
      {error ? <ErrorMessage error={error} /> : null}
      {defaultFavsError ? <ErrorMessage error={defaultFavsError} /> : null}
      {loading || defaultFavsLoading ? (
        <LoadingEllipses 
          variant="h6" 
          message={loading || 'Loading default favorites...'} 
        />
      ) : (
        <>
          <OpenSequencePanel
            setPluginManager={setPluginManager}
            favorites={favorites}
            setFavorites={setFavorites}
            defaultFavs={defaultFavs}
            launch={sel =>
              structuredCb(async () => {
                await initializeSession(await fetchData(sel))
              })
            }
          />
          <FavoriteGenomesPanel
            favorites={favorites}
            setFavorites={setFavorites}
            launch={sel =>
              structuredCb(async () => {
                await initializeSession(await fetchData(sel))
              })
            }
          />
          <QuickstartPanel
            launch={sel =>
              structuredCb(async () => {
                await initializeSession(await getQuickstarts(sel))
              })
            }
          />
        </>
      )}
    </div>
  )
}
