import React, { useState, useEffect } from 'react'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getParent } from 'mobx-state-tree'

import { makeStyles } from '@material-ui/core/styles'
import { Typography } from '@material-ui/core'
import Accordion from '@material-ui/core/Accordion'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import TextField from '@material-ui/core/TextField'
import InputAdornment from '@material-ui/core/InputAdornment'
import IconButton from '@material-ui/core/IconButton'

import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import ClearIcon from '@material-ui/icons/Clear'

import InstalledPlugins from './InstalledPlugins'
import PluginCard from './PluginCard'

import type { JBrowsePlugin, TextUpdateEvent } from '../types'
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
}))

function PluginStoreWidget({ model }: { model: PluginStoreModel }) {
  const classes = useStyles()

  const [pluginArray, setPluginArray] = useState([])

  useEffect(() => {
    if (pluginArray.length === 0) {
      fetchPluginArray()
    }
  })

  const fetchPluginArray = async () => {
    const fetchResult = await fetch(
      'https://s3.amazonaws.com/jbrowse.org/plugin-store/plugins.json',
    )
    if (fetchResult.status !== 200) {
      throw new Error('Failed to fetch plugin data')
    }
    const array = await fetchResult.json()
    setPluginArray(array.plugins)
  }

  const handleInputChange = (event: TextUpdateEvent) => {
    model.setFilterText(event.target.value)
  }

  const rootModel = getParent(model, 3)
  const { pluginManager } = rootModel

  return (
    <div>
      <TextField
        className={classes.searchBox}
        label="Filter plugins"
        value={model.filterText}
        onChange={handleInputChange}
        fullWidth
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton color="secondary">
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
          <InstalledPlugins pluginManager={pluginManager} />
        </div>
      </Accordion>
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Available plugins</Typography>
        </AccordionSummary>
        {pluginArray.map(plugin => (
          <PluginCard key={(plugin as JBrowsePlugin).name} plugin={plugin} />
        ))}
      </Accordion>
    </div>
  )
}

PluginStoreWidget.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(PluginStoreWidget)
