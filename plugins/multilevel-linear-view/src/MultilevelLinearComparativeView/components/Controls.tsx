import React from 'react'
import {
  IconButton,
  Typography,
  Button,
  FormGroup,
  makeStyles,
  alpha,
} from '@material-ui/core'
import { SearchBox } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import LinkIcon from '@material-ui/icons/Link'
import LinkOffIcon from '@material-ui/icons/LinkOff'
import FormatAlignCenterIcon from '@material-ui/icons/FormatAlignCenter'
import ArrowForwardIcon from '@material-ui/icons/ArrowForward'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'

import { MultilevelLinearComparativeViewModel } from '../model'

import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view/src/index'
import ZoomControls from '@jbrowse/plugin-linear-genome-view/src/LinearGenomeView/components/ZoomControls'
import LabelField from './LabelField'

type LCV = MultilevelLinearComparativeViewModel
type LGV = LinearGenomeViewModel

const WIDGET_HEIGHT = 32
const SPACING = 7

const useStyles = makeStyles(theme => ({
  headerBar: {
    gridArea: '1/1/auto/span 2',
    display: 'flex',
    alignItems: 'center',
  },
  spacer: {
    flexGrow: 1,
  },
  headerForm: {
    flexWrap: 'nowrap',
    marginRight: 7,
  },
  bp: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 10,
  },
  toggleButton: {
    height: 44,
    border: 'none',
    margin: theme.spacing(0.5),
  },
  searchContainer: {
    marginLeft: 5,
  },
  searchBox: {
    display: 'flex',
  },
  buttonSpacer: {
    marginRight: theme.spacing(2),
  },
  panButton: {
    background: alpha(theme.palette.background.paper, 0.8),
    height: WIDGET_HEIGHT,
    margin: SPACING,
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

const AlignViews = observer(({ model }: { model: LCV }) => {
  return (
    <IconButton
      onClick={model.alignViews}
      title="Align views (realign sub views to the anchor view)"
    >
      <FormatAlignCenterIcon color="secondary" />
    </IconButton>
  )
})

function PanControls({ model }: { model: LGV }) {
  const classes = useStyles()
  return (
    <>
      <Button
        variant="outlined"
        className={classes.panButton}
        onClick={() => model.slide(-0.9)}
      >
        <ArrowBackIcon />
      </Button>
      <Button
        variant="outlined"
        className={classes.panButton}
        onClick={() => model.slide(0.9)}
      >
        <ArrowForwardIcon />
      </Button>
    </>
  )
}

const RegionWidth = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const { coarseTotalBp } = model
  return (
    <Typography variant="body2" color="textSecondary" className={classes.bp}>
      {Math.round(coarseTotalBp).toLocaleString('en-US')} bp
    </Typography>
  )
})

const HeaderButtons = observer(
  ({
    model,
    view,
    ExtraButtons,
  }: {
    model: LCV
    view: LGV
    ExtraButtons?: React.ReactNode
  }) => {
    return (
      <div>
        <LinkViews model={model} />
        <AlignViews model={model} />
        {ExtraButtons}
        <LabelField model={view} />
      </div>
    )
  },
)

const Controls = observer(
  ({
    view,
    model,
    ExtraButtons,
    ExtraControls,
  }: {
    view: LGV
    model?: LCV
    ExtraButtons?: React.ReactNode
    ExtraControls?: React.ReactNode
  }) => {
    const classes = useStyles()
    return (
      <div className={classes.headerBar}>
        {model ? (
          <>
            <HeaderButtons
              model={model}
              view={view}
              ExtraButtons={ExtraButtons}
            />
          </>
        ) : null}
        {ExtraButtons}
        <div className={classes.spacer} />
        <FormGroup row className={classes.headerForm}>
          <PanControls model={view} />
          <SearchBox model={view} />
        </FormGroup>
        <RegionWidth model={view} />
        {view.initialized ? <ZoomControls model={view} /> : null}
        {ExtraControls}
        <div className={classes.spacer} />
      </div>
    )
  },
)

export default Controls
