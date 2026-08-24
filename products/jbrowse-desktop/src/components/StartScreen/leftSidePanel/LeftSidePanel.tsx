import { useState } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { useLocalStorage } from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import { invokeIpc } from '../../../ipc.ts'
import { useNotifyError } from '../../NotifyContext.ts'
import { mergeConfigInputs } from '../configInputs.ts'
import defaultFavs from '../defaultFavs.ts'
import { fetchConfig, launchSnapshot } from '../util.tsx'
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
      setPluginManager(await launchSnapshot(mergeConfigInputs(entries)))
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
