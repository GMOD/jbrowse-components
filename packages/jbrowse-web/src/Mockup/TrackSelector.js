import Checkbox from '@material-ui/core/Checkbox'
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import Grid from '@material-ui/core/Grid'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import React from 'react'

const useStyles = makeStyles(theme => ({
  root: {
    margin: theme.spacing(2),
  },
  heading: {
    fontSize: theme.typography.pxToRem(15),
    fontWeight: theme.typography.fontWeightRegular,
  },
}))

export default function SimpleExpansionPanel() {
  const classes = useStyles()

  return (
    <div className={classes.root}>
      <ExpansionPanel defaultExpanded>
        <ExpansionPanelSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1a-content"
          id="panel1a-header"
        >
          <Typography className={classes.heading}>Category 1</Typography>
        </ExpansionPanelSummary>
        <ExpansionPanelDetails>
          <Grid container spacing={3}>
            <Grid item>
              <FormControlLabel
                control={<Checkbox value="checkedA" />}
                label="First track name"
              />
            </Grid>
            <Grid item>
              <FormControlLabel
                control={<Checkbox value="checkedA" />}
                label="Second track name"
              />
            </Grid>
            <Grid item>
              <FormControlLabel
                control={<Checkbox value="checkedA" />}
                label="Third track name"
              />
            </Grid>
            <Grid item>
              <FormControlLabel
                control={<Checkbox value="checkedA" />}
                label="Fourth track name"
              />
            </Grid>
            <Grid item>
              <FormControlLabel
                control={<Checkbox value="checkedA" />}
                label="Fifth track name"
              />
            </Grid>
            <Grid item>
              <FormControlLabel
                control={<Checkbox value="checkedA" />}
                label="Sixth track name"
              />
            </Grid>
            <Grid item>
              <FormControlLabel
                control={<Checkbox value="checkedA" />}
                label="Seventh track name"
              />
            </Grid>
            <Grid item>
              <FormControlLabel
                control={<Checkbox value="checkedA" />}
                label="Eighth track name"
              />
            </Grid>
          </Grid>
        </ExpansionPanelDetails>
      </ExpansionPanel>
      <ExpansionPanel defaultExpanded>
        <ExpansionPanelSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1a-content"
          id="panel1a-header"
        >
          <Typography className={classes.heading}>Category 2</Typography>
        </ExpansionPanelSummary>
        <ExpansionPanelDetails>
          <Grid container spacing={3}>
            <Grid item>
              <FormControlLabel
                control={<Checkbox value="checkedA" />}
                label="Another track name"
              />
            </Grid>
          </Grid>
        </ExpansionPanelDetails>
      </ExpansionPanel>
    </div>
  )
}
