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
const HEADER_BAR_HEIGHT = 48

const useStyles = makeStyles(theme => ({
  headerBar: {
    gridArea: '1/1/auto/span 2',
    display: 'flex',
    alignItems: 'center',
    height: 48,
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

const Polygon = observer(
  ({
    view,
    model,
    polygonPoints,
  }: {
    view: LGV
    model: LCV
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    polygonPoints: any
  }) => {
    const { interRegionPaddingWidth, offsetPx, dynamicBlocks } = view
    const { contentBlocks, totalWidthPxWithoutBorders } = dynamicBlocks
    const { left, right, prevLeft, prevRight } = polygonPoints
    if (!contentBlocks.length) {
      return null
    }

    const index = model.views.findIndex(target => target.id === view.id)
    const startPx = Math.max(0, -offsetPx)
    const length =
      startPx +
      totalWidthPxWithoutBorders +
      (contentBlocks.length * interRegionPaddingWidth) / 2
    let points

    if (index - 1 > 0) {
      points = [
        [left, HEADER_BAR_HEIGHT],
        [right, HEADER_BAR_HEIGHT],
        [prevRight, 0],
        [prevLeft, 0],
      ]
    } else {
      points = [
        [left, HEADER_BAR_HEIGHT],
        [right, HEADER_BAR_HEIGHT],
        [length, 0],
        [0, 0],
      ]
    }
    return (
      <polygon
        points={points.toString()}
        fill={alpha('rgb(255, 0, 0)', 0.3)}
        stroke={alpha('rgb(255, 0, 0)', 0.8)}
      />
    )
  },
)

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
    polygonPoints,
    ExtraButtons,
    ExtraControls,
  }: {
    view: LGV
    model: LCV
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    polygonPoints?: any
    ExtraButtons?: React.ReactNode
    ExtraControls?: React.ReactNode
  }) => {
    const classes = useStyles()
    return (
      <div className={classes.headerBar}>
        {model.views[0].id !== view.id && view.isVisible ? (
          <svg
            height={HEADER_BAR_HEIGHT}
            style={{ width: '100%', position: 'absolute' }}
          >
            <Polygon model={model} view={view} polygonPoints={polygonPoints} />
          </svg>
        ) : null}
        {model.views[0].id === view.id ? (
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
        {!view.hideControls ? (
          <>
            <FormGroup row className={classes.headerForm}>
              <PanControls model={view} />
              <SearchBox model={view} />
            </FormGroup>
            <RegionWidth model={view} />
            {view.initialized ? <ZoomControls model={view} /> : null}
            {ExtraControls}
          </>
        ) : null}
        <div className={classes.spacer} />
      </div>
    )
  },
)

export default Controls
