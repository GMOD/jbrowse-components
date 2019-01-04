import { TrackDbFile } from '@gmod/ucsc-hub'
import LinearProgress from '@material-ui/core/LinearProgress'
import Typography from '@material-ui/core/Typography'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import JBrowse from '../../../JBrowse'
import Contents from '../../HierarchicalTrackSelectorDrawerWidget/components/Contents'

function generateModel(trackDb, categoryName) {
  const tracks = []

  trackDb.forEach((track, trackName) => {
    const trackKeys = Array.from(track.keys())
    const parentTrackKeys = [
      'superTrack',
      'compositeTrack',
      'container',
      'view',
    ]
    if (trackKeys.some(key => parentTrackKeys.includes(key))) return
    const parentTracks = []
    let currentTrackName = trackName
    do {
      currentTrackName = trackDb.get(currentTrackName).get('parent')
      if (currentTrackName) {
        ;[currentTrackName] = currentTrackName.split(' ')
        parentTracks.push(trackDb.get(currentTrackName).get('shortLabel'))
      }
    } while (currentTrackName)
    parentTracks.reverse()
    const categories = [categoryName].concat(parentTracks)
    tracks.push({
      type: 'AlignmentsTrack',
      name: track.get('shortLabel'),
      description: track.get('longLabel'),
      category: categories,
    })
  })

  const jbrowse = new JBrowse()

  jbrowse.configure({
    views: {
      LinearGenomeView: {},
    },
    tracks,
  })

  const { model: rootModel } = jbrowse

  const firstView = rootModel.addView('LinearGenomeView')
  firstView.activateTrackSelector()
  return rootModel.drawerWidgets.get('hierarchicalTrackSelector')
}

@observer
class ConfirmationDialog extends React.Component {
  static propTypes = {
    trackDbUrl: PropTypes.instanceOf(URL).isRequired,
    assemblyName: PropTypes.string.isRequired,
    hubName: PropTypes.string.isRequired,
  }

  state = {
    errorMessage: '',
    trackDb: new Map(),
  }

  componentDidMount() {
    this.getTrackDb()
  }

  async getTrackDb() {
    const { trackDbUrl } = this.props
    let response
    try {
      response = await fetch(trackDbUrl)
    } catch (error) {
      this.setState({
        errorMessage: (
          <span>
            <strong>Network error.</strong> {error.message} <br />
            {trackDbUrl.href}
          </span>
        ),
      })
      return
    }
    if (!response.ok) {
      this.setState({
        errorMessage: (
          <span>
            <strong>Could not access TrackDb file</strong> <br />
            {trackDbUrl.href} <br />
            {response.status}: {response.statusText}
          </span>
        ),
      })
      return
    }
    const responseText = await response.text()
    let trackDb
    try {
      trackDb = new TrackDbFile(responseText)
    } catch (error) {
      console.log(error)
      this.setState({
        errorMessage: (
          <span>
            <strong>Could not parse trackDb.txt file</strong> <br />
            {error.message} <br />
            {trackDbUrl.href}
          </span>
        ),
      })
      return
    }
    this.setState({ trackDb })
  }

  async doGet(url) {
    let rawResponse
    try {
      rawResponse = await fetch(url)
    } catch (error) {
      this.setState({
        errorMessage: (
          <span>
            <strong>Network error.</strong> {error.message} <br />
            {url.href}
          </span>
        ),
      })
      return null
    }
    if (!rawResponse.ok) {
      this.setState({
        errorMessage: (
          <span>
            <strong>URL is invalid</strong> <br />
            {url.href}
          </span>
        ),
      })
      return null
    }
    return rawResponse.text()
  }

  render() {
    const { errorMessage, trackDb } = this.state
    const { assemblyName, hubName } = this.props
    if (errorMessage)
      return <Typography color="error">{errorMessage}</Typography>
    if (!trackDb) return <LinearProgress variant="query" />
    const categoryName = `${hubName}: ${assemblyName}`
    const model = generateModel(trackDb, categoryName)
    return <Contents model={model} category={model.hierarchy} />
  }
}

export default ConfirmationDialog
