import React from 'react'
import { observer } from 'mobx-react'
import {
  Typography,
  Button,
  FormGroup,
  makeStyles,
  useTheme,
  alpha,
} from '@material-ui/core'
import ArrowForwardIcon from '@material-ui/icons/ArrowForward'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
import { SearchBox } from '@jbrowse/plugin-linear-genome-view'

import { LinearGenomeMultilevelViewModel } from '../../LinearGenomeMultilevelView/model'
import { MultilevelLinearComparativeViewModel } from '../model'

type LCV = MultilevelLinearComparativeViewModel
type LGV = LinearGenomeMultilevelViewModel

const WIDGET_HEIGHT = 32
const SPACING = 7
const HEADER_BAR_HEIGHT = 48

const useStyles = makeStyles(theme => ({
  headerBar: {
    gridArea: '1/1/auto/span 2',
    display: 'flex',
    alignItems: 'center',
    height: HEADER_BAR_HEIGHT,
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
    polygonPoints,
  }: {
    view: LGV
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    polygonPoints: any
  }) => {
    const { dynamicBlocks } = view
    const { contentBlocks } = dynamicBlocks
    const { left, right, prevLeft, prevRight } = polygonPoints

    const theme = useTheme()
    const { tertiary, primary } = theme.palette
    const polygonColor = tertiary ? tertiary.light : primary.light

    if (!contentBlocks.length) {
      return null
    }

    const points = [
      [left, HEADER_BAR_HEIGHT],
      [right, HEADER_BAR_HEIGHT],
      [prevRight, 0],
      [prevLeft, 0],
    ]
    return (
      <polygon
        points={points.toString()}
        fill={alpha(polygonColor, 0.2)}
        stroke={alpha(polygonColor, 0.8)}
      />
    )
  },
)

export function PanControls({ model }: { model: LGV }) {
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

export const RegionWidth = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const { coarseTotalBp } = model
  return (
    <Typography variant="body2" color="textSecondary" className={classes.bp}>
      {Math.round(coarseTotalBp).toLocaleString('en-US')} bp
    </Typography>
  )
})

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
        {model.views[0].id !== view.id ? (
          <svg
            height={HEADER_BAR_HEIGHT}
            style={{ width: '100%', position: 'absolute' }}
          >
            <Polygon view={view} polygonPoints={polygonPoints} />
          </svg>
        ) : null}
        {ExtraButtons}
        {view.hideControls ? <RegionWidth model={view} /> : null}
        <div className={classes.spacer} />
        {view.isVisible && !view.hideControls && !view.isAnchor ? (
          <>
            <FormGroup row className={classes.headerForm}>
              <PanControls model={view} />
              <SearchBox model={view} />
            </FormGroup>
            <RegionWidth model={view} />
            {ExtraControls}
          </>
        ) : null}
        <div className={classes.spacer} />
      </div>
    )
  },
)

export default Controls
