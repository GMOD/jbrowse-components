import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useState } from 'react'
import Typography from '@material-ui/core/Typography'
import MenuItem from '@material-ui/core/MenuItem'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'
import Icon from '@material-ui/core/Icon'
import Tooltip from '@material-ui/core/Tooltip'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import { mutationHighlightFeatures } from './Utility'

const useStyles = makeStyles(theme => ({
  root: {
    padding: theme.spacing(1, 3, 1, 1),
    background: theme.palette.background.default,
    overflowX: 'hidden',
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 150,
  },
  text: {
    display: 'flex',
    alignItems: 'center',
  },
}))

/**
 * Render a highlight/colour by element for colouring features
 */
export const MutationHighlightFeature = observer(({ schema }) => {
  const classes = useStyles()
  const [highlightBy, setHighlightBy] = useState({})

  const handleChangeHighlightBy = event => {
    const hlBy = event.target.value
    setHighlightBy(hlBy)
    setColourBy(hlBy)
  }

  const setColourBy = hlBy => {
    if (hlBy.type === 'splitCount') {
      schema.target.renderer.color1.set(
        `function(feature) { if (feature.get('${hlBy.attributeName}') > ${hlBy.values[0].splitBy}) {return '${hlBy.values[0].colour1}'; } else {return '${hlBy.values[0].colour2}'; } }`,
      )
    } else if (hlBy.type === 'category') {
      if (
        hlBy.name === 'VEP' ||
        hlBy.name === 'SIFT' ||
        hlBy.name === 'PolyPhen'
      ) {
        let switchStatement = `switch(impact) {`
        hlBy.values.forEach(element => {
          switchStatement += `case '${element.name}': return '${element.colour}'; break;`
        })
        switchStatement += '}'
        schema.target.renderer.color1.set(
          `function(feature) { const filteredConsequences = feature.get('consequence').hits.edges.filter(cons => cons.node.transcript.is_canonical); const impact = filteredConsequences[0].node.transcript.annotation.${hlBy.attributeName}; ${switchStatement}}`,
        )
      } else {
        let switchStatement = `switch(attrValue) {`
        hlBy.values.forEach(element => {
          switchStatement += `case '${element.name}': return '${element.colour}'; break;`
        })
        switchStatement += '}'
        schema.target.renderer.color1.set(
          `function(feature) { const attrValue = feature.get('${hlBy.attributeName}'); ${switchStatement}}`,
        )
      }
    }
  }

  return (
    <>
      <Typography variant="h6" className={classes.text}>
        Colour Features
        <Tooltip
          title="Colour features on track based on feature attributes"
          aria-label="help"
          placement="right"
        >
          <Icon>help</Icon>
        </Tooltip>
      </Typography>
      <FormControl className={classes.formControl}>
        <Select
          labelId="category-select-label"
          id="category-select"
          value={highlightBy}
          onChange={handleChangeHighlightBy}
        >
          <MenuItem disabled value="">
            <em>Attribute</em>
          </MenuItem>
          {mutationHighlightFeatures.map(element => {
            return (
              <MenuItem value={element} key={element.name}>
                {element.name}
              </MenuItem>
            )
          })}
        </Select>
      </FormControl>
      {highlightBy && highlightBy.values && (
        <div>
          <Typography variant="subtitle2" className={classes.text}>
            {highlightBy.description}
          </Typography>
          {highlightBy.values && highlightBy.type === 'category' && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Value</TableCell>
                  <TableCell>Colour</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {highlightBy.values &&
                  highlightBy.values.map(value => {
                    return (
                      <TableRow key={value.name}>
                        <TableCell>
                          {value.name !== '' ? value.name : 'n/a'}
                        </TableCell>
                        <TableCell>{value.colour}</TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          )}

          {highlightBy.values && highlightBy.type === 'splitCount' && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Value</TableCell>
                  <TableCell>Split By</TableCell>
                  <TableCell>Lower Colour</TableCell>
                  <TableCell>Higher Colour</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {highlightBy.values &&
                  highlightBy.values.map(value => {
                    return (
                      <TableRow key={value.name}>
                        <TableCell>
                          {value.name !== '' ? value.name : 'n/a'}
                        </TableCell>
                        <TableCell>{value.splitBy}</TableCell>
                        <TableCell>{value.colour1}</TableCell>
                        <TableCell>{value.colour2}</TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </>
  )
})
