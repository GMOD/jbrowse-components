import { IRegion } from '@gmod/jbrowse-core/mst-types'
import Button from '@material-ui/core/Button'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import InputBase from '@material-ui/core/InputBase'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import ReactPropTypes from 'prop-types'
import React, { useState } from 'react'
import { LinearGenomeViewStateModel, HEADER_BAR_HEIGHT } from '..'
import buttonStyles from './buttonStyles'
import RefNameAutocomplete from './RefNameAutocomplete'
import ZoomControls from './ZoomControls'

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(theme => ({
  headerBar: {
    height: HEADER_BAR_HEIGHT,
    display: 'flex',
    background: '#F2F2F2',
    borderTop: '1px solid #9D9D9D',
    borderBottom: '1px solid #9D9D9D',
  },
  spacer: {
    flexGrow: 1,
  },
  emphasis: {
    background: theme.palette.secondary.main,
    padding: theme.spacing(1),
  },
  searchRoot: {
    margin: theme.spacing(1),
    alignItems: 'center',
  },
  viewName: {
    margin: theme.spacing(0.25),
  },
  hovered: {
    background: theme.palette.secondary.light,
  },
  input: {
    width: 300,
    error: {
      backgroundColor: 'red',
    },
    padding: theme.spacing(0, 1),
  },
  headerRefName: {
    minWidth: 140,
    margin: theme.spacing(0.5),
    background: theme.palette.background.default,
  },
  displayName: {
    background: theme.palette.secondary.main,
    paddingTop: 6,
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
  },
  inputBase: {
    color: theme.palette.secondary.contrastText,
  },
  inputRoot: {
    '&:hover': {
      backgroundColor: theme.palette.secondary.light,
    },
  },
  inputFocused: {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.secondary.light,
  },
  panButton: {
    margin: theme.spacing(2),
  },
  ...buttonStyles(theme),
}))

const Controls = observer(({ model }) => {
  return (
    <IconButton
      onClick={model.activateTrackSelector}
      title="select tracks"
      value="track_select"
      color="secondary"
    >
      <Icon fontSize="small">line_style</Icon>
    </IconButton>
  )
})

function Search({
  onSubmit,
  error,
}: {
  onSubmit: Function
  error: string | undefined
}) {
  const [value, setValue] = useState<string | undefined>()
  const classes = useStyles()
  const placeholder = 'Enter location (e.g. chr1:1000..5000)'

  return (
    <Paper className={classes.searchRoot}>
      <form
        onSubmit={event => {
          onSubmit(value)
          event.preventDefault()
        }}
      >
        <InputBase
          className={classes.input}
          error={!!error}
          onChange={event => setValue(event.target.value)}
          placeholder={placeholder}
        />
        <IconButton
          onClick={() => onSubmit(value)}
          className={classes.iconButton}
          aria-label="search"
          color="secondary"
        >
          <Icon>search</Icon>
        </IconButton>
      </form>
    </Paper>
  )
}
Search.propTypes = {
  onSubmit: ReactPropTypes.func.isRequired,
  error: ReactPropTypes.string, // eslint-disable-line react/require-default-props
}

function PanControls({ model }: { model: LGV }) {
  const classes = useStyles()
  return (
    <>
      <Button
        size="small"
        variant="outlined"
        className={classes.panButton}
        onClick={() => model.slide(-0.9)}
      >
        <Icon>arrow_back</Icon>
      </Button>
      <Button
        size="small"
        variant="outlined"
        className={classes.panButton}
        onClick={() => model.slide(0.9)}
      >
        <Icon>arrow_forward</Icon>
      </Button>
    </>
  )
}

export default observer(({ model }: { model: LGV }) => {
  const classes = useStyles()

  function setDisplayedRegions(region: IRegion | undefined) {
    if (region) {
      model.setDisplayedRegions([region])
    }
  }

  return (
    <div className={classes.headerBar}>
      <Controls model={model} />
      <div className={classes.spacer} />
      <PanControls model={model} />
      <Search onSubmit={model.navToLocstring} error={''} />
      <RefNameAutocomplete
        model={model}
        onSelect={setDisplayedRegions}
        assemblyName={model.displayedRegions[0].assemblyName}
        defaultRegionName={model.displayedRegions[0].refName}
        TextFieldProps={{
          variant: 'outlined',
          margin: 'none',
          className: classes.headerRefName,
          InputProps: {
            style: {
              paddingTop: 2,
              paddingBottom: 2,
            },
          },
        }}
      />

      <ZoomControls model={model} />
      <div className={classes.spacer} />
    </div>
  )
})
