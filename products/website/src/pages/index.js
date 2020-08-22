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
            <img alt="screenshot of jbrowse 2" src="img/screenshot.png" />
          </div>
        </div>
        <div className={classes.section}>
          <Typography variant="h4">Features</Typography>
          <hr />

          <p>
            In addition to a classic "linear genome view" with many jbrowse 1
            features carried over, jbrowse 2 also offers
          </p>
          <ul>
            <li>
              New additional views such as circular, dotplot, and synteny views,
              with the ability to add new view types via plugins also
            </li>
            <li>
              Ability to display multiple chromosomes or discontinuous regions
              on a single linear genome view
            </li>
            <li>
              Status updates while track is loading (e.g. Downloading BAM
              index...)
            </li>
            <li>Hi-C visualization from .hic format files</li>
            <li>
              Additional alignments track features including breakpoint split
              view, read pileup sorting, show soft clipping, and combined pileup
              and coverage track
            </li>
          </ul>
        </div>

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
