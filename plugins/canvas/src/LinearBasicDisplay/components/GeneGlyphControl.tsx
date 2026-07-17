import { useState } from 'react'

import { CascadingMenu, CascadingMenuButton } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import { observer } from 'mobx-react'

import StatusChip from './StatusChip.tsx'
import { GENE_GLYPH_MODE_OPTIONS } from '../geneGlyphMode.ts'

import type { GeneGlyphMode } from '../geneGlyphMode.ts'

// The chip sits on the display's bottom edge, so open the menu upward (its
// bottom-left corner anchored to the chip's top-left).
const anchorOrigin = { vertical: 'top', horizontal: 'left' } as const
const transformOrigin = { vertical: 'bottom', horizontal: 'left' } as const

// Subtle bordered look for the ambient bottom-right track-state buttons (shared
// with TrackHeightIndicator), so the dismissed isoform button reads as one quiet
// system rather than a bright control.
const useStyles = makeStyles()(theme => ({
  button: {
    padding: 2,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 3,
    '& svg': {
      fontSize: 14,
    },
    '&:hover': {
      background: theme.palette.action.hover,
    },
  },
}))

// The chip carries the (×) to minimize itself; the minimized icon button has no
// (×), so its tooltip drops that clause.
function getTooltip(
  mode: GeneGlyphMode,
  collapsed: boolean,
  dismissed: boolean,
) {
  const showing = collapsed
    ? 'Showing the longest coding transcript per gene'
    : 'Showing all transcripts per gene'
  const auto = mode === 'auto' ? ' — chosen automatically at this zoom' : ''
  const minimize = dismissed ? '' : '; × to minimize this notice to an icon'
  return `${showing}${auto}. Click to change${minimize}.`
}

// Bottom-right control for isoform collapse, shown (see showGeneGlyphNotice)
// only while genes are collapsed to their longest coding transcript, so the user
// always has a visible sign that transcripts are hidden. It's present under
// 'auto' too, where the collapse is a zoom-driven decision the user never made
// and would otherwise have no cue for.
//
// Two looks for the same control. Until dismissed it's a loud text chip
// ("Longest isoform") whose (×) is a passive acknowledgement; dismissing shrinks
// it to the quiet always-there icon button (it never removes the control, so
// re-opening the menu is one click away). Both open the same Auto / All /
// Longest-coding options as the track menu's "Gene glyph" radio.
const GeneGlyphControl = observer(function GeneGlyphControl({
  visible,
  collapsed,
  dismissed,
  geneGlyphMode,
  onSetGeneGlyphMode,
  onDismiss,
}: {
  visible: boolean
  collapsed: boolean
  dismissed: boolean
  geneGlyphMode: GeneGlyphMode
  onSetGeneGlyphMode: (value: GeneGlyphMode) => void
  onDismiss: () => void
}) {
  const { classes } = useStyles()
  const [anchorEl, setAnchorEl] = useState<Element | null>(null)
  const menuItems = GENE_GLYPH_MODE_OPTIONS.map(option => ({
    label: option.label,
    type: 'radio' as const,
    checked: geneGlyphMode === option.value,
    onClick: () => {
      onSetGeneGlyphMode(option.value)
    },
  }))
  // The loud "Longest isoform" chip only makes sense while transcripts are
  // actually collapsed; in any other mode (or once dismissed) the control
  // stays reachable as the quiet icon button so the user can switch back.
  return visible ? (
    dismissed || !collapsed ? (
      <CascadingMenuButton
        size="small"
        className={classes.button}
        stopPropagation
        tooltip={getTooltip(geneGlyphMode, collapsed, dismissed)}
        menuItems={menuItems}
      >
        <UnfoldLessIcon />
      </CascadingMenuButton>
    ) : (
      <>
        <StatusChip
          icon={<UnfoldLessIcon />}
          label="Longest isoform"
          tooltip={getTooltip(geneGlyphMode, collapsed, dismissed)}
          onClick={event => {
            // don't let the click bubble to the track/view (drag-select, deselect)
            event.stopPropagation()
            setAnchorEl(event.currentTarget)
          }}
          onDelete={() => {
            onDismiss()
          }}
        />
        <CascadingMenu
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          anchorOrigin={anchorOrigin}
          transformOrigin={transformOrigin}
          onClose={() => {
            setAnchorEl(null)
          }}
          onMenuItemClick={callback => {
            callback()
          }}
          menuItems={menuItems}
        />
      </>
    )
  ) : null
})

export default GeneGlyphControl
