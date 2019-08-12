import { makeStyles } from '@material-ui/core'
import { getSession } from '@gmod/jbrowse-core/util'

import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useState } from 'react'

const useStyles = makeStyles(theme => ({
  root: {},
}))

const AlignmentInfo = observer(({ model, height }) => {
  const classes = useStyles()
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ height, width: 130 }} />
      <svg height={height} width="100%">
        {model.alignmentChunks.map(({ c1, c2, type }) => {
          console.log(type)
          return (
            <polygon
              points={`${c1.start},0 ${c1.end},0 ${c2.end},${height} ${c2.start},${height}`}
              style={{
                fill: type === 'match' ? '#f66' : '#f00',
                stroke: 'black',
                strokeWidth: 1,
              }}
            />
          )
        })}
      </svg>
    </div>
  )
})
function AlignmentView(props) {
  const { model } = props
  const { views } = model
  const session = getSession(model)
  const classes = useStyles()
  const {
    ReactComponent: LinearGenomeView,
  } = session.pluginManager.getViewType('LinearGenomeView')

  const chunks = [
    {
      c1: { start: 0, end: 100 },
      c2: { start: 0, end: 100 },
      type: 'match',
    },
    {
      c1: { start: 100, end: 100 },
      c2: { start: 100, end: 200 },
      type: 'ins',
    },
    {
      c1: { start: 100, end: 50000 },
      c2: { start: 200, end: 50100 },
      type: 'match',
    },
  ]
  console.log(views[0].offsetPx, views[1].offsetPx)
  const transform = (view, coord) => {
    return coord / view.bpPerPx - view.offsetPx
  }
  chunks.forEach(({ c1, c2 }) => {
    c1.start = transform(views[0], c1.start)
    c1.end = transform(views[0], c1.end)
    c2.start = transform(views[1], c2.start)
    c2.end = transform(views[1], c2.end)
  })

  return (
    <div className={classes.root}>
      <LinearGenomeView model={views[0]} />
      <AlignmentInfo model={{ alignmentChunks: chunks }} height={100} />
      <LinearGenomeView model={views[1]} />
    </div>
  )
}
AlignmentView.propTypes = {
  model: PropTypes.objectOrObservableObject.isRequired,
}

export default observer(AlignmentView)
