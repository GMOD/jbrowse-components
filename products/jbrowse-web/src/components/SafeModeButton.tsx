import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import {
  permanentPluginSafeMode,
  readPermanentPlugins,
  reloadInSafeMode,
} from '../permanentPlugins.ts'

// A permanent plugin loads on every visit, so one that breaks the app leaves
// the user on a screen with no route to the menu that switches it off. Shown
// only when there is a list to skip and it is not already being skipped.
const SafeModeButton = observer(function SafeModeButton({
  style,
}: {
  style?: React.CSSProperties
}) {
  return !permanentPluginSafeMode() &&
    readPermanentPlugins().some(p => !p.disabled) ? (
    <Button
      color="secondary"
      variant="contained"
      style={style}
      onClick={() => {
        reloadInSafeMode()
      }}
    >
      Reload without permanent plugins
    </Button>
  ) : null
})

export default SafeModeButton
