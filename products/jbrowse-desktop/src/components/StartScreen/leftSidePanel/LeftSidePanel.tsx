import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { invokeIpc } from '../../../ipc.ts'
import { useLaunchConfigs } from '../startScreenLaunch.ts'
import { useFavoriteGenomes } from '../useFavoriteGenomes.ts'
import FavoriteGenomesPanel from './FavoriteGenomesPanel.tsx'
import OpenSequencePanel from './OpenSequencePanel.tsx'
import QuickstartPanel from './QuickstartPanel.tsx'

const useStyles = makeStyles()(theme => ({
  form: {
    marginTop: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
}))

async function getQuickstarts(sel: string[]) {
  return Promise.all(sel.map(entry => invokeIpc('getQuickstart', entry)))
}

const LeftSidePanel = observer(function LeftSidePanel() {
  const { classes } = useStyles()
  const { launchConfigs, launchConfigUrls } = useLaunchConfigs()
  const [favorites, setFavorites] = useFavoriteGenomes()

  return (
    <div className={classes.form}>
      <OpenSequencePanel />
      <FavoriteGenomesPanel
        favorites={favorites}
        setFavorites={setFavorites}
        launch={launchConfigUrls}
      />
      <QuickstartPanel
        launch={sel => launchConfigs(() => getQuickstarts(sel))}
      />
    </div>
  )
})

export default LeftSidePanel
