import { TrackDbFile } from '@gmod/ucsc-hub'
import Button from '@material-ui/core/Button'
import Icon from '@material-ui/core/Icon'
import LinearProgress from '@material-ui/core/LinearProgress'
import Typography from '@material-ui/core/Typography'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'
import { onPatch } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React from 'react'
import JBrowse from '../../../JBrowse'
import Contents from '../../HierarchicalTrackSelectorDrawerWidget/components/Contents'

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

function makeTrackConfig(track, categories, ignoreUnsupported) {
  const trackType = track.get('type')
  const baseTrackType = trackType.split(' ')[0]
  switch (baseTrackType) {
    case 'bam':
      return {
        type: 'AlignmentsTrack',
        name: track.get('shortLabel'),
        description: track.get('longLabel'),
        category: categories,
        adapter: {
          type: 'BamAdapter',
          bamLocation: { uri: track.get('bigDataUrl') },
          index: {
            location: {
              uri:
                track.get('bigDataIndex') || `${track.get('bigDataUrl')}.bai`,
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

@observer
class ConfirmationDialog extends React.Component {
  static propTypes = {
    trackDbUrl: PropTypes.instanceOf(URL).isRequired,
    assemblyName: PropTypes.string.isRequired,
    hubName: PropTypes.string.isRequired,
    setPatches: PropTypes.func.isRequired,
    enableNext: PropTypes.func.isRequired,
  }

  state = {
    errorMessage: '',
    trackDb: new Map(),
    model: null,
    unsupportedTrackTypes: new Set(),
    unsupportedTrackTypeModels: new Map(),
    renderUnsupportedTrackTypes: false,
  }

  componentDidMount() {
    this.getTrackDb()
  }

  async getTrackDb() {
    const { trackDbUrl, enableNext } = this.props
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
    const model = this.generateModel(trackDb)
    this.setState({ model, trackDb })
    enableNext()
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

  generateUnsupportedTrackTypeModels() {
    const {
      unsupportedTrackTypes,
      trackDb,
      unsupportedTrackTypeModels,
    } = this.state
    unsupportedTrackTypes.forEach(trackType => {
      const model = this.generateModel(trackDb, trackType)
      unsupportedTrackTypeModels.set(trackType, model)
    })
    this.setState({ unsupportedTrackTypeModels })
  }

  generateModel(trackDb, trackType) {
    const { unsupportedTrackTypes } = this.state
    const { assemblyName, hubName, setPatches } = this.props
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
      tracks.push(makeTrackConfig(track, categories, !!trackType))
    })

    const jbrowse = new JBrowse().configure()

    const { model: rootModel } = jbrowse
    const patches = []
    onPatch(rootModel.configuration.tracks, patch => patches.push(patch))

    transaction(() => {
      tracks.forEach(track =>
        rootModel.configuration.addTrackConf(track.type, track),
      )
    })

    setPatches(patches)
    this.setState({ unsupportedTrackTypes })
    const firstView = rootModel.addView('LinearGenomeView')
    firstView.activateTrackSelector()
    return rootModel.drawerWidgets.get('hierarchicalTrackSelector')
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
    const {
      errorMessage,
      model,
      unsupportedTrackTypes,
      unsupportedTrackTypeModels,
      renderUnsupportedTrackTypes,
    } = this.state
    if (errorMessage)
      return <Typography color="error">{errorMessage}</Typography>
    if (!model) return <LinearProgress variant="query" />
    const confirmationContents = [
      <Contents key="mainContent" model={model} category={model.hierarchy} />,
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
                <Typography variant="h6">{trackType}</Typography>
                {unsupportedTrackTypeModels.get(trackType) ? (
                  <Contents
                    key="mainContent"
                    model={unsupportedTrackTypeModels.get(trackType)}
                    category={
                      unsupportedTrackTypeModels.get(trackType).hierarchy
                    }
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
