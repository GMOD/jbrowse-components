import { useState } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { useLocalStorage } from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import deepmerge from 'deepmerge'

import { invokeIpc } from '../../../ipc.ts'
import { useNotifyError } from '../../NotifyContext.ts'
import defaultFavs from '../defaultFavs.ts'
import { resolveSessionName } from '../sessionName.ts'
import { fetchConfig, loadPluginManager } from '../util.tsx'
import FavoriteGenomesPanel from './FavoriteGenomesPanel.tsx'
import OpenSequencePanel from './OpenSequencePanel.tsx'
import QuickstartPanel from './QuickstartPanel.tsx'

import type { Fav, JBrowseConfig, JBrowseConfigInput } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

const useStyles = makeStyles()(theme => ({
  form: {
    marginTop: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
}))

async function getQuickstarts(sel: string[]) {
  return Promise.all(sel.map(entry => invokeIpc('getQuickstart', entry)))
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

  async function launchSession(
    getEntries: () => Promise<JBrowseConfigInput[]>,
  ) {
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
          await invokeIpc('createInitialAutosaveFile', {
            ...merged,
            defaultSession: {
              ...entries[0]?.defaultSession,
              // The recent-sessions entry is written from this snapshot, before
              // createPluginManager resolves the session's own name. Defaulting
              // only when defaultSession is absent entirely left a hub config
              // that ships an unnamed one with a nameless start-screen row.
              name: resolveSessionName(entries[0]?.defaultSession ?? {}),
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

  const launchFromConfig = (configUrls: string[]) =>
    launchSession(() => Promise.all(configUrls.map(url => fetchConfig(url))))

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
