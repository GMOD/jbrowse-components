import { pluginLabel, pluginName } from '@jbrowse/core/pluginDefinitions'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  IconButton,
  ListItem,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type { SessionWithPermanentPlugins } from '@jbrowse/core/util/types'

// A plugin this browser keeps for every visit that no loaded plugin came from:
// switched off, skipped because safe mode is on, or shadowed by a config naming
// the same plugin. The switch is the half that makes safe mode actionable — a
// user with three installed finds the one that crashed the app without
// reinstalling the innocent two.
//
// Removing takes no confirmation, unlike uninstalling a loaded plugin: nothing
// in this session is using it, so there is nothing the click can break.
const UnloadedPermanentPlugin = observer(function UnloadedPermanentPlugin({
  session,
  entry,
}: {
  session: SessionWithPermanentPlugins
  entry: PluginDefinition & { disabled?: boolean }
}) {
  const name = pluginName(entry) ?? pluginLabel(entry)
  return (
    <ListItem disableGutters>
      <Tooltip
        title={entry.disabled ? 'Switched off' : 'Loaded on every visit'}
      >
        <Switch
          checked={!entry.disabled}
          slotProps={{ input: { 'aria-label': `Keep loading ${name}` } }}
          onChange={event => {
            session.setPermanentPluginDisabled(entry, !event.target.checked)
          }}
        />
      </Tooltip>
      <Tooltip title={pluginLabel(entry)}>
        <Typography style={{ flexGrow: 1, overflowWrap: 'anywhere' }}>
          {name}
        </Typography>
      </Tooltip>
      <Tooltip title="Stop keeping this plugin">
        <IconButton
          data-testid={`removeKeptPlugin-${name}`}
          onClick={() => {
            session.removePermanentPlugin(entry)
          }}
        >
          <DeleteIcon />
        </IconButton>
      </Tooltip>
    </ListItem>
  )
})

export default UnloadedPermanentPlugin
