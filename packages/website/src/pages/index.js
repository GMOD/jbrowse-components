import React from 'react'
// eslint-disable-next-line import/no-unresolved
import Layout from '@theme/Layout'

// eslint-disable-next-line import/no-unresolved
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { withStyles, makeStyles } from '@material-ui/core/styles'

import Button from '@material-ui/core/Button'
import Typography from '@material-ui/core/Typography'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'

const Slide = props => <img {...props} alt="slide" />

const StyledTableCell = withStyles(theme => ({
  head: {
    backgroundColor: theme.palette.action.selected,
    color: theme.palette.text.primary,
  },
}))(TableCell)

const useStyles = makeStyles(theme => ({
  button: {
    textTransform: 'none',
  },
  section: {
    marginTop: '24px',
    marginBottom: '32px',
  },

  container: {
    display: 'flex',
    [theme.breakpoints.down('md')]: {
      flexDirection: 'column',
    },
    justifyContent: 'center',
    alignItems: 'center',
  },

  body: {
    [theme.breakpoints.down('md')]: {
      margin: '0.5em',
    },
    margin: '5em',
  },
}))

function Home() {
  const context = useDocusaurusContext()
  const { siteConfig = {} } = context
  const classes = useStyles()
  return (
    <Layout
      title={`${siteConfig.title}`}
      description="Description will go into a meta tag in <head />"
    >
      <div className={classes.body}>
        <div className={classes.container}>
          <div style={{ flexBasis: '50%' }}>
            <h1>JBrowse 2</h1>
            <p>
              A pluggable open-source platform for visualizing and integrating
              biological data
            </p>
            <Button variant="contained" color="secondary" disableElevation>
              Download latest release
            </Button>
          </div>
          <div style={{ flexBasis: '50%', padding: 20 }}>
            <img src="img/hic.png" />
          </div>
        </div>
        <Table>
          <TableHead>
            <TableRow>
              <StyledTableCell>JBrowse 2</StyledTableCell>
              <StyledTableCell>JBrowse 1</StyledTableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Runs on desktop or web</TableCell>
              <TableCell>Runs on desktop or web</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Supports many different view types</TableCell>
              <TableCell>Traditional linear view only</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Configure graphically</TableCell>
              <TableCell>Configure with files or scripts</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Many plugins in development</TableCell>
              <TableCell>Established plugin ecosystem</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <Button className={classes.button} variant="outlined">
                  Learn more
                </Button>
              </TableCell>

              <TableCell>
                <Button className={classes.button} variant="outlined">
                  Learn more
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className={classes.section}>
          <Typography variant="h4">Citation</Typography>
          <hr />
          <Typography variant="body1">
            Research citations are one of the main metrics the JBrowse project
            uses to demonstrate our relevance and utility when applying for
            funding to continue our work. If you use JBrowse in research that
            you publish, please cite the most recent JBrowse paper
          </Typography>
          <br />
          <Typography variant="body1">
            Buels, Robert, et al. &quot;JBrowse: a dynamic web platform for
            genome visualization and analysis.&quot; Genome Biology 17.1 (2016):
            66.
          </Typography>
        </div>
        <div className={classes.section}>
          <Typography variant="h4">License</Typography>
          <hr />
          <Typography>
            JBrowse is released under the GNU LGPL or the Artistic License, see
            the JBrowse LICENSE file.
          </Typography>
        </div>
        <div className={classes.section}>
          <Typography variant="h4">Funding and Collaboration</Typography>
          <hr />
          <Typography>
            The development of JBrowse is supported by grants from the US
            National Institutes of Health (R01HG004483 & U24 CA 220441) , The
            Chan Zuckerberg Initiative, The Ontario Institute for Cancer
            Research, and University of California, Berkeley.
          </Typography>
        </div>
      </div>
    </Layout>
  )
}

export default Home
