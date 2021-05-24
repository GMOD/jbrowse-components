import React from 'react'
import Layout from '@theme/Layout'

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
  const { currentVersion } = siteConfig.customFields
  const classes = useStyles()

  return (
    <Layout title={`${siteConfig.title}`}>
      <div className={classes.body}>
        <div className={classes.container}>
          <div style={{ flexBasis: '50%' }}>
            <h1>JBrowse 2</h1>
            <p>
              A pluggable open-source platform for visualizing and integrating
              biological data.
            </p>
            <p>
              Includes a full-featured web application, embeddable components
              for developers, and soon a desktop application.
            </p>
            <h3>Web</h3>
            <ul>
              <li>
                {' '}
                <Link href="/jb2/blog">Download latest web release</Link>
              </li>
              <li>
                <Link href={`https://jbrowse.org/code/jb2/${currentVersion}/`}>
                  Browse web demo instance
                </Link>
              </li>
            </ul>
            <h3>Embedded</h3>
            <ul>
              <li>
                <Link href="https://www.npmjs.com/package/@jbrowse/react-linear-genome-view">
                  Linear genome view React component on <tt>npm</tt>
                </Link>{' '}
                also see{' '}
                <Link
                  href={`https://jbrowse.org/storybook/lgv/${currentVersion}/`}
                >
                  storybook docs
                </Link>
              </li>
              <li>
                <Link href="https://gmod.github.io/JBrowseR/">
                  JBrowseR R package on <tt>CRAN</tt>
                </Link>
              </li>

              <li>More embeddable products coming soon</li>
            </ul>
            <h3>Command line tools</h3>
            <ul>
              <li>
                <Link href="https://github.com/GMOD/jb2export/">
                  @jbrowse/img image exporter
                </Link>
              </li>
            </ul>
            <h3>Desktop</h3>
            <ul>
              <li>Coming soon</li>
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
              Plugin ecosystem which can add additional view types, track types,
              data adapters, and more, for nearly endless extensibility
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
            JBrowse is released under the{' '}
            <a href="https://www.apache.org/licenses/LICENSE-2.0">
              Apache License, Version 2.0
            </a>
          </Typography>
        </div>
        <div className={classes.section}>
          <Typography variant="h4">Funding and Collaboration</Typography>
          <hr />
          <Typography>
            JBrowse development is supported by the US National Institutes of
            Health, The Chan Zuckerberg Initiative, The Ontario Institute for
            Cancer Research, and University of California, Berkeley.
          </Typography>
        </div>
      </div>
    </Layout>
  )
}

export default Home
