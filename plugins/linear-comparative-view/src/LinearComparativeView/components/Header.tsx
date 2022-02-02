import React from 'react'
import { IconButton, Typography, makeStyles } from '@material-ui/core'
import { SearchBox } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

// icons
import LinkIcon from '@material-ui/icons/Link'
import LinkOffIcon from '@material-ui/icons/LinkOff'
import CropFreeIcon from '@material-ui/icons/CropFree'

import { LinearComparativeViewModel } from '../model'

type LCV = LinearComparativeViewModel

const useStyles = makeStyles(() => ({
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
}))

const LinkViews = observer(({ model }: { model: LCV }) => {
  return (
    <IconButton
      onClick={model.toggleLinkViews}
      title="Toggle linked scrolls and behavior across views"
    >
      {model.linkViews ? (
        <LinkOffIcon color="secondary" />
      ) : (
        <LinkIcon color="secondary" />
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
      <CropFreeIcon color="secondary" />
    </IconButton>
  )
})

const Header = observer(
  ({ model, ExtraButtons }: { ExtraButtons?: React.ReactNode; model: LCV }) => {
    const classes = useStyles()
    const anyShowHeaders = model.views.some(view => !view.hideHeader)
    return (
      <div className={classes.headerBar}>
        <LinkViews model={model} />
        <SquareView model={model} />
        {ExtraButtons}
        {!anyShowHeaders
          ? model.views.map(view => (
              <div key={view.id} className={classes.searchContainer}>
                <SearchBox model={view} showHelp={false} />
              </div>
            ))
          : null}
        {model.views.map(view => (
          <Typography
            key={view.id}
            variant="body2"
            color="textSecondary"
            className={classes.bp}
          >
            {Math.round(view.coarseTotalBp).toLocaleString('en-US')} bp
          </Typography>
        ))}

        <div className={classes.spacer} />
      </div>
    )
  },
)

export default Header
