import { makeStyles } from '@jbrowse/core/util/tss-react'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import SyncProblemIcon from '@mui/icons-material/SyncProblem'
import { ToggleButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearComparativeViewModel } from '../model.ts'

const useStyles = makeStyles()({
  button: {
    height: 44,
    border: 'none',
    textTransform: 'none',
  },
})

/**
 * The tooltip, given the state. Pure so the wording is testable without a
 * render, and separate because it is the only place the mode explains itself
 * outside a menu.
 *
 * The unaligned case is the one that most needs saying. Over a
 * haplotype-specific insertion or a centromere there is nothing to follow, so
 * the other rows hold position — and a row that stops tracking with nothing
 * said looks exactly like a broken follow.
 */
export function followToggleTitle({
  followSynteny,
  unaligned,
  anchorAssembly,
}: {
  followSynteny: boolean
  unaligned?: boolean
  anchorAssembly?: string
}) {
  if (!followSynteny) {
    return 'Follow the matching region'
  }
  const anchor = anchorAssembly ?? 'the anchor row'
  return unaligned
    ? `Following ${anchor} — nothing aligns here, so the other rows are holding`
    : `Following ${anchor} — click to stop`
}

/**
 * Follow on/off, in the header rather than only in a menu.
 *
 * A MODE THAT MOVES A ROW THE USER DID NOT TOUCH should not be visible only
 * from inside the menu that set it. Following is the one setting in this view
 * whose effect arrives as motion nobody asked for, seconds after a pan, and a
 * session can arrive with it already on — buried in a submenu, a row that keeps
 * re-placing itself reads as a bug rather than as a setting.
 *
 * TWO STATES, not the three the setting has. `linkViews` is the other coupling
 * and stays in the menu: it is a preference someone sets once, while this is the
 * one worth flicking on and off against a locus. A three-way cycle here was the
 * obvious way to cover both and was worse than either — a ToggleButton reads as
 * on/off, so a third state makes "selected" ambiguous and leaves the tooltip as
 * the only way to tell which coupling is running. Turning this on clears
 * `linkViews` (setRowSyncMode), so the two can still never fight.
 */
const FollowSyntenyToggle = observer(function FollowSyntenyToggle({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()
  const { followSynteny, followUnaligned, views, followAnchorIndex } = model
  const stalled = followSynteny && followUnaligned
  return (
    <Tooltip
      title={followToggleTitle({
        followSynteny,
        unaligned: followUnaligned,
        anchorAssembly: views[followAnchorIndex]?.assemblyNames[0],
      })}
    >
      <ToggleButton
        value="followSynteny"
        selected={followSynteny}
        onChange={() => {
          model.setRowSyncMode(followSynteny ? 'independent' : 'follow')
        }}
        className={classes.button}
        size="small"
      >
        {stalled ? <SyncProblemIcon /> : <SyncAltIcon />}
      </ToggleButton>
    </Tooltip>
  )
})

export default FollowSyntenyToggle
