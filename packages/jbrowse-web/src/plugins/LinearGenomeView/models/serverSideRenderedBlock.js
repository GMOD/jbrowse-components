import {
  types,
  getParent,
  isAlive,
  getRoot,
  addDisposer,
} from 'mobx-state-tree'

import { reaction } from 'mobx'
import { getConf } from '../../../configuration'

import { Region } from '../../../mst-types'

import ServerSideRenderedBlockContent from '../components/ServerSideRenderedBlockContent'
import { assembleLocString } from '../../../util'
import { getContainingView } from '../../../util/tracks'

// calls the render worker to render the block content
// not using a flow for this, because the flow doesn't
// work with autorun
function renderBlockData(self) {
  const track = getParent(self, 2)
  const view = getContainingView(track)
  const rootModel = getRoot(view)
  const renderProps = { ...track.renderProps }
  const { rendererType } = track

  return {
    rendererType,
    rootModel,
    renderProps,
    renderArgs: {
      region: self.region,
      adapterType: track.adapterType.name,
      adapterConfig: getConf(track, 'adapter'),
      rootConfig: getConf(rootModel),
      rendererType: rendererType.name,
      renderProps,
      sessionId: track.id,
      timeout: 1000000, // 10000,
    },
  }
}
function renderBlockEffect(
  self,
  { rendererType, renderProps, rootModel, renderArgs },
) {
  // console.log(getContainingView(self).rendererType)
  if (!isAlive(self)) return
  if (self.renderInFlight) self.renderInFlight.cancelled = true
  const inProgress = {}
  self.setLoading(inProgress)
  try {
    rendererType
      .renderInClient(rootModel, renderArgs)
      .then(({ html, ...data }) => {
        if (!isAlive(self) || inProgress.cancelled) return
        self.setRendered(data, html, rendererType.ReactComponent, renderProps)
      })
      .catch(error => {
        console.error(error)
        if (isAlive(self) && !inProgress.cancelled) self.setError(error)
      })
  } catch (error) {
    if (isAlive(self) && !inProgress.cancelled) self.setError(error)
  }
}

// the MST state of a single server-side-rendered block in a track
export default types
  .model('BlockState', {
    key: types.string,
    region: Region,
    isLeftEndOfDisplayedRegion: false,
    isRightEndOfDisplayedRegion: false,
  })
  // NOTE: all this volatile stuff has to be filled in at once, so that it stays consistent
  .volatile(() => ({
    filled: false,
    data: undefined,
    html: '',
    error: undefined,
    reactComponent: ServerSideRenderedBlockContent,
    renderingComponent: undefined,
    renderProps: undefined,
    renderInFlight: undefined,
  }))
  .actions(self => ({
    afterAttach() {
      const track = getContainingView(self)
      const renderDisposer = reaction(
        () => renderBlockData(self),
        data => renderBlockEffect(self, data),
        {
          name: `${track.id}/${assembleLocString(self.region)} rendering`,
          delay: track.renderDelay,
          fireImmediately: true,
        },
      )
      addDisposer(self, renderDisposer)
    },
    setLoading(inProgressRecord) {
      self.filled = false
      self.html = ''
      self.data = undefined
      self.error = undefined
      self.renderInProgress = inProgressRecord
    },
    setRendered(data, html, renderingComponent, renderProps) {
      self.filled = true
      self.data = data
      self.html = html
      self.renderingComponent = renderingComponent
      self.renderProps = renderProps
    },
    setError(error) {
      // the rendering failed for some reason
      self.error = error
    },
  }))
