import ScrollZoomToggle from '@jbrowse/core/ui/ScrollZoomToggle'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import useMeasure from '@jbrowse/core/util/useMeasure'
import {
  HeaderSearchBoxRow,
  useSearchBoxPrefs,
} from '@jbrowse/plugin-linear-genome-view'
import { ColorBySelector, TrackWarningsButton } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import { showsHeaderLabels } from '../headerLabels.ts'
import FollowSyntenyToggle from './FollowSyntenyToggle.tsx'
import SyntenySettingsMenu from './SyntenySettingsMenu.tsx'
import TrackSelectorMenuButton from './TrackSelectorMenuButton.tsx'
import ViewOptionsMenuButton from './ViewOptionsMenuButton.tsx'

import type { LinearSyntenyViewModel } from '../model.ts'

const useStyles = makeStyles()({
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
  },
  endOfBar: {
    marginLeft: 'auto',
  },
})

const Header = observer(function Header({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { classes } = useStyles()
  const prefs = useSearchBoxPrefs('lcv', model.views.length)
  const [ref, { width }] = useMeasure('width')
  const labels = showsHeaderLabels({
    width,
    searchRows: prefs.showSearchBoxes
      ? prefs.sideBySide
        ? model.views.length
        : 1
      : 0,
  })

  return (
    <div className={classes.headerBar} ref={ref}>
      <TrackSelectorMenuButton model={model} />
      <ViewOptionsMenuButton model={model} prefs={prefs} />
      <ScrollZoomToggle model={model} iconOnly={!labels} />
      <FollowSyntenyToggle model={model} iconOnly={!labels} />

      <ColorBySelector
        model={model}
        pointBased={false}
        // 'reference' coloring only carries meaning across a stack of >=2
        // levels; for a single-level (two-genome) view it degenerates to
        // query/target
        showReference={model.levels.length > 1}
      />
      <SyntenySettingsMenu model={model} />

      {prefs.showSearchBoxes ? (
        <HeaderSearchBoxRow views={model.views} sideBySide={prefs.sideBySide} />
      ) : null}

      <TrackWarningsButton
        model={model}
        noun="synteny"
        title="Synteny warnings"
        className={classes.endOfBar}
      />
    </div>
  )
})
export default Header
