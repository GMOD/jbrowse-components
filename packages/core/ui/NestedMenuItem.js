import React, { useState, useRef } from 'react'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import Icon from '@material-ui/core/Icon'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import PropTypes from 'prop-types'
import { observer } from 'mobx-react'

function NestedMenuItem(props) {
  const {
    label,
    parentMenuOpen,
    children,
    tabIndex,
    zIndex,
    rightIcon,
    highlightColor,
  } = props
  const refs = useRef()
  const containerRefs = useRef()
  const menuContainerRefs = useRef(null)
  const [subMenuState, setSubMenuState] = useState(false)

  return (
    <div
      ref={containerRefs}
      onMouseEnter={e => {
        e.preventDefault()
        setSubMenuState(true)
        refs.current.style.backgroundColor = highlightColor
      }}
      onMouseLeave={() => {
        setSubMenuState(false)
        refs.current.style.backgroundColor = 'white'
      }}
      onClick={e => {
        e.preventDefault()
        setSubMenuState(!subMenuState)
      }}
      tabIndex={tabIndex}
      onFocus={e => {
        e.preventDefault()
        refs.current.style.backgroundColor = highlightColor
      }}
      onKeyDown={e => {
        if (
          e.key === 'ArrowRight' &&
          e.target === containerRefs.current &&
          !subMenuState
        ) {
          e.stopPropagation()
          setSubMenuState(true)
          //   menuContainerRefs.current &&
          //     menuContainerRefs.current.children[0].focus()
        }

        if (e.key === 'ArrowLeft' && subMenuState) {
          e.stopPropagation()
          setSubMenuState(false)
          containerRefs.current.focus()
        }
      }}
    >
      <MenuItem ref={refs}>
        {label}
        <ListItemIcon>
          <Icon color="primary" fontSize="small">
            {rightIcon}
          </Icon>
        </ListItemIcon>
      </MenuItem>
      <Menu
        style={{ pointerEvents: 'none', zIndex }}
        anchorEl={refs.current}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        open={subMenuState && parentMenuOpen}
        onClose={() => {
          setSubMenuState(false)
        }}
        onExited={() => {
          refs.current.style.backgroundColor = 'white'
          setSubMenuState(false)
        }}
      >
        <div ref={menuContainerRefs} style={{ pointerEvents: 'auto' }}>
          {children}
        </div>
      </Menu>
    </div>
  )
}

NestedMenuItem.propTypes = {
  label: PropTypes.string.isRequired,
  parentMenuOpen: PropTypes.bool.isRequired,
  tabIndex: PropTypes.number.isRequired,
  zIndex: PropTypes.number,
  rightIcon: PropTypes.string,
  highlightColor: PropTypes.string,
  children: PropTypes.array.isRequired,
}

NestedMenuItem.defaultProps = {
  zIndex: 0,
  rightIcon: 'chevron_right',
  highlightColor: '#eeeeee',
}

export default observer(NestedMenuItem)
