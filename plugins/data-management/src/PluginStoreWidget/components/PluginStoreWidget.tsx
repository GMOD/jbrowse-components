import { lazy } from 'react'

import { vendoredPluginNames } from '@jbrowse/core/PluginLoader'
import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { getSession, isElectron } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getEnv } from '@jbrowse/mobx-state-tree'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { Accordion, AccordionSummary, Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import ClearableSearchField from '../../shared/ClearableSearchField.tsx'
import InstalledPluginsList from './InstalledPluginsList.tsx'
import PluginCard from './PluginCard.tsx'
import { useFetchPlugins } from './util.ts'

import type { PluginStoreModel } from '../model.ts'

// lazies
const AddCustomPluginDialog = lazy(() => import('./AddCustomPluginDialog.tsx'))

const useStyles = makeStyles()(theme => ({
  expandIcon: {
    color: theme.palette.tertiary.contrastText,
  },
  adminBadge: {
    borderRadius: 3,
    backgroundColor: theme.palette.quaternary.main,
    padding: '1em',
    display: 'flex',
    alignContent: 'center',
  },
  customPluginButton: {
    margin: '1em auto',
    display: 'flex',
  },
  mr: {
    marginRight: '0.3em',
  },
  m: {
    margin: '1em',
  },
}))

const PluginStoreWidget = observer(function PluginStoreWidget({
  model,
}: {
  model: PluginStoreModel
}) {
  const { classes } = useStyles()
  const { plugins, error } = useFetchPlugins()
  const { filterText } = model
  const session = getSession(model)
  const { adminMode } = session
  const { pluginManager } = getEnv(model)

  return (
    <div>
      {adminMode && (
        <>
          {!isElectron && (
            <div className={classes.adminBadge}>
              <InfoOutlinedIcon className={classes.mr} />
              <Typography>
                You are using the <code>admin-server</code>. Any changes you
                make will be saved to your configuration file. You also have the
                ability to add custom plugins that are not in the store.
              </Typography>
            </div>
          )}
          <Button
            className={classes.customPluginButton}
            variant="contained"
            onClick={() => {
              session.queueDialog(onClose => [
                AddCustomPluginDialog,
                {
                  model,
                  onClose,
                },
              ])
            }}
          >
            Add custom plugin
          </Button>
        </>
      )}
      <ClearableSearchField
        fullWidth
        label="Filter plugins"
        value={filterText}
        onChange={text => {
          model.setFilterText(text)
        }}
      />
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Installed plugins</Typography>
        </AccordionSummary>
        <div className={classes.m}>
          <InstalledPluginsList
            pluginManager={pluginManager}
            model={model}
            storePlugins={plugins}
          />
        </div>
      </Accordion>
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Available plugins</Typography>
        </AccordionSummary>
        {error ? (
          <ErrorMessage error={error} />
        ) : plugins ? (
          plugins
            .filter(plugin => {
              // a plugin with only a cjsUrl (no web build) can't load on web,
              // so hide it unless we're on desktop
              const hasWebBuild = Boolean(
                plugin.esmUrl || plugin.url || plugin.umdUrl,
              )
              // plugins since vendored into core (e.g. MafViewer) are dropped at
              // load, so installing one does nothing — hide it from the store
              const vendored = vendoredPluginNames.has(plugin.name)
              return (
                !vendored &&
                (isElectron || hasWebBuild) &&
                plugin.name.toLowerCase().includes(filterText.toLowerCase())
              )
            })
            .map(plugin => (
              <PluginCard key={plugin.name} plugin={plugin} model={model} />
            ))
        ) : (
          <LoadingEllipses />
        )}
      </Accordion>
    </div>
  )
})

export default PluginStoreWidget
