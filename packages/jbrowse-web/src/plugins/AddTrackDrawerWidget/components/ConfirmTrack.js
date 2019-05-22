import { withStyles } from '@material-ui/core'
import Link from '@material-ui/core/Link'
import MenuItem from '@material-ui/core/MenuItem'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import { observer } from 'mobx-react-lite'
import PropTypes from 'prop-types'
import React, { useEffect } from 'react'

const unsupported = 'unsupported'

export function guessAdapter(fileName, protocol) {
  if (/\.bam$/i.test(fileName))
    return {
      type: 'BamAdapter',
      bamLocation: { [protocol]: fileName },
      index: { location: { [protocol]: `${fileName}.bai` } },
    }
  if (/\.bai$/i.test(fileName))
    return {
      type: 'BamAdapter',
      bamLocation: { [protocol]: fileName.replace(/\.bai$/i, '') },
      index: { location: { [protocol]: fileName } },
    }
  if (/\.bam.csi$/i.test(fileName))
    return {
      type: 'BamAdapter',
      bamLocation: { [protocol]: fileName.replace(/\.csi$/i, '') },
      index: { location: { [protocol]: fileName }, indexType: 'CSI' },
    }

  if (/\.cram$/i.test(fileName))
    return {
      type: unsupported,
    }
  if (/\.crai$/i.test(fileName))
    return {
      type: unsupported,
    }

  if (/\.gff3?$/i.test(fileName))
    return {
      type: unsupported,
    }

  if (/\.gff3?\.gz$/i.test(fileName))
    return {
      type: unsupported,
    }
  if (/\.gff3?\.gz.tbi$/i.test(fileName))
    return {
      type: unsupported,
    }
  if (/\.gff3?\.gz.csi$/i.test(fileName))
    return {
      type: unsupported,
    }

  if (/\.gtf?$/i.test(fileName))
    return {
      type: unsupported,
    }

  if (/\.vcf$/i.test(fileName))
    return {
      type: unsupported,
    }

  if (/\.vcf\.gz$/i.test(fileName))
    return {
      type: unsupported,
    }
  if (/\.vcf\.gz\.tbi$/i.test(fileName))
    return {
      type: unsupported,
    }
  if (/\.vcf\.gz\.csi$/i.test(fileName))
    return {
      type: unsupported,
    }

  if (/\.vcf\.idx$/i.test(fileName))
    return {
      type: unsupported,
    }

  if (/\.bed$/i.test(fileName))
    return {
      type: unsupported,
    }

  if (/\.bed\.gz$/i.test(fileName))
    return {
      type: unsupported,
    }
  if (/\.bed.gz.tbi$/i.test(fileName))
    return {
      type: unsupported,
    }
  if (/\.bed.gz.csi/i.test(fileName))
    return {
      type: unsupported,
    }

  if (/\.bed\.idx$/i.test(fileName))
    return {
      type: unsupported,
    }

  if (/\.(bb|bigbed)$/i.test(fileName))
    return {
      type: unsupported,
    }

  if (/\.(bw|bigwig)$/i.test(fileName))
    return {
      type: 'BigWigAdapter',
      bigWigLocation: { [protocol]: fileName },
    }

  if (/\.(fa|fasta|fna|mfa)$/i.test(fileName))
    return {
      type: 'IndexedFastaAdapter',
      fastaLocation: { [protocol]: fileName },
      faiLocation: { [protocol]: `${fileName}.fai` },
    }
  if (/\.(fa|fasta|fna|mfa)\.fai$/i.test(fileName))
    return {
      type: 'IndexedFastaAdapter',
      fastaLocation: { [protocol]: fileName.replace(/\.fai$/i, '') },
      faiLocation: { [protocol]: fileName },
    }

  if (/\.(fa|fasta|fna|mfa)\.gz$/i.test(fileName))
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation: { [protocol]: fileName },
      faiLocation: { [protocol]: `${fileName}.fai` },
      gziLocation: { [protocol]: `${fileName}.gzi` },
    }
  if (/\.(fa|fasta|fna|mfa)\.gz\.fai$/i.test(fileName))
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation: { [protocol]: fileName.replace(/\.fai$/i, '') },
      faiLocation: { [protocol]: fileName },
      gziLocation: { [protocol]: `${fileName.replace(/\.fai$/i, '')}.gzi` },
    }
  if (/\.(fa|fasta|fna|mfa)\.gz\.gzi$/i.test(fileName))
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation: { [protocol]: fileName.replace(/\.gzi$/i, '') },
      faiLocation: { [protocol]: `${fileName.replace(/\.gzi$/i, '')}.fai` },
      gziLocation: { [protocol]: fileName },
    }

  if (/\.2bit$/i.test(fileName))
    return {
      type: 'TwoBitAdapter',
      twoBitLocation: { [protocol]: fileName },
    }

  if (/\.sizes$/i.test(fileName))
    return {
      type: unsupported,
    }

  if (/\/trackData.json$/i.test(fileName))
    return {
      type: 'NCListAdapter',
      rootUrlTemplate: fileName,
    }

  return {}
}

function guessTrackType(adapterType) {
  return {
    BamAdapter: 'AlignmentsTrack',
    BigWigAdapter: 'BasicTrack',
    IndexedFastaAdapter: 'SequenceTrack',
    BgzipFastaAdapter: 'SequenceTrack',
    TwoBitAdapter: 'SequenceTrack',
    NCListAdapter: 'BasicTrack',
  }[adapterType]
}

const styles = theme => ({
  spacing: {
    marginBottom: theme.spacing.unit * 3,
  },
})

function ConfirmTrack(props) {
  const {
    classes,
    trackData,
    trackName,
    setTrackAdapter,
    setTrackName,
    trackType,
    setTrackType,
    trackAdapter,
    assemblyName,
    setAssemblyName,
    rootModel,
  } = props

  useEffect(() => {
    if (trackData.uri) {
      const adapter = guessAdapter(trackData.uri, 'uri')
      setTrackAdapter(adapter)
      setTrackType(guessTrackType(adapter.type))
    }
    if (trackData.localPath) {
      const adapter = guessAdapter(trackData.uri, 'localPath')
      setTrackAdapter(adapter)
      setTrackType(guessTrackType(adapter.type))
    }
    if (trackData.config) setTrackAdapter({ type: 'FromConfigAdapter' })
  }, [trackData, setTrackAdapter, setTrackType])

  if (trackAdapter.type === unsupported)
    return (
      <Typography className={classes.spacing}>
        This version of JBrowse cannot display files of this type. It is
        possible, however, that there is a newer version that can display them.
        You can{' '}
        <Link
          href="https://github.com/GMOD/jbrowse-components/releases"
          target="_blank"
          rel="noopener noreferrer"
        >
          check for new releases
        </Link>{' '}
        of JBrowse or{' '}
        <Link
          href="https://github.com/GMOD/jbrowse-components/issues/new"
          target="_blank"
          rel="noopener noreferrer"
        >
          file an issue
        </Link>{' '}
        requesting support for this file type.
      </Typography>
    )
  if (!trackAdapter.type)
    // TODO: if file type is unrecognized, provide some way of specifying
    // adapter and guessing reasonable default for it.
    return <Typography>Could not recognize this file type.</Typography>
  if (trackData.uri || trackData.localPath || trackData.config) {
    let message = <></>
    if (trackData.uri || trackData.localPath)
      message = (
        <Typography className={classes.spacing}>
          Using adapter <code>{trackAdapter.type}</code> and guessing track type{' '}
          <code>{trackType}</code>. Please enter a track name and, if necessary,
          update the track type.
        </Typography>
      )
    else
      message = (
        <Typography className={classes.spacing}>
          Please enter a track type and track name.
        </Typography>
      )
    return (
      <>
        {message}
        <TextField
          className={classes.spacing}
          label="trackName"
          helperText="A name for this track"
          fullWidth
          value={trackName}
          onChange={event => setTrackName(event.target.value)}
          inputProps={{ 'data-testid': 'trackNameInput' }}
        />
        <TextField
          className={classes.spacing}
          value={trackType}
          label="trackType"
          helperText="A track type"
          select
          fullWidth
          onChange={event => setTrackType(event.target.value)}
          inputProps={{ 'data-testid': 'trackTypeSelect' }}
        >
          {rootModel.pluginManager
            .getElementTypesInGroup('track')
            .map(installedTrackType => (
              <MenuItem
                key={installedTrackType.name}
                value={installedTrackType.name}
              >
                {installedTrackType.name}
              </MenuItem>
            ))}
        </TextField>
        <TextField
          value={assemblyName}
          label="assemblyName"
          helperText="Assembly to which the track will be aded"
          select
          fullWidth
          onChange={event => setAssemblyName(event.target.value)}
          inputProps={{ 'data-testid': 'assemblyNameSelect' }}
        >
          {Array.from(rootModel.configuration.assemblies.keys()).map(
            newAssemblyName => (
              <MenuItem key={newAssemblyName} value={newAssemblyName}>
                {newAssemblyName}
              </MenuItem>
            ),
          )}
        </TextField>
      </>
    )
  }
  return <></>
}

ConfirmTrack.propTypes = {
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
  trackData: PropTypes.shape({
    uri: PropTypes.string,
    localPath: PropTypes.string,
    config: PropTypes.array,
  }).isRequired,
  trackName: PropTypes.string.isRequired,
  setTrackName: PropTypes.func.isRequired,
  trackType: PropTypes.string,
  setTrackType: PropTypes.func.isRequired,
  trackAdapter: PropTypes.shape({
    type: PropTypes.string,
  }).isRequired,
  setTrackAdapter: PropTypes.func.isRequired,
  rootModel: MobxPropTypes.observableObject.isRequired,
}

ConfirmTrack.defaultProps = {
  trackType: '',
}

export default withStyles(styles)(observer(ConfirmTrack))
