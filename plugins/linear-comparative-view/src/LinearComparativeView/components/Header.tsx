import React from 'react'
import { IconButton, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { SearchBox } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

// icons
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import CropFreeIcon from '@mui/icons-material/CropFree'

import { LinearComparativeViewModel } from '../model'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

type LCV = LinearComparativeViewModel

const useStyles = makeStyles()(() => ({
  headerBar: {
    gridArea: '1/1/auto/span 2',
    display: 'flex',
  },
  spacer: {
    flexGrow: 1,
  },
  bp: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 10,
  },
  searchContainer: {
    marginLeft: 5,
  },
  searchBox: {
    display: 'flex',
  },
}))

const TrackSelector = observer(({ model }: { model: LCV }) => {
  return (
    <IconButton
      onClick={model.activateTrackSelector}
      title="Open track selector"
    >
      <TrackSelectorIcon color="primary" />
    </IconButton>
  )
})

const LinkViews = observer(({ model }: { model: LCV }) => {
  return (
    <IconButton
      onClick={model.toggleLinkViews}
      title="Toggle linked scrolls and behavior across views"
    >
      {model.linkViews ? (
        <LinkOffIcon color="primary" />
      ) : (
        <LinkIcon color="primary" />
      )}
    </IconButton>
  )
})

const SquareView = observer(({ model }: { model: LCV }) => {
  return (
    <IconButton
      onClick={model.squareView}
      title="Square view (make both the same zoom level)"
    >
      <CropFreeIcon color="primary" />
    </IconButton>
  )
})

const Header = observer(
  ({ model, ExtraButtons }: { ExtraButtons?: React.ReactNode; model: LCV }) => {
    const { classes } = useStyles()
    const anyShowHeaders = model.views.some(view => !view.hideHeader)
    return (
      <div className={classes.headerBar}>
        <TrackSelector model={model} />
        <LinkViews model={model} />
        <SquareView model={model} />
        {ExtraButtons}
        {!anyShowHeaders
          ? model.views.map(view => (
              <div key={view.id} className={classes.searchBox}>
                <div className={classes.searchContainer}>
                  <SearchBox model={view} showHelp={false} />
                </div>
                <div className={classes.bp}>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    className={classes.bp}
                  >
                    {Math.round(view.coarseTotalBp).toLocaleString('en-US')} bp
                  </Typography>
                </div>
              </div>
            ))
          : null}

        <div className={classes.spacer} />
      </div>
    )
  },
)

export default Header
