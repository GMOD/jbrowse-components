/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'
import AddIcon from '@material-ui/icons/Add'
import CalendarIcon from '@material-ui/icons/CalendarViewDay'
import { ConfigurationSchema, getConf } from '@jbrowse/core/configuration'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  getSession,
  getContainingTrack,
  getContainingView,
  isAbstractMenuManager,
} from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import { autorun } from 'mobx'
import {
  configSchemaFactory as linearComparativeDisplayConfigSchemaFactory,
  ReactComponent as LinearComparativeDisplayReactComponent,
  stateModelFactory as linearComparativeDisplayStateModelFactory,
} from './LinearComparativeDisplay'
import LinearComparativeViewFactory from './LinearComparativeView'
import {
  configSchemaFactory as linearSyntenyDisplayConfigSchemaFactory,
  stateModelFactory as linearSyntenyDisplayStateModelFactory,
} from './LinearSyntenyDisplay'
import LinearSyntenyRenderer, {
  configSchema as linearSyntenyRendererConfigSchema,
  ReactComponent as LinearSyntenyRendererReactComponent,
} from './LinearSyntenyRenderer'
import LinearSyntenyViewFactory from './LinearSyntenyView'
import {
  AdapterClass as MCScanAnchorsAdapter,
  configSchema as MCScanAnchorsConfigSchema,
} from './MCScanAnchorsAdapter'

const { parseCigar } = MismatchParser

interface Track {
  id: string
  type: string
  displays: {
    addAdditionalContextMenuItemCallback: Function
    additionalContextMenuItemCallbacks: Function[]
    id: string
    type: string
    PileupDisplay: any
  }[]
}
interface View {
  tracks: Track[]
  views?: View[]
  type: string
}
interface Session {
  views: View[]
}
function getLengthOnRef(cigar: string) {
  const cigarOps = parseCigar(cigar)
  let lengthOnRef = 0
  for (let i = 0; i < cigarOps.length; i += 2) {
    const len = +cigarOps[i]
    const op = cigarOps[i + 1]
    if (op !== 'H' && op !== 'S' && op !== 'I') {
      lengthOnRef += len
    }
  }
  return lengthOnRef
}

function getLength(cigar: string) {
  const cigarOps = parseCigar(cigar)
  let length = 0
  for (let i = 0; i < cigarOps.length; i += 2) {
    const len = +cigarOps[i]
    const op = cigarOps[i + 1]
    if (op !== 'D' && op !== 'N') {
      length += len
    }
  }
  return length
}

function getLengthSansClipping(cigar: string) {
  const cigarOps = parseCigar(cigar)
  let length = 0
  for (let i = 0; i < cigarOps.length; i += 2) {
    const len = +cigarOps[i]
    const op = cigarOps[i + 1]
    if (op !== 'H' && op !== 'S' && op !== 'D' && op !== 'N') {
      length += len
    }
  }
  return length
}
function getClip(cigar: string, strand: number) {
  return strand === -1
    ? +(cigar.match(/(\d+)[SH]$/) || [])[1] || 0
    : +(cigar.match(/^(\d+)([SH])/) || [])[1] || 0
}

interface ReducedFeature {
  refName: string
  start: number
  clipPos: number
  end: number
  seqLength: number
  syntenyId?: number
  uniqueId: string
  mate: {
    refName: string
    start: number
    end: number
    syntenyId?: number
    uniqueId?: string
  }
}

const useStyles = makeStyles(theme => ({
  root: {
    width: 300,
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

function WindowSizeDlg(props: {
  display: any
  handleClose: () => void
  track: any
}) {
  const classes = useStyles()
  const {
    track,
    display: { feature },
    handleClose,
  } = props
  const [window, setWindowSize] = useState('0')
  const [error, setError] = useState<Error>()
  const windowSize = +window

  function onSubmit() {
    try {
      const session = getSession(track)
      const view = getContainingView(track)
      const clipPos = feature.get('clipPos')
      const cigar = feature.get('CIGAR')
      const flags = feature.get('flags')
      const SA: string =
        (feature.get('tags') ? feature.get('tags').SA : feature.get('SA')) || ''
      const readName = feature.get('name')
      const readAssembly = `${readName}_assembly`
      const [trackAssembly] = getConf(track, 'assemblyNames')
      const assemblyNames = [trackAssembly, readAssembly]
      const trackId = `track-${Date.now()}`
      const trackName = `${readName}_vs_${trackAssembly}`

      // get the canonical refname for the read because if the
      // read.get('refName') is chr1 and the actual fasta refName is 1 then no
      // tracks can be opened on the top panel of the linear read vs ref
      const { assemblyManager } = session
      const assembly = assemblyManager.get(trackAssembly)

      const supplementaryAlignments = SA.split(';')
        .filter(aln => !!aln)
        .map((aln, index) => {
          const [saRef, saStart, saStrand, saCigar] = aln.split(',')
          const saLengthOnRef = getLengthOnRef(saCigar)
          const saLength = getLength(saCigar)
          const saLengthSansClipping = getLengthSansClipping(saCigar)
          const saStrandNormalized = saStrand === '-' ? -1 : 1
          const saClipPos = getClip(saCigar, saStrandNormalized)
          const saRealStart = +saStart - 1 + saClipPos
          return {
            refName: saRef,
            start: saRealStart,
            end: saRealStart + saLengthOnRef,
            seqLength: saLength,
            clipPos: saClipPos,
            CIGAR: saCigar,
            assemblyName: trackAssembly,
            strand: saStrandNormalized,
            uniqueId: `${feature.id()}_SA${index}`,
            mate: {
              start: saClipPos,
              end: saClipPos + saLengthSansClipping,
              refName: readName,
            },
          }
        })

      const feat = feature.toJSON()

      feat.mate = {
        refName: readName,
        start: clipPos,
        end: clipPos + getLengthSansClipping(cigar),
      }

      // if secondary alignment or supplementary, calculate length from SA[0]'s CIGAR
      // which is the primary alignments. otherwise it is the primary alignment just use
      // seq.length if primary alignment
      const totalLength =
        // eslint-disable-next-line no-bitwise
        flags & 2048
          ? getLength(supplementaryAlignments[0].CIGAR)
          : getLength(cigar)

      const features = [feat, ...supplementaryAlignments] as ReducedFeature[]

      features.forEach((f, index) => {
        f.refName = assembly?.getCanonicalRefName(f.refName) || f.refName
        f.syntenyId = index
        f.mate.syntenyId = index
        f.mate.uniqueId = `${f.uniqueId}_mate`
      })
      features.sort((a, b) => a.clipPos - b.clipPos)

      // the config feature store includes synthetic mate features
      // mapped to the read assembly
      const configFeatureStore = features.concat(
        // @ts-ignore
        features.map(f => f.mate),
      )

      const refLength = features.reduce(
        (a, f) => a + f.end - f.start + 2 * windowSize,
        0,
      )

      const seqTrackId = `${readName}_${Date.now()}`

      session.addView('LinearSyntenyView', {
        type: 'LinearSyntenyView',
        views: [
          {
            type: 'LinearGenomeView',
            hideHeader: true,
            offsetPx: 0,
            bpPerPx: refLength / view.width,
            displayedRegions: features.map(f => {
              return {
                start: f.start - windowSize,
                end: f.end + windowSize,
                refName: f.refName,
                assemblyName: trackAssembly,
              }
            }),
          },
          {
            type: 'LinearGenomeView',
            hideHeader: true,
            offsetPx: 0,
            bpPerPx: totalLength / view.width,
            displayedRegions: [
              {
                assemblyName: readAssembly,
                start: 0,
                end: totalLength,
                refName: readName,
              },
            ],
            tracks: [
              {
                id: `${Math.random()}`,
                type: 'ReferenceSequenceTrack',
                configuration: seqTrackId,
                displays: [
                  {
                    id: `${Math.random()}`,
                    type: 'LinearReferenceSequenceDisplay',
                    showReverse: false,
                    showTranslation: false,
                    configuration: `${seqTrackId}-LinearReferenceSequenceDisplay`,
                  },
                ],
              },
            ],
          },
        ],
        viewTrackConfigs: [
          {
            type: 'SyntenyTrack',
            assemblyNames,
            adapter: {
              type: 'FromConfigAdapter',
              features: configFeatureStore,
            },
            trackId,
            name: trackName,
          },
        ],
        viewAssemblyConfigs: [
          {
            name: readAssembly,
            sequence: {
              type: 'ReferenceSequenceTrack',
              trackId: seqTrackId,
              assemblyNames: [readAssembly],
              adapter: {
                type: 'FromConfigSequenceAdapter',
                features: [
                  {
                    start: 0,
                    end: totalLength,
                    seq: feat.seq,
                    refName: readName,
                    uniqueId: `${Math.random()}`,
                    id: `${Math.random()}`,
                  },
                ],
              },
            },
          },
        ],
        tracks: [
          {
            configuration: trackId,
            type: 'SyntenyTrack',
            displays: [
              {
                type: 'LinearSyntenyDisplay',
                configuration: `${trackId}-LinearSyntenyDisplay`,
              },
            ],
          },
        ],
        displayName: `${readName} vs ${trackAssembly}`,
      })
      handleClose()
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }
  return (
    <Dialog
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        Set window size
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <div className={classes.root}>
          <Typography>
            Show an extra window size around each part of the split alignment.
            Using a larger value can allow you to see more genomic context.
          </Typography>
          {error ? <Typography color="error">{`${error}`}</Typography> : null}

          <TextField
            value={window}
            onChange={event => {
              setWindowSize(event.target.value)
            }}
            label="Set window size"
          />
          <Button
            variant="contained"
            color="primary"
            style={{ marginLeft: 20 }}
            onClick={onSubmit}
          >
            Submit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default class extends Plugin {
  name = 'LinearComparativeViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(LinearComparativeViewFactory),
    )
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(LinearSyntenyViewFactory),
    )

    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'SyntenyTrack',
        {},
        { baseConfiguration: createBaseTrackConfig(pluginManager) },
      )
      return new TrackType({
        name: 'SyntenyTrack',
        configSchema,
        stateModel: createBaseTrackModel(
          pluginManager,
          'SyntenyTrack',
          configSchema,
        ),
      })
    })
    pluginManager.addDisplayType(() => {
      const configSchema = linearComparativeDisplayConfigSchemaFactory(
        pluginManager,
      )
      return new DisplayType({
        name: 'LinearComparativeDisplay',
        configSchema,
        stateModel: linearComparativeDisplayStateModelFactory(configSchema),
        trackType: 'SyntenyTrack',
        viewType: 'LinearComparativeView',
        ReactComponent: LinearComparativeDisplayReactComponent,
      })
    })
    pluginManager.addDisplayType(() => {
      const configSchema = linearSyntenyDisplayConfigSchemaFactory(
        pluginManager,
      )
      return new DisplayType({
        name: 'LinearSyntenyDisplay',
        configSchema,
        stateModel: linearSyntenyDisplayStateModelFactory(configSchema),
        trackType: 'SyntenyTrack',
        viewType: 'LinearSyntenyView',
        ReactComponent: LinearComparativeDisplayReactComponent,
      })
    })
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'MCScanAnchorsAdapter',
          configSchema: MCScanAnchorsConfigSchema,
          AdapterClass: MCScanAnchorsAdapter,
        }),
    )
    pluginManager.addRendererType(
      () =>
        new LinearSyntenyRenderer({
          name: 'LinearSyntenyRenderer',
          configSchema: linearSyntenyRendererConfigSchema,
          ReactComponent: LinearSyntenyRendererReactComponent,
        }),
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['File', 'Add'], {
        label: 'Linear synteny view',
        icon: CalendarIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('LinearSyntenyView', {})
        },
      })
    }

    const callback = (feature: Feature, display: any) => {
      return feature
        ? [
            {
              label: 'Linear read vs ref',
              icon: AddIcon,
              onClick: () => {
                const track = getContainingTrack(display)
                track.setDialogComponent(WindowSizeDlg, {
                  feature,
                })
              },
            },
          ]
        : []
    }

    function checkCallback(obj: any) {
      return obj.additionalContextMenuItemCallbacks.includes(callback)
    }
    function addCallback(obj: any) {
      obj.addAdditionalContextMenuItemCallback(callback)
    }
    function addContextMenu(view: View) {
      if (view.type === 'LinearGenomeView') {
        view.tracks.forEach(track => {
          if (track.type === 'AlignmentsTrack') {
            track.displays.forEach(display => {
              if (
                display.type === 'LinearPileupDisplay' &&
                !checkCallback(display)
              ) {
                addCallback(display)
              } else if (
                display.type === 'LinearAlignmentsDisplay' &&
                display.PileupDisplay &&
                !checkCallback(display.PileupDisplay)
              ) {
                addCallback(display.PileupDisplay)
              }
            })
          }
        })
      }
    }
    autorun(() => {
      const session = pluginManager.rootModel?.session as Session | undefined
      if (session) {
        session.views.forEach(view => {
          if (view.views) {
            view.views.forEach(v => addContextMenu(v))
          } else {
            addContextMenu(view)
          }
        })
      }
    })
  }
}
