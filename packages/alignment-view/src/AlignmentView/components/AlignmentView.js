import { makeStyles } from '@material-ui/core'
import { getSession } from '@gmod/jbrowse-core/util'

import { observer, PropTypes } from 'mobx-react'
import React, { useState } from 'react'

const useStyles = makeStyles(theme => ({
  root: {},
}))
function transform(view, coord) {
  return coord / view.bpPerPx - view.offsetPx
}
const AlignmentInfo = observer(({ model, alignmentChunks, height }) => {
  const { views } = model
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ height, width: 130 }} />
      <svg height={height} width="100%">
        {Object.values(alignmentChunks).map(chunk => {
          const [c1, c2] = chunk
          const f1 = transform(views[0], c1[0])
          const f2 = transform(views[0], c1[2])
          const f3 = transform(views[1], c2[0])
          const f4 = transform(views[1], c2[2])
          return (
            <polygon
              key={JSON.stringify(chunk)}
              points={`${f1},0 ${f2},0 ${f3},${height} ${f4},${height}`}
              style={{
                fill: '#f00',
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

function findMatches(features1, features2) {
  const candidates = {}
  const matches = {}
  for (const f of features1.values()) {
    candidates[f.get('name')] = f
  }
  for (const f of features2.values()) {
    const name = f.get('name')
    const id = f.id()
    if (
      candidates[name] &&
      candidates[name].id() !== id &&
      candidates[name].get('start') - f.get('start') > 1000
    ) {
      matches[name] = [candidates[name], f]
    }
  }
  return matches
}
function AlignmentView(props) {
  const { model } = props
  const { views } = model
  const session = getSession(model)
  const classes = useStyles()
  const {
    ReactComponent: LinearGenomeView,
  } = session.pluginManager.getViewType('LinearGenomeView')

  const features1 = views[0].tracks[0].features
  const features2 = views[1].tracks[0].features
  const layoutFeats1 = views[0].tracks[0].layoutFeatures
  const layoutFeats2 = views[1].tracks[0].layoutFeatures
  const matches = findMatches(features1, features2)
  const layoutMatches = new Map()
  try {
    for (const [key, elt] of Object.entries(matches)) {
      const t1 = layoutFeats1.get(elt[0].id())
      const t2 = layoutFeats2.get(elt[1].id())
      layoutMatches[key] = [t1, t2]
    }
    console.log('layout', layoutMatches)
  } catch (e) {
    console.error(e)
  }

  return (
    <div className={classes.root}>
      <LinearGenomeView model={views[0]} />
      <AlignmentInfo
        model={model}
        alignmentChunks={layoutMatches}
        height={100}
      />
      <LinearGenomeView model={views[1]} />
    </div>
  )
}
AlignmentView.propTypes = {
  model: PropTypes.objectOrObservableObject.isRequired,
}

export default observer(AlignmentView)
