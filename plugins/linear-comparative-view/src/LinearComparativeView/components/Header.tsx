import React from 'react'
import { IconButton, makeStyles } from '@material-ui/core'
import { SearchBox } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

// icons
import LinkIcon from '@material-ui/icons/Link'
import LinkOffIcon from '@material-ui/icons/LinkOff'

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
}))

const LinkViews = observer(({ model }: { model: LCV }) => {
  return (
    <IconButton
      onClick={model.toggleLinkViews}
      title="Toggle linked scrolls and behavior across views"
    >
      {model.linkViews ? (
        <LinkIcon color="secondary" />
      ) : (
        <LinkOffIcon color="secondary" />
      )}
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
        {ExtraButtons}
        {!anyShowHeaders
          ? model.views.map(view => (
              <SearchBox key={view.id} model={view} showHelp={false} />
            ))
          : null}

        <div className={classes.spacer} />
      </div>
    )
  },
)

export default Header
