import { useState } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button } from '@mui/material'
import deepmerge from 'deepmerge'

import FavoriteGenomesPanel from './FavoriteGenomesPanel.tsx'
import OpenSequencePanel from './OpenSequencePanel.tsx'
import QuickstartPanel from './QuickstartPanel.tsx'
import { useNotifyError } from '../../NotifyContext.ts'
import defaultFavs from '../defaultFavs.ts'
import OpenLinkDialog from '../dialogs/OpenLinkDialog.tsx'
import { newSessionName } from '../sessionName.ts'
import { fetchConfig, loadPluginManager, openSpecLink } from '../util.tsx'

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
  return Promise.all(sel.map(r => fetchConfig(r.jbrowseConfig)))
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
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)

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
              name: newSessionName(),
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

  // A pasted link builds its session from a spec rather than a config's
  // defaultSession, so it can't go through launchSession — openSpecLink needs
  // the plugin manager in hand before loadSessionSpec runs against it.
  async function launchLink(link: string) {
    setLoading('Opening link')
    try {
      setPluginManager(await openSpecLink(link))
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
          <Button
            variant="outlined"
            onClick={() => {
              setLinkDialogOpen(true)
            }}
          >
            Open JBrowse Web link...
          </Button>
          {linkDialogOpen ? (
            <OpenLinkDialog
              onSubmit={launchLink}
              onClose={() => {
                setLinkDialogOpen(false)
              }}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
