import FormControl from '@material-ui/core/FormControl'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormHelperText from '@material-ui/core/FormHelperText'
import Radio from '@material-ui/core/Radio'
import RadioGroup from '@material-ui/core/RadioGroup'
import propTypes from 'prop-types'
import React from 'react'

const hubTypeDescriptions = {
  ucsc: (
    <FormHelperText>
      A track or assembly hub in the{' '}
      <a
        href="http://genome.ucsc.edu/goldenPath/help/hgTrackHubHelp.html#Intro"
        rel="noopener noreferrer"
        target="_blank"
      >
        Track Hub
      </a>{' '}
      format
    </FormHelperText>
  ),
  jbrowse1: (
    <FormHelperText>
      A{' '}
      <a href="https://jbrowse.org/" rel="noopener noreferrer" target="_blank">
        JBrowse 1
      </a>{' '}
      data directory
    </FormHelperText>
  ),
}

function HubTypeSelect(props) {
  const { hubType, setHubType, enableNext } = props
  const hubTypes = [
    { value: 'ucsc', label: 'Track or Assembly Hub' },
    { value: 'jbrowse1', label: 'JBrowse Hub' },
  ]
  return (
    <FormControl component="fieldset">
      <RadioGroup
        value={hubType}
        onChange={event => {
          setHubType(event)
          enableNext()
        }}
      >
        {hubTypes.map(entry => (
          <FormControlLabel
            key={entry.value}
            control={<Radio />}
            value={entry.value}
            label={entry.label}
          />
        ))}
      </RadioGroup>
      {hubTypeDescriptions[hubType]}
    </FormControl>
  )
}

HubTypeSelect.defaultProps = {
  hubType: undefined,
}

HubTypeSelect.propTypes = {
  hubType: propTypes.string,
  setHubType: propTypes.func.isRequired,
  enableNext: propTypes.func.isRequired,
}

export default HubTypeSelect
