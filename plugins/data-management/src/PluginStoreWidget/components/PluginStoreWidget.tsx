import React, { useState, useEffect } from 'react'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getParent, getEnv } from 'mobx-state-tree'

import { makeStyles } from '@material-ui/core/styles'
import { Typography } from '@material-ui/core'
import Accordion from '@material-ui/core/Accordion'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import TextField from '@material-ui/core/TextField'
import InputAdornment from '@material-ui/core/InputAdornment'
import Button from '@material-ui/core/Button'
import IconButton from '@material-ui/core/IconButton'

import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import ClearIcon from '@material-ui/icons/Clear'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'

import type { JBrowsePlugin, BasePlugin } from '@jbrowse/core/util/types'

import { isElectron } from '@jbrowse/core/util'
import InstalledPluginsList from './InstalledPluginsList'
import PluginCard from './PluginCard'
import CustomPluginForm from './CustomPluginForm'

import { PluginStoreModel } from '../model'

const useStyles = makeStyles(theme => ({
  accordion: {
    marginTop: '1em',
  },
  expandIcon: {
    color: '#fff',
  },
  searchBox: {
    marginBottom: theme.spacing(2),
  },
  adminBadge: {
    margin: '0.5em',
    borderRadius: 3,
    backgroundColor: theme.palette.quaternary.main,
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
  const [pluginArray, setPluginArray] = useState([])
  const [customPluginFormOpen, setCustomPluginFormOpen] = useState(false)

  useEffect(() => {
    if (pluginArray.length === 0) {
      fetchPluginArray()
    }
  })

  const fetchPluginArray = async () => {
    const fetchResult = await fetch(
      'https://s3.amazonaws.com/jbrowse.org/plugin-store/plugins.json',
    )
    if (!fetchResult.ok) {
      throw new Error('Failed to fetch plugin data')
    }
    const array = await fetchResult.json()
    setPluginArray(array.plugins)
  }

  const handleInputChange = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    model.setFilterText(event.target.value)
  }

  const rootModel = getParent(model, 3)
  const { adminMode } = rootModel
  const { pluginManager } = getEnv(model)

  return (
    <div>
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
            onClose={setCustomPluginFormOpen}
            model={model}
          />
        </>
      )}
      <TextField
        className={classes.searchBox}
        label="Filter plugins"
        value={model.filterText}
        onChange={handleInputChange}
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
        {pluginArray
          .filter((plugin: BasePlugin) => {
            return plugin.name
              .toLowerCase()
              .includes(model.filterText.toLowerCase())
          })
          .map(plugin => (
            <PluginCard
              key={(plugin as JBrowsePlugin).name}
              plugin={plugin}
              model={model}
              adminMode={adminMode}
            />
          ))}
      </Accordion>
    </div>
  )
}

PluginStoreWidget.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(PluginStoreWidget)
