import { useState } from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import deepmerge from 'deepmerge'

import FavoriteGenomesPanel from './FavoriteGenomesPanel.tsx'
import OpenSequencePanel from './OpenSequencePanel.tsx'
import QuickstartPanel from './QuickstartPanel.tsx'
import { navigateToSession } from '../../../navigation.ts'
import defaultFavs from '../defaultFavs.ts'
import { addRelativeUris, fetchjson } from '../util.tsx'

import type { Fav, JBrowseConfig } from '../types.ts'

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

export default function LauncherPanel() {
  const { classes } = useStyles()
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState('')

  const [favorites, setFavorites] = useLocalStorage<Fav[]>(
    'startScreen-favEntries',
    defaultFavs,
  )

  async function launch(cb: () => Promise<void>) {
    try {
      setLoading('Launching')
      await cb()
    } catch (e) {
      console.error(e)
      setError(e)
    } finally {
      setLoading('')
    }
  }

  async function launchFromConfigs(entries: JBrowseConfig[]) {
    const path = await ipcRenderer.invoke('createInitialAutosaveFile', {
      ...deepmerge.all(entries),
      defaultSession: entries[0]?.defaultSession ?? {
        name: `New session ${new Date().toLocaleString('en-US')}`,
      },
    })
    navigateToSession(path)
  }

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
            launch={sel =>
              launch(async () => {
                await launchFromConfigs(await fetchData(sel))
              })
            }
          />
          <FavoriteGenomesPanel
            favorites={favorites}
            setFavorites={setFavorites}
            launch={sel =>
              launch(async () => {
                await launchFromConfigs(await fetchData(sel))
              })
            }
          />
          <QuickstartPanel
            launch={sel =>
              launch(async () => {
                await launchFromConfigs(await getQuickstarts(sel))
              })
            }
          />
        </>
      )}
    </div>
  )
}
