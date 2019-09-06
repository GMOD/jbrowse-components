import { makeStyles } from '@material-ui/core'
import { getSession } from '@gmod/jbrowse-core/util'

import { observer, PropTypes } from 'mobx-react'
import React, { useState } from 'react'

const useStyles = makeStyles(theme => ({
  root: {},
}))
function transform(view, coord) {
  return coord / view.bpPerPx - view.offsetPx + 120
}
const AlignmentInfo = observer(
  ({ model, alignmentChunks, height, children }) => {
    const { views } = model
    return (
      <div style={{ position: 'relative' }}>
        {children}
        <svg
          height="100%"
          width="100%"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          {Object.values(alignmentChunks).map(chunk => {
            const [c1, c2] = chunk
            const f1 = transform(views[0], c1[0])
            const f2 = transform(views[0], c1[2])
            const f3 = transform(views[1], c2[0])
            const f4 = transform(views[1], c2[2])

            const h1 = c1[3] + 32
            const h2 = 100 + 69 + c2[1]
            return (
              <polygon
                key={JSON.stringify(chunk)}
                points={`${f1},${h1} ${f2},${h1} ${f4},${h2} ${f3},${h2} `}
                style={{
                  fill: 'rgba(255,0,0,0.5)',
                }}
              />
            )
          })}
        </svg>
      </div>
    )
  },
)

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
      Math.abs(candidates[name].get('start') - f.get('start')) > 1000
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
  for (const [key, elt] of Object.entries(matches)) {
    const t1 = layoutFeats1.get(elt[0].id())
    const t2 = layoutFeats2.get(elt[1].id())
    layoutMatches[key] = [t1, t2]
  }

  return (
    <div className={classes.root}>
      <AlignmentInfo model={model} alignmentChunks={layoutMatches} height={100}>
        <LinearGenomeView model={views[0]} />
        <LinearGenomeView model={views[1]} />
      </AlignmentInfo>
    </div>
  )
}
AlignmentView.propTypes = {
  model: PropTypes.objectOrObservableObject.isRequired,
}

export default observer(AlignmentView)
