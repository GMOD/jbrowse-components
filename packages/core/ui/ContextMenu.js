import React from 'react'
import Menu from '@material-ui/core/Menu'
import PropTypes from 'prop-types'
import { observer } from 'mobx-react'

const initialState = {
  mouseX: null,
  mouseY: null,
}

function ContextMenu(props) {
  const { children } = props
  const [state, setState] = React.useState(initialState)

  const handleClose = async () => {
    setState(initialState)
  }

  return (
    <div
      onContextMenu={e => {
        e.preventDefault()
        setState(() => ({
          mouseX: e.clientX - 2,
          mouseY: e.clientY - 4,
        }))
      }}
    >
      <Menu
        keepMounted
        open={state.mouseY !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          state.mouseY !== null && state.mouseX !== null
            ? { top: state.mouseY, left: state.mouseX }
            : undefined
        }
        style={{ zIndex: 10000 }}
      >
        <div style={{ pointerEvents: 'auto' }}>{children}</div>
      </Menu>
    </div>
  )
}

ContextMenu.propTypes = {
  children: PropTypes.array.isRequired,
}

export default observer(ContextMenu)
