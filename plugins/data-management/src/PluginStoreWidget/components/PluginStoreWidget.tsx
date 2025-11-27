import { lazy } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { getSession, isElectron } from '@jbrowse/core/util'
import ClearIcon from '@mui/icons-material/Clear'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import {
  Accordion,
  AccordionSummary,
  Button,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { getEnv } from '@jbrowse/mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

import InstalledPluginsList from './InstalledPluginsList'
import PluginCard from './PluginCard'
import { useFetchPlugins } from './util'

import type { PluginStoreModel } from '../model'

// lazies
const AddCustomPluginDialog = lazy(() => import('./AddCustomPluginDialog'))

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

const PluginStoreWidget = observer(function ({
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
      <TextField
        label="Filter plugins"
        value={filterText}
        onChange={event => {
          model.setFilterText(event.target.value)
        }}
        fullWidth
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => {
                    model.clearFilterText()
                  }}
                >
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Installed plugins</Typography>
        </AccordionSummary>
        <div className={classes.m}>
          <InstalledPluginsList pluginManager={pluginManager} model={model} />
        </div>
      </Accordion>
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Available plugins</Typography>
        </AccordionSummary>
        {error ? (
          <Typography color="error">{`${error}`}</Typography>
        ) : plugins ? (
          plugins
            .filter(
              plugin =>
                // If plugin only has cjsUrl, don't display outside desktop
                !(isElectron && plugin.cjsUrl) &&
                plugin.name.toLowerCase().includes(filterText.toLowerCase()),
            )
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
