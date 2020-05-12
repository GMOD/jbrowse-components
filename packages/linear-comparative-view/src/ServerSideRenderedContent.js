import React, { Component } from 'react'
import ReactPropTypes from 'prop-types'
import { observer, PropTypes } from 'mobx-react'
import { hydrate, unmountComponentAtNode } from 'react-dom'
import { isAlive } from 'mobx-state-tree'
import BlockError from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView/components/BlockError'

function ServerSideRenderedContent(props) {
  console.log('here')
  const { model } = props
  const {
    data,
    html,
    renderProps,
    renderingComponent: RenderingComponent,
  } = model

  return model.filled ? (
    <RenderingComponent {...data} {...renderProps} />
  ) : (
    <p>Loading</p>
  )
}
ServerSideRenderedContent.propTypes = {
  model: PropTypes.observableObject.isRequired,
}
export default observer(ServerSideRenderedContent)
