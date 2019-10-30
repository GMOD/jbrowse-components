import clsx from 'clsx'
import { withSize } from 'react-sizeme'
import LockOpen from '@material-ui/icons/LockOpenOutlined'
import LockClosed from '@material-ui/icons/LockOutlined'
import { Instance } from 'mobx-state-tree'
import { BreakpointViewStateModel } from '../models/BreakpointSplitView'

type BSV = Instance<BreakpointViewStateModel>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default ({ jbrequire }: { jbrequire: any }) => {
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useState } = React
  const { Icon, IconButton, TextField, Typography } = jbrequire(
    '@material-ui/core',
  )
  const { makeStyles } = jbrequire('@material-ui/core/styles')

  const useStyles = makeStyles((theme: any) => ({
    headerBar: {
      gridArea: '1/1/auto/span 2',
      display: 'flex',
      background: '#eee',
    },
    spacer: {
      flexGrow: 1,
    },
    emphasis: {
      background: '#dddd',
      padding: theme.spacing(1),
    },
    hovered: {
      border: '1px solid grey',
    },
  }))

  const Controls = observer(({ model }: { model: BSV }) => {
    const classes = useStyles()
    return (
      <>
        <IconButton
          onClick={model.closeView}
          className={classes.iconButton}
          title="close this view"
        >
          <Icon fontSize="small">close</Icon>
        </IconButton>
      </>
    )
  })

  Controls.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  function TextFieldOrTypography({ model }: { model: BSV }) {
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
        >
          {name}
        </Typography>
      </div>
    )
  }
  TextFieldOrTypography.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }


  function LinkViews({ model }: { model: BSV }) {
    const classes = useStyles()
    const title = model.linkViews?"lock":"lock_open"
    return <IconButton
          onClick={model.closeView}
          className={classes.iconButton}
          title={title}
        >
          <Icon fontSize="small">{title}</Icon>
        </IconButton>
  }
  LinkViews.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }


  const Header = observer(
    ({ model, size }: { model: BSV; size: { height: number } }) => {
      const classes = useStyles()

      model.setHeaderHeight(size.height)
      return (
        <div className={classes.headerBar}>
          <Controls model={model} />
          <TextFieldOrTypography model={model} />
          <div className={classes.spacer} />
          <LinkViews model={model} />

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
