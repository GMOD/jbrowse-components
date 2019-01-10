import { GenomesFile } from '@gmod/ucsc-hub'
import Card from '@material-ui/core/Card'
import CardActions from '@material-ui/core/CardActions'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import FormControl from '@material-ui/core/FormControl'
import FormHelperText from '@material-ui/core/FormHelperText'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import InputLabel from '@material-ui/core/InputLabel'
import LinearProgress from '@material-ui/core/LinearProgress'
import MenuItem from '@material-ui/core/MenuItem'
import Select from '@material-ui/core/Select'
import Typography from '@material-ui/core/Typography'
import PropTypes from 'prop-types'
import React from 'react'

class GenomeSelector extends React.Component {
  static propTypes = {
    hubTxtUrl: PropTypes.instanceOf(URL).isRequired,
    hubTxt: PropTypes.instanceOf(Map).isRequired,
    enableNext: PropTypes.func,
    setTrackDbUrl: PropTypes.func.isRequired,
    setAssemblyName: PropTypes.func.isRequired,
  }

  static defaultProps = {
    enableNext: () => {},
  }

  state = {
    errorMessage: null,
    genomesFile: null,
    selectedGenome: '',
  }

  componentDidMount() {
    this.getGenomesFile()
  }

  async getGenomesFile() {
    const { hubTxt, hubTxtUrl } = this.props
    const genomesFileUrl = new URL(hubTxt.get('genomesFile'), hubTxtUrl)
    let response
    try {
      response = await fetch(genomesFileUrl)
    } catch (error) {
      this.setState({
        errorMessage: (
          <span>
            <strong>Network error.</strong> {error.message} <br />
            {genomesFileUrl.href}
          </span>
        ),
      })
      return
    }
    if (!response.ok) {
      this.setState({
        errorMessage: (
          <span>
            <strong>Could not accesss genomes file:</strong> <br />
            {genomesFileUrl.href} <br />
            {response.status}: {response.statusText}
          </span>
        ),
      })
      return
    }
    const responseText = await response.text()
    let genomesFile
    try {
      genomesFile = new GenomesFile(responseText)
    } catch (error) {
      this.setState({
        errorMessage: (
          <span>
            <strong>Could not parse genomes file:</strong> <br />
            {error.message} <br />
            {genomesFileUrl.href}
          </span>
        ),
      })
      return
    }
    this.setState({ genomesFile })
    this.handleSelect(Array.from(genomesFile.values())[0].get('genome'))
  }

  handleSelect = genomeName => {
    const { genomesFile } = this.state
    const {
      enableNext,
      hubTxt,
      hubTxtUrl,
      setTrackDbUrl,
      setAssemblyName,
    } = this.props
    const selectedGenome = genomeName
    this.setState({ selectedGenome })
    const trackDbUrl = genomesFile.get(genomeName).get('trackDb')
    setTrackDbUrl(
      new URL(trackDbUrl, new URL(hubTxt.get('genomesFile'), hubTxtUrl)),
    )
    setAssemblyName(genomesFile.get(genomeName).get('genome'))
    enableNext()
  }

  render() {
    const { errorMessage, genomesFile, selectedGenome } = this.state
    const { hubTxtUrl, hubTxt } = this.props
    if (errorMessage)
      return (
        <Card>
          <CardContent>
            <Typography color="error">{errorMessage}</Typography>
          </CardContent>
        </Card>
      )
    if (genomesFile)
      return (
        <Card>
          <CardHeader
            title={hubTxt.get('shortLabel')}
            subheader={hubTxt.get('longLabel')}
          />
          <CardContent>
            <FormControl>
              <InputLabel>Genome</InputLabel>
              <Select
                value={selectedGenome}
                onChange={event => this.handleSelect(event.target.value)}
              >
                {Array.from(genomesFile.values()).map(genome => {
                  const genomeName = genome.get('genome')
                  return (
                    <MenuItem key={genomeName} value={genomeName}>
                      {genomeName}
                    </MenuItem>
                  )
                })}
              </Select>
              <FormHelperText>Genomes available in this hub</FormHelperText>
            </FormControl>
          </CardContent>
          <CardActions>
            <IconButton
              href={`mailto:${hubTxt.get('email')}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon>email</Icon>
            </IconButton>
            {hubTxt.get('descriptionUrl') ? (
              <IconButton
                href={new URL(hubTxt.get('descriptionUrl'), hubTxtUrl).href}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Icon>open_in_new</Icon>
              </IconButton>
            ) : null}
          </CardActions>
        </Card>
      )
    return <LinearProgress variant="query" />
  }
}

export default GenomeSelector
