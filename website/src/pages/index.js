import React from 'react'
// eslint-disable-next-line import/no-unresolved
import Layout from '@theme/Layout'

// eslint-disable-next-line import/no-unresolved
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { makeStyles } from '@material-ui/core/styles'
import Link from '@material-ui/core/Link'
import Typography from '@material-ui/core/Typography'

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
            <ul>
              <li>
                {' '}
                <Link href="/jb2/blog" variant="contained">
                  Download latest release
                </Link>
              </li>
              <li>
                <Link
                  href={siteConfig.customFields.currentLink}
                  variant="contained"
                >
                  Browse demo instance
                </Link>
              </li>
            </ul>
          </div>
          <div style={{ flexBasis: '50%', padding: 20 }}>
            <img alt="screenshot of jbrowse 2" src="img/screenshot.png" />
          </div>
        </div>
        <div className={classes.section}>
          <Typography variant="h4">Features</Typography>
          <hr />

          <ul>
            <li>
              Linear, circular, dotplot, and synteny views for improved
              structural variant and comparative genomics visualization
            </li>
            <li>
              Support for many common data types including BAM, CRAM, tabix
              indexed VCF, GFF, BED, BigBed, BigWig, and several specialized
              formats
            </li>
            <li>
              New plugin ecosystem which can add additional view types, track
              types, data adapters, and more, allowing nearly endless
              extensibility
            </li>

            <li>And more!</li>
          </ul>
          <Link href="features">
            See a summary of features and comparison to JBrowse 1 here
          </Link>
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
            JBrowse is released under the Apache-2.0 License, see the JBrowse
            LICENSE file.
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
