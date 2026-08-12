import { makeStyles } from '@jbrowse/core/util/tss-react'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
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

export type RowSyncMode = 'independent' | 'link' | 'follow'

/**
 * What the header button says and does, given the two flags. Pure so the cycle
 * order and the wording are testable without a render: this is the one place a
 * user learns which mode is on, so an "on" state that describes the wrong one is
 * worse than no button.
 *
 * CYCLE ORDER independent -> link -> follow -> independent. The two couplings
 * sit next to each other so a comparison can be flicked between them, and both
 * return to independent in one more click rather than trapping the user in a
 * mode that keeps moving their rows.
 */
export function rowSyncButtonState({
  linkViews,
  followSynteny,
  anchorAssembly,
}: {
  linkViews: boolean
  followSynteny: boolean
  // the assembly of the row currently driving the others, named in the tooltip
  // so a stack of three does not leave the user guessing which one it is
  anchorAssembly?: string
}): { title: string; next: RowSyncMode; active: boolean } {
  if (followSynteny) {
    return {
      title: `Rows follow the matching region${anchorAssembly ? ` in ${anchorAssembly}` : ''} — click for independent rows`,
      next: 'independent',
      active: true,
    }
  }
  return linkViews
    ? {
        title:
          'Rows share scroll and zoom — click to follow the matching region instead',
        next: 'follow',
        active: true,
      }
    : {
        title: 'Rows move independently — click to link their scroll and zoom',
        next: 'link',
        active: false,
      }
}

/**
 * The row-sync mode, in the header rather than only in the hamburger menu.
 *
 * A mode that MOVES A ROW THE USER DID NOT TOUCH has to be visible from outside
 * the menu that set it. Following is the one setting in this view whose effect
 * arrives as motion nobody asked for, seconds after a pan, and a session can
 * arrive with it already on — with the mode buried in a submenu, a row that
 * keeps re-placing itself reads as a bug rather than as a setting. Link-views
 * has the same problem in milder form and has always had it.
 *
 * The button cycles rather than opening the radio group, because its job is to
 * SHOW the mode; the menu still sets any of the three directly, and picks the
 * anchor row.
 */
const RowSyncButton = observer(function RowSyncButton({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()
  const { linkViews, followSynteny, views, followAnchorIndex } = model
  const { title, next, active } = rowSyncButtonState({
    linkViews,
    followSynteny,
    anchorAssembly: views[followAnchorIndex]?.assemblyNames[0],
  })

  return (
    <Tooltip title={title}>
      <ToggleButton
        value="rowSync"
        selected={active}
        onChange={() => {
          model.setRowSyncMode(next)
        }}
        className={classes.button}
        size="small"
      >
        {followSynteny ? (
          <SyncAltIcon />
        ) : linkViews ? (
          <LinkIcon />
        ) : (
          <LinkOffIcon />
        )}
      </ToggleButton>
    </Tooltip>
  )
})

export default RowSyncButton
