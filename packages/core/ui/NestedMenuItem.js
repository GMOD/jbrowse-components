import React, { useState, useRef } from 'react'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import Icon from '@material-ui/core/Icon'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import PropTypes from 'prop-types'
import { observer } from 'mobx-react'

function NestedMenuItem(props) {
  const { label, parentMenuOpen, children, rightIcon, highlightColor } = props
  const refs = useRef()
  const [subMenuState, setSubMenuState] = useState(false)

  return (
    <div
      onMouseEnter={e => {
        e.stopPropagation()
        setSubMenuState(true)
        refs.current.style.backgroundColor = highlightColor
      }}
      onMouseLeave={() => {
        setSubMenuState(false)
        refs.current.style.backgroundColor = 'white'
      }}
      onClick={e => {
        e.stopPropagation()
        setSubMenuState(!subMenuState)
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
        style={{ pointerEvents: 'none', zIndex: 10000 }}
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
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>{children}</div>
      </Menu>
    </div>
  )
}

// class NestedMenuItem extends React.Component {
//   constructor(props) {
//     super(props)
//     this.state = {
//       subMenuOpen: false,
//     }
//   }

//   render() {
//     console.log(this.refs)
//     const { subMenuOpen } = this.state
//     const {
//       label,
//       parentMenuOpen,
//       children,
//       rightIcon,
//       highlightColor,
//     } = this.props
//     return (
//       <div
//         onMouseEnter={e => {
//           e.stopPropagation()
//           this.setState({ subMenuOpen: true })
//           this.refs.subMenuItem.style.backgroundColor = highlightColor
//         }}
//         onMouseLeave={e => {
//           this.setState({ subMenuOpen: false })
//           this.refs.subMenuItem.style.backgroundColor = 'white'
//         }}
//         onClick={e => {
//           e.stopPropagation()
//           this.setState({ subMenuOpen: !subMenuOpen })
//         }}
//       >
//         <MenuItem ref="subMenuItem">
//           {label}
//           <ListItemIcon>
//             <Icon color="primary" fontSize="small">
//               {rightIcon}
//             </Icon>
//           </ListItemIcon>
//         </MenuItem>
//         <Menu
//           style={{ pointerEvents: 'none', zIndex: 10000 }}
//           anchorEl={this.refs.subMenuItem}
//           anchorOrigin={{
//             vertical: 'top',
//             horizontal: 'right',
//           }}
//           transformOrigin={{
//             vertical: 'top',
//             horizontal: 'left',
//           }}
//           open={subMenuOpen && parentMenuOpen}
//           onClose={() => {
//             this.setState({ subMenuOpen: false })
//           }}
//         >
//           <div style={{ pointerEvents: 'auto' }}>{children}</div>
//         </Menu>
//       </div>
//     )
//   }
// }

NestedMenuItem.propTypes = {
  label: PropTypes.string.isRequired,
  parentMenuOpen: PropTypes.bool.isRequired,
  rightIcon: PropTypes.string,
  highlightColor: PropTypes.string,
  children: PropTypes.array.isRequired,
}

NestedMenuItem.defaultProps = {
  rightIcon: 'chevron_right',
  highlightColor: '#eeeeee',
}

export default observer(NestedMenuItem)
