/* eslint-disable react/require-default-props */
import { withStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { useEffect, Component } from 'react'

const styles = {
  trackRenderingContainer: {
    overflowY: 'auto',
    overflowX: 'hidden',
    background: '#333',
    whiteSpace: 'nowrap',
  },
}

/**
 * mostly does UI gestures: drag scrolling, etc
 */
class TrackRenderingContainer extends Component {
  constructor(props) {
    super(props)
    this.mainNode = React.createRef()
    this.wheel = this.wheel.bind(this)
  }

  componentDidMount() {
    if (this.mainNode.current)
      this.mainNode.current.addEventListener('wheel', this.wheel, {
        passive: false,
      })
  }

  wheel(event) {
    const { onHorizontalScroll } = this.props
    onHorizontalScroll(event.deltaX)
  }

  render() {
    const { trackId, children, classes } = this.props
    useEffect(() => {
      model.setScrollTop(this.mainNode.scrollTop)
    })

    return (
      <div
        className={classes.trackRenderingContainer}
        ref={this.mainNode}
        style={{
          gridRow: `track-${trackId}`,
          gridColumn: 'blocks',
        }}
        role="presentation"
      >
        {children}
      </div>
    )
  }

  static propTypes = {
    classes: PropTypes.objectOf(PropTypes.string).isRequired,
    trackId: PropTypes.string.isRequired,
    children: PropTypes.node,
    onHorizontalScroll: PropTypes.func.isRequired,
  }
}

export default withStyles(styles)(observer(TrackRenderingContainer))
