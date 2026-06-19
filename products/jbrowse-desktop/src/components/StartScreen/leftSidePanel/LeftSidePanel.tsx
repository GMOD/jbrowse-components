import { useState } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { fetchJson as fetchjson, useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import deepmerge from 'deepmerge'

import FavoriteGenomesPanel from './FavoriteGenomesPanel.tsx'
import OpenSequencePanel from './OpenSequencePanel.tsx'
import QuickstartPanel from './QuickstartPanel.tsx'
import { useNotifyError } from '../../NotifyContext.ts'
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
      const ret = await fetchjson(r.jbrowseConfig)
      addRelativeUris(ret as Record<string, unknown>, new URL(r.jbrowseConfig))
      // record where this hub config came from so "export to web" can reuse it
      // as the session base (?config=<sourceConfigUrl>)
      const cfg = ret as JBrowseConfig
      cfg.configuration = {
        ...cfg.configuration,
        sourceConfigUrl: r.jbrowseConfig,
      }
      return cfg
    }),
  )
}

async function getQuickstarts(sel: string[]) {
  return Promise.all(
    sel.map(entry => ipcRenderer.invoke('getQuickstart', entry)),
  )
}

export default function LeftSidePanel({
  setPluginManager,
}: {
  setPluginManager: (arg0: PluginManager) => void
}) {
  const { classes } = useStyles()
  const notifyError = useNotifyError()
  const [loading, setLoading] = useState('')

  const [favorites, setFavorites] = useLocalStorage<Fav[]>(
    'startScreen-favEntries',
    defaultFavs,
  )

  async function launchSession(getEntries: () => Promise<JBrowseConfig[]>) {
    try {
      setLoading('Loading session')
      const entries = await getEntries()
      const merged = deepmerge.all(entries) as JBrowseConfig
      // a single hub config can be reused as the export base; merging several
      // leaves no single source config, so drop the marker the entries carry
      if (entries.length > 1 && merged.configuration) {
        merged.configuration = { ...merged.configuration, sourceConfigUrl: '' }
      }
      setPluginManager(
        await loadPluginManager(
          await ipcRenderer.invoke('createInitialAutosaveFile', {
            ...merged,
            defaultSession: entries[0]?.defaultSession ?? {
              name: `New session ${new Date().toLocaleString('en-US')}`,
            },
          }),
        ),
      )
    } catch (e) {
      console.error(e)
      notifyError(e)
    } finally {
      setLoading('')
    }
  }

  const launchFromConfig = (
    sel: { shortName: string; jbrowseConfig: string }[],
  ) => launchSession(() => fetchData(sel))

  const launchFromSnap = (snap: JBrowseConfig) =>
    launchSession(() => Promise.resolve([snap]))

  return (
    <div className={classes.form}>
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
