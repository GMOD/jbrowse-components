import React, { Component } from 'react'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import PropTypes from 'prop-types'

class NestedMenuItem extends Component {
  constructor(props) {
    super(props)
    this.state = {
      subMenuOpen: false,
    }
  }

  render() {
    const { subMenuOpen } = this.state
    const {
      label,
      parentMenuOpen,
      children,
      rightIcon,
      highlightColor,
    } = this.props
    return (
      <div
        onMouseEnter={e => {
          e.stopPropagation()
          this.setState({ subMenuOpen: true })
          this.refs.subMenuItem.style.backgroundColor = highlightColor
        }}
        onMouseLeave={e => {
          this.setState({ subMenuOpen: false })
          this.refs.subMenuItem.style.backgroundColor = 'white'
        }}
        onClick={e => {
          e.stopPropagation()
          this.setState({ subMenuOpen: !subMenuOpen })
        }}
      >
        <MenuItem ref="subMenuItem">
          {label}
          {rightIcon}
        </MenuItem>
        <Menu
          style={{ pointerEvents: 'none', zIndex: 10000 }}
          anchorEl={this.refs.subMenuItem}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          open={subMenuOpen && parentMenuOpen}
          onClose={() => {
            this.setState({ subMenuOpen: false })
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>{children}</div>
        </Menu>
      </div>
    )
  }
}

NestedMenuItem.propTypes = {
  label: PropTypes.string.isRequired,
  parentMenuOpen: PropTypes.bool.isRequired,
  rightIcon: PropTypes.object.isRequired,
  highlightColor: PropTypes.string,
  children: PropTypes.array.isRequired,
}

NestedMenuItem.defaultProps = {
  highlightColor: '#eeeeee',
}

export default NestedMenuItem
