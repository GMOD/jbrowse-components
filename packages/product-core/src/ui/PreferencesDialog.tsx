import { Suspense, useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, DialogActions, DialogContent, Tab, Tabs } from '@mui/material'
import { observer } from 'mobx-react'

import GeneralPreferencesTab from './GeneralPreferencesTab.tsx'
import PreferencesResetDialog from './PreferencesResetDialog.tsx'
import ViewPreferencesTab from './ViewPreferencesTab.tsx'
import {
  collectPreferenceChanges,
  resetAllPreferences,
  resetPreferenceChange,
} from './preferencesReset.ts'

import type { GeneralPreferencesSession } from './GeneralPreferencesTab.tsx'
import type { ViewPreferencesSession } from './ViewPreferencesTab.tsx'
import type { ResettablePreferencesSession } from './preferencesReset.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type React from 'react'

const useStyles = makeStyles()({
  container: {
    width: 800,
    minHeight: 300,
  },
})

export interface PreferencesDialogSession
  extends
    GeneralPreferencesSession,
    ViewPreferencesSession,
    ResettablePreferencesSession {}

/**
 * Descriptor returned from the `Core-preferencesDialogPanels` extension point.
 * Each panel renders as its own tab in the dialog, labeled by `name`.
 */
export interface PreferencesPanelDescriptor {
  name: string
  Component: React.ComponentType<{ session: PreferencesDialogSession }>
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'Core-preferencesDialogPanels': {
      args: PreferencesPanelDescriptor[]
      result: PreferencesPanelDescriptor[]
      props: { session: PreferencesDialogSession }
    }
  }
}

const PreferencesDialog = observer(function PreferencesDialog({
  handleClose,
  session,
  pluginManager,
}: {
  handleClose: () => void
  session: PreferencesDialogSession
  pluginManager: PluginManager
}) {
  const { classes } = useStyles()
  const [tab, setTab] = useState('general')
  const [resetDialogOpen, setResetDialogOpen] = useState(false)

  const pluginPanels = pluginManager.evaluateExtensionPoint(
    /** #extensionPoint Core-preferencesDialogPanels | sync | Add tabs to the preferences dialog */
    'Core-preferencesDialogPanels',
    [],
    { session },
  )
  const tabs = [
    {
      value: 'general',
      label: 'General',
      content: <GeneralPreferencesTab session={session} />,
    },
    {
      value: 'views',
      label: 'Views',
      content: <ViewPreferencesTab session={session} />,
    },
    ...pluginPanels.map(({ name, Component }) => ({
      value: `plugin:${name}`,
      label: name,
      content: (
        <Suspense fallback={null}>
          <Component session={session} />
        </Suspense>
      ),
    })),
  ]
  return (
    <Dialog title="Preferences" open onClose={handleClose} maxWidth="xl">
      <Tabs
        value={tab}
        variant="scrollable"
        scrollButtons="auto"
        onChange={(_, value: string) => {
          setTab(value)
        }}
      >
        {tabs.map(t => (
          <Tab key={t.value} value={t.value} label={t.label} />
        ))}
      </Tabs>
      <DialogContent className={classes.container}>
        {tabs.find(t => t.value === tab)?.content}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            setResetDialogOpen(true)
          }}
        >
          Reset to defaults…
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            handleClose()
          }}
        >
          Close
        </Button>
      </DialogActions>
      {resetDialogOpen ? (
        <PreferencesResetDialog
          changes={collectPreferenceChanges(session)}
          onReset={() => {
            resetAllPreferences(session)
          }}
          onResetRow={change => {
            resetPreferenceChange(session, change)
          }}
          onClose={() => {
            setResetDialogOpen(false)
          }}
        />
      ) : null}
    </Dialog>
  )
})

export default PreferencesDialog
