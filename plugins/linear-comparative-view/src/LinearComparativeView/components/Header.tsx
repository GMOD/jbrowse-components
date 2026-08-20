import ScrollZoomToggle from '@jbrowse/core/ui/ScrollZoomToggle'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  HeaderSearchBoxRow,
  useSearchBoxPrefs,
} from '@jbrowse/plugin-linear-genome-view'
import { ColorBySelector } from '@jbrowse/synteny-core'
import { Divider } from '@mui/material'
import { observer } from 'mobx-react'

import { asSyntenyModel } from '../../LinearSyntenyView/model.ts'
import FollowSyntenyToggle from './FollowSyntenyToggle.tsx'
import SyntenySettingsPopover from './SyntenySettingsPopover.tsx'
import SyntenyWarnings from './SyntenyWarnings.tsx'
import TrackSelectorMenuButton from './TrackSelectorMenuButton.tsx'
import ViewOptionsMenuButton from './ViewOptionsMenuButton.tsx'

import type { LinearComparativeViewModel } from '../model.ts'

const useStyles = makeStyles()({
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
  },
  divider: {
    marginInline: 4,
  },
})

/**
 * Three divided groups: what to open, how the view answers the mouse, and how
 * the ribbons look. The two toggles sit together because they are the only
 * controls here that HOLD a state you can read off the button — everything else
 * opens something — and an undivided run of seven icons gave a reader nothing to
 * guess that from.
 *
 * The last group is the one that needs a synteny model; row-following does not,
 * since the whole of its state (`followSynteny`, the anchor row) is on the
 * comparative base.
 */
const Header = observer(function Header({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()
  const prefs = useSearchBoxPrefs('lcv', model.views.length)
  const syntenyModel = asSyntenyModel(model)

  return (
    <div className={classes.headerBar}>
      <TrackSelectorMenuButton model={model} />
      <ViewOptionsMenuButton model={model} prefs={prefs} />

      <Divider className={classes.divider} orientation="vertical" flexItem />
      <ScrollZoomToggle model={model} iconOnly />
      <FollowSyntenyToggle model={model} />

      {syntenyModel ? (
        <>
          <Divider
            className={classes.divider}
            orientation="vertical"
            flexItem
          />
          <ColorBySelector
            model={syntenyModel}
            pointBased={false}
            // 'reference' coloring only carries meaning across a stack of >=2
            // levels; for a single-level (two-genome) view it degenerates to
            // query/target
            showReference={syntenyModel.levels.length > 1}
          />
          <SyntenySettingsPopover model={syntenyModel} />
        </>
      ) : null}

      {prefs.showSearchBoxes ? (
        <HeaderSearchBoxRow views={model.views} sideBySide={prefs.sideBySide} />
      ) : null}

      <SyntenyWarnings model={model} />
    </div>
  )
})
export default Header
