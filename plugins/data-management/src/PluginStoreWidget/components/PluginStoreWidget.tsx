import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'

import {
  Accordion,
  AccordionSummary,
  TextField,
  InputAdornment,
  Button,
  IconButton,
  Typography,
  makeStyles,
} from '@material-ui/core'

import { JBrowsePlugin } from '@jbrowse/core/util/types'
import { getSession, isElectron } from '@jbrowse/core/util'

// icons
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import ClearIcon from '@material-ui/icons/Clear'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'

// locals
import InstalledPluginsList from './InstalledPluginsList'
import PluginCard from './PluginCard'
import CustomPluginForm from './CustomPluginForm'
import { PluginStoreModel } from '../model'

const useStyles = makeStyles(theme => ({
  root: {
    margin: theme.spacing(1),
  },
  expandIcon: {
    color: '#fff',
  },
  adminBadge: {
    margin: '0.5em',
    borderRadius: 3,
    // this is the quaternary color in JB2 palette
    backgroundColor: '#FFB11D',
    padding: '1em',
    display: 'flex',
    alignContent: 'center',
  },
  customPluginButton: {
    margin: '0.5em',
    display: 'flex',
    justifyContent: 'center',
  },
}))

function PluginStoreWidget({ model }: { model: PluginStoreModel }) {
  const classes = useStyles()
  const [pluginArray, setPluginArray] = useState<JBrowsePlugin[]>()
  const [error, setError] = useState<unknown>()
  const [customPluginFormOpen, setCustomPluginFormOpen] = useState(false)
  const { adminMode } = getSession(model)
  const { pluginManager } = getEnv(model)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    ;(async () => {
      try {
        const response = await fetch(
          'https://jbrowse.org/plugin-store/plugins.json',
          { signal },
        )
        if (!response.ok) {
          const err = await response.text()
          throw new Error(
            `Failed to fetch plugin data: ${response.status} ${response.statusText} ${err}`,
          )
        }
        const array = await response.json()
        if (!signal.aborted) {
          setPluginArray(array.plugins)
        }
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()

    return () => {
      controller.abort()
    }
  }, [])

  return (
    <div className={classes.root}>
      {adminMode && (
        <>
          {!isElectron && (
            <div className={classes.adminBadge}>
              <InfoOutlinedIcon style={{ marginRight: '0.3em' }} />
              <Typography>
                You are using the <code>admin-server</code>. Any changes you
                make will be saved to your configuration file. You also have the
                ability to add custom plugins that are not in the store.
              </Typography>
            </div>
          )}
          <div className={classes.customPluginButton}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setCustomPluginFormOpen(true)}
            >
              Add custom plugin
            </Button>
          </div>
          <CustomPluginForm
            open={customPluginFormOpen}
            onClose={() => setCustomPluginFormOpen(false)}
            model={model}
          />
        </>
      )}
      <TextField
        label="Filter plugins"
        value={model.filterText}
        onChange={event => model.setFilterText(event.target.value)}
        fullWidth
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                color="secondary"
                onClick={() => model.clearFilterText()}
              >
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Installed plugins</Typography>
        </AccordionSummary>
        <div style={{ margin: '1em' }}>
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
        ) : pluginArray ? (
          pluginArray
            .filter(plugin => {
              // If pugin only has cjsUrl, don't display outside desktop
              if (
                !isElectron &&
                !(plugin.esmUrl || plugin.url || plugin.umdUrl)
              ) {
                return false
              }
              return plugin.name
                .toLowerCase()
                .includes(model.filterText.toLowerCase())
            })
            .map(plugin => (
              <PluginCard
                key={(plugin as JBrowsePlugin).name}
                plugin={plugin}
                model={model}
                adminMode={!!adminMode}
              />
            ))
        ) : (
          <Typography>Loading...</Typography>
        )}
      </Accordion>
    </div>
  )
}

export default observer(PluginStoreWidget)
