import { TrackDbFile } from '@gmod/ucsc-hub'
import { withStyles } from '@material-ui/core'
import Button from '@material-ui/core/Button'
import Icon from '@material-ui/core/Icon'
import LinearProgress from '@material-ui/core/LinearProgress'
import Typography from '@material-ui/core/Typography'
import { transaction } from 'mobx'
import { inject, observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import { readConfObject } from '../../../configuration'
import JBrowse from '../../../JBrowse'
import { Category } from '../../HierarchicalTrackSelectorDrawerWidget/components/Contents'

const supportedTrackTypes = [
  'bam',
  // 'bed',
  // 'bed5FloatScore',
  // 'bedGraph',
  // 'bedRnaElements',
  // 'bigBarChart',
  // 'bigBed',
  // 'bigChain',
  // 'bigInteract',
  // 'bigMaf',
  // 'bigPsl',
  // 'bigWig',
  // 'broadPeak',
  // 'coloredExon',
  // 'gvf',
  // 'ld2',
  // 'narrowPeak',
  // 'peptideMapping',
  // 'vcfTabix',
  // 'wig',
  // 'wigMaf',
]

function makeTrackConfig(track, categories, trackDbUrl, ignoreUnsupported) {
  const trackType = track.get('type')
  const baseTrackType = trackType.split(' ')[0]
  const bigDataUrl = new URL(track.get('bigDataUrl'), trackDbUrl)
  const bigDataIndex =
    track.get('bigDataIndex') && new URL(track.get('bigDataIndex'), trackDbUrl)
  switch (baseTrackType) {
    case 'bam':
      return {
        type: 'AlignmentsTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'BamAdapter',
          bamLocation: { uri: bigDataUrl.href },
          index: {
            location: {
              uri: bigDataIndex ? bigDataIndex.href : `${bigDataUrl.href}.bai`,
            },
          },
        },
      }
    default:
      if (ignoreUnsupported)
        return {
          type: 'AlignmentsTrack',
          name: track.get('shortLabel'),
          description: track.get('longLabel'),
          category: categories,
        }
      throw new Error(`Unsupported track type: ${baseTrackType}`)
  }
}

const styles = theme => ({
  unsupportedHeader: { marginTop: theme.spacing.unit * 4 },
})

@withStyles(styles)
@inject('rootModel')
@observer
class ConfirmationDialog extends React.Component {
  static propTypes = {
    trackDbUrl: PropTypes.instanceOf(URL).isRequired,
    assemblyName: PropTypes.string.isRequired,
    hubName: PropTypes.string.isRequired,
    rootModel: MobxPropTypes.observableObject.isRequired,
    enableNext: PropTypes.func.isRequired,
    classes: PropTypes.shape({ unsupportedHeader: PropTypes.string })
      .isRequired,
  }

  state = {
    errorMessage: '',
    trackDb: new Map(),
    tracks: [],
    unsupportedTrackTypes: new Set(),
    unsupportedTrackTypeModels: new Map(),
    renderUnsupportedTrackTypes: false,
  }

  async componentDidMount() {
    console.log('mounted')
    const { enableNext } = this.props
    const trackDb = await this.getTrackDb()
    if (!trackDb) return
    const tracks = this.generateTracks(trackDb)
    this.addTracksToModel(tracks)
    this.setState({ trackDb, tracks })
    enableNext()
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
      return undefined
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
      return undefined
    }
    const responseText = await response.text()
    let trackDb
    try {
      trackDb = new TrackDbFile(responseText)
    } catch (error) {
      this.setState({
        errorMessage: (
          <span>
            <strong>Could not parse trackDb.txt file</strong> <br />
            {error.message} <br />
            {trackDbUrl.href}
          </span>
        ),
      })
      return undefined
    }
    return trackDb
  }

  toggleUnsupported = () => {
    const {
      renderUnsupportedTrackTypes,
      unsupportedTrackTypeModels,
    } = this.state
    if (!renderUnsupportedTrackTypes && unsupportedTrackTypeModels.size === 0)
      this.generateUnsupportedTrackTypeModels()
    this.setState({ renderUnsupportedTrackTypes: !renderUnsupportedTrackTypes })
  }

  generateTracks(trackDb, trackType) {
    const { unsupportedTrackTypes } = this.state
    const { assemblyName, hubName, trackDbUrl } = this.props
    const categoryName = `${hubName}: ${assemblyName}`
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
      const ucscTrackType = track.get('type').split(' ')[0]
      if (trackType && trackType !== ucscTrackType) return
      if (!trackType && !supportedTrackTypes.includes(ucscTrackType)) {
        unsupportedTrackTypes.add(ucscTrackType)
        return
      }
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
      tracks.push(makeTrackConfig(track, categories, trackDbUrl, !!trackType))
    })

    return tracks
  }

  generateUnsupportedTrackTypeModels() {
    const {
      unsupportedTrackTypes,
      trackDb,
      unsupportedTrackTypeModels,
    } = this.state
    unsupportedTrackTypes.forEach(trackType => {
      const tracks = this.generateTracks(trackDb, trackType)
      const jbrowse = new JBrowse().configure()
      const { model: rootModel } = jbrowse
      this.addTracksToModel(tracks, rootModel)
      const firstView = rootModel.addView('LinearGenomeView')
      firstView.activateTrackSelector()
      const model = rootModel.drawerWidgets.get('hierarchicalTrackSelector')
      unsupportedTrackTypeModels.set(trackType, model)
    })
    this.setState({ unsupportedTrackTypeModels })
  }

  addTracksToModel(tracks, model) {
    const { rootModel } = this.props
    const currentModel = model || rootModel
    transaction(() => {
      tracks.forEach(track => {
        // For now prevent a track from getting added multiple times
        // TODO: Have "remote" tracks live somewhere separate from other tracks
        // so you don't have to worry about duplication.
        const currentTracks = currentModel.configuration.tracks
        if (
          !currentTracks.some(
            currentTrack =>
              track.category.some(
                (v, i) => v === readConfObject(currentTrack, 'category')[i],
              ) &&
              track.name === readConfObject(currentTrack, 'name') &&
              track.type === readConfObject(currentTrack, 'type'),
          )
        )
          currentModel.configuration.addTrackConf(track.type, track)
      })
    })
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
      return undefined
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
      return undefined
    }
    return rawResponse.text()
  }

  render() {
    const {
      errorMessage,
      tracks,
      unsupportedTrackTypes,
      unsupportedTrackTypeModels,
      renderUnsupportedTrackTypes,
    } = this.state
    const { rootModel, hubName, assemblyName, classes } = this.props
    const model = rootModel.drawerWidgets.get('hierarchicalTrackSelector')
    if (errorMessage)
      return <Typography color="error">{errorMessage}</Typography>
    if (!(tracks.length || unsupportedTrackTypes.size))
      return <LinearProgress variant="query" />
    const confirmationContents = [
      <Category
        key="mainContent"
        model={model}
        path={[`${hubName}: ${assemblyName}`]}
      />,
    ]
    if (unsupportedTrackTypes.size) {
      confirmationContents.push(
        <div key="unsupportedMessage">
          <br />
          <Icon style={{ color: 'red' }}>warning</Icon>
          <Typography>
            Some track types in this hub are not currently supported by JBrowse
            and cannot be imported.
          </Typography>
          <Button variant="outlined" onClick={this.toggleUnsupported}>
            {renderUnsupportedTrackTypes ? 'Hide' : 'Show'} unsupported tracks
          </Button>
        </div>,
      )
      if (renderUnsupportedTrackTypes)
        confirmationContents.push(
          <div key="unsupportedList">
            {Array.from(unsupportedTrackTypes.values()).map(trackType => (
              <div key={trackType}>
                <Typography className={classes.unsupportedHeader} variant="h6">
                  {trackType}
                </Typography>
                {unsupportedTrackTypeModels.get(trackType) ? (
                  <Category
                    model={unsupportedTrackTypeModels.get(trackType)}
                    path={[`${hubName}: ${assemblyName}`]}
                    disabled
                  />
                ) : null}
              </div>
            ))}
          </div>,
        )
    }
    return confirmationContents
  }
}

export default ConfirmationDialog
