import { useLocalStorage } from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import { invokeIpc } from '../../../ipc.ts'
import { useNotifyError } from '../../NotifyContext.ts'
import SessionLoadingScreen from '../../SessionLoadingScreen.tsx'
import { useUpdateStatus } from '../../useUpdateStatus.ts'
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
  const { status, updateStatus } = useUpdateStatus()

  const [favorites, setFavorites] = useLocalStorage<Fav[]>(
    'startScreen-favEntries',
    defaultFavs,
  )

  async function launchSession(
    getEntries: () => Promise<JBrowseConfigInput[]>,
  ) {
    try {
      await updateStatus('Loading session', async () => {
        const entries = await getEntries()
        setPluginManager(await launchSnapshot(mergeConfigInputs(entries)))
      })
    } catch (e) {
      console.error(e)
      notifyError(e)
    }
  }

  const launchFromConfig = (configUrls: string[]) =>
    launchSession(() => Promise.all(configUrls.map(url => fetchConfig(url))))

  const launchFromSnap = (snap: JBrowseConfig) =>
    launchSession(() => Promise.resolve([snap]))

  return (
    <div className={classes.form}>
      {status ? (
        <SessionLoadingScreen message={status} />
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
