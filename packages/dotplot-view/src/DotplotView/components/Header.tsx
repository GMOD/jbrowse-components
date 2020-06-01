import CloseIcon from '@material-ui/icons/Close'
import LineStyleIcon from '@material-ui/icons/LineStyle'
import clsx from 'clsx'
import { withSize } from 'react-sizeme'
import { DotplotViewModel } from '../model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default ({ jbrequire }: { jbrequire: any }) => {
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useState } = React
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const TextField = jbrequire('@material-ui/core/TextField')
  const Typography = jbrequire('@material-ui/core/Typography')
  const { makeStyles } = jbrequire('@material-ui/core/styles')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const useStyles = makeStyles((theme: any) => ({
    headerBar: {
      gridArea: '1/1/auto/span 2',
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
    hovered: {
      background: theme.palette.secondary.light,
    },
  }))

  const Controls = observer(({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    return (
      <>
        <IconButton
          onClick={model.closeView}
          className={classes.iconButton}
          title="close this view"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </>
    )
  })

  Controls.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  function TextFieldOrTypography({ model }: { model: DotplotViewModel }) {
    const classes = useStyles()
    const [name, setName] = useState(model.displayName)
    const [edit, setEdit] = useState(false)
    const [hover, setHover] = useState(false)
    return edit ? (
      <form
        onSubmit={(event: React.FormEvent) => {
          setEdit(false)
          model.setDisplayName(name)
          event.preventDefault()
        }}
      >
        <TextField
          value={name}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setName(event.target.value)
          }}
          onBlur={() => {
            setEdit(false)
            model.setDisplayName(name)
          }}
        />
      </form>
    ) : (
      <div className={clsx(classes.emphasis, hover ? classes.hovered : null)}>
        <Typography
          className={classes.viewName}
          onClick={() => setEdit(true)}
          onMouseOver={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{ color: '#FFFFFF' }}
        >
          {name}
        </Typography>
      </div>
    )
  }
  TextFieldOrTypography.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  const Header = observer(
    ({
      model,
      size,
    }: {
      model: DotplotViewModel
      size: { height: number }
    }) => {
      const classes = useStyles()

      model.setHeaderHeight(size.height)
      return (
        <div className={classes.headerBar}>
          <Controls model={model} />
          <TextFieldOrTypography model={model} />

          <IconButton
            onClick={model.activateTrackSelector}
            title="select tracks"
            value="track_select"
            color="secondary"
          >
            <LineStyleIcon fontSize="small" />
          </IconButton>
          <div className={classes.spacer} />
        </div>
      )
    },
  )

  Header.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  return withSize({ monitorHeight: true })(Header)
}
