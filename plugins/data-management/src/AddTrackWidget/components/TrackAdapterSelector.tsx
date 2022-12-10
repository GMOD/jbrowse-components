import React from 'react'
import { ListSubheader, MenuItem, TextField } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { getEnv } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

// locals
import { AddTrackModel } from '../model'

const useStyles = makeStyles()(theme => ({
  spacing: {
    marginBottom: theme.spacing(3),
  },
}))

/**
 * categorizeAdapters
 *
 * takes a list of adapters and sorts their menu item elements
 * under an appropriate ListSubheader element. In this way, adapters that are from
 * external plugins can have headers that differentiate them from the  out-of-the-box
 * plugins.
 *
 * @param adaptersList - a list of adapters found in the PluginManager
 * @returns a series of JSX elements that are ListSubheaders followed by the adapters
 *   found under that subheader
 */
function categorizeAdapters(adaptersList: AdapterType[]) {
  let currentCategory = ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any = []
  adaptersList.forEach(adapter => {
    if (adapter.adapterMetadata?.category) {
      if (currentCategory !== adapter.adapterMetadata?.category) {
        currentCategory = adapter.adapterMetadata?.category
        items.push(
          <ListSubheader
            key={adapter.adapterMetadata?.category}
            value={adapter.adapterMetadata?.category}
          >
            {adapter.adapterMetadata?.category}
          </ListSubheader>,
        )
      }
      items.push(
        <MenuItem key={adapter.name} value={adapter.name}>
          {adapter.displayName}
        </MenuItem>,
      )
    }
  })
  return items
}

const TrackAdapterSelector = observer(({ model }: { model: AddTrackModel }) => {
  const { classes } = useStyles()
  const { trackAdapter } = model
  const { pluginManager } = getEnv(model)
  const adapters = pluginManager.getAdapterElements()
  return (
    <TextField
      className={classes.spacing}
      value={trackAdapter?.type !== 'UNKNOWN' ? trackAdapter?.type : ''}
      label="Adapter type"
      variant="outlined"
      helperText="Select an adapter type"
      select
      fullWidth
      onChange={event => model.setAdapterHint(event.target.value)}
      SelectProps={{
        // @ts-ignore
        SelectDisplayProps: { 'data-testid': 'adapterTypeSelect' },
      }}
    >
      {adapters
        // Excludes any adapter with the 'adapterMetadata.hiddenFromGUI' property,
        // and anything with the 'adapterMetadata.category' property
        .filter(
          elt =>
            !elt.adapterMetadata?.hiddenFromGUI &&
            !elt.adapterMetadata?.category,
        )
        .map(elt => (
          <MenuItem key={elt.name} value={elt.name}>
            {elt.displayName}
          </MenuItem>
        ))}
      {
        // adapters with the 'adapterMetadata.category' property are categorized
        // by the value of the property here
        categorizeAdapters(
          adapters.filter(elt => !elt.adapterMetadata?.hiddenFromGUI),
        )
      }
    </TextField>
  )
})

export default TrackAdapterSelector
