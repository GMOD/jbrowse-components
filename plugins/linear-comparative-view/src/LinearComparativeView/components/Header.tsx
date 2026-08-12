import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { asSyntenyModel } from '../../LinearSyntenyView/model.ts'
import HeaderSearchBoxRow from './HeaderSearchBoxRow.tsx'
import ScrollZoomToggle from './ScrollZoomToggle.tsx'
import SyntenyHeaderControls from './SyntenyHeaderControls.tsx'
import SyntenyWarnings from './SyntenyWarnings.tsx'
import TrackSelectorMenuButton from './TrackSelectorMenuButton.tsx'
import ViewOptionsMenuButton from './ViewOptionsMenuButton.tsx'
import { useSearchBoxPrefs } from './useSearchBoxPrefs.ts'

import type { LinearComparativeViewModel } from '../model.ts'

const useStyles = makeStyles()({
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
  },
})

const Header = observer(function Header({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()
  const prefs = useSearchBoxPrefs(model.views.length)
  const syntenyModel = asSyntenyModel(model)

  return (
    <div className={classes.headerBar}>
      <TrackSelectorMenuButton model={model} />
      <ViewOptionsMenuButton model={model} prefs={prefs} />
      <ScrollZoomToggle model={model} />

      {syntenyModel ? <SyntenyHeaderControls model={syntenyModel} /> : null}

      {prefs.showSearchBoxes ? (
        <HeaderSearchBoxRow model={model} sideBySide={prefs.sideBySide} />
      ) : null}

      <SyntenyWarnings model={model} />
    </div>
  )
})
export default Header
