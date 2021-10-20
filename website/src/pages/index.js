import React from 'react'
import Layout from '@theme/Layout'

import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { Link, Typography, Button, makeStyles, Box } from '@material-ui/core'
import GetAppIcon from '@material-ui/icons/GetApp'
import OpenInBrowserIcon from '@material-ui/icons/OpenInBrowser'

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
    alignItems: 'center',
  },
  banner: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F0F0F0',
    padding: '25px',
    alignItems: 'center',
  },
  bannerText: {
    [theme.breakpoints.down('xs')]: {
      fontSize: 'large',
    },
    [theme.breakpoints.down('sm')]: {
      fontSize: 'large',
    },
  },
  bannerButton: {
    [theme.breakpoints.down('xs')]: {
      fontSize: 'x-small',
      maxWidth: 'min-content',
    },
    [theme.breakpoints.down('sm')]: {
      fontSize: 'x-small',
      maxWidth: 'min-content',
    },
  },
  body: {
    [theme.breakpoints.down('md')]: {
      margin: '0.5em',
    },
    margin: '3em',
  },
  productContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  rowEvenlyContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  noHoverButtonA: {
    [theme.breakpoints.down('xs')]: {
      fontSize: 'x-small',
    },
    [theme.breakpoints.down('sm')]: {
      fontSize: 'x-small',
    },
    '&:hover, &:focus': {
      color: 'white',
    },
  },
  noHoverButtonB: {
    [theme.breakpoints.down('xs')]: {
      fontSize: 'x-small',
    },
    [theme.breakpoints.down('sm')]: {
      fontSize: 'x-small',
    },
    '&:hover, &:focus': {
      color: 'black',
    },
  },
  logo: {
    width: '150px',
    height: '150px',
  },
  containRow: {
    display: 'flex',
    flexDirection: 'row',
  },
  containColumn: {
    display: 'flex',
    flexDirection: 'column',
  },
  screenshot: {
    borderRadius: '8px',
    border: '4px solid #e0e0e0',
  },
  blurbAndButtonsContainer: {
    display: 'flex',
    flexDirection: 'column',
    flex: '55%',
    justifyContent: 'center',
    gap: '20px',
  },
}))

function Home() {
  const context = useDocusaurusContext()
  const { siteConfig = {} } = context
  const { currentVersion, bannerBulletin } = siteConfig.customFields
  const classes = useStyles()

  return (
    <Layout title={`${siteConfig.title}`}>
      <div className={classes.body}>
        <div className={classes.container}>
          <div className={classes.blurbAndButtonsContainer}>
            <Box sx={{ marginLeft: { xs: '0px', sm: '0px', md: '50px' } }}>
              <Typography variant="h5">
                JBrowse: The next generation genome browser
              </Typography>
              <Typography variant="body1">
                The mission of the JBrowse Consortium is to develop a
                comprehensive, pluggable, open-source computational platform for
                visualizing and integrating biological data.
              </Typography>
            </Box>
            <div className={classes.productContainer}>
              <div
                className={classes.rowEvenlyContainer}
                style={{ gap: '10px' }}
              >
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<GetAppIcon width={20} />}
                  href="/jb2/download/#jbrowse-2-desktop"
                  className={classes.noHoverButtonA}
                >
                  Download JBrowse Desktop
                </Button>
                <Button
                  variant="contained"
                  startIcon={<OpenInBrowserIcon />}
                  href={`https://jbrowse.org/code/jb2/${currentVersion}/`}
                  className={classes.noHoverButtonB}
                >
                  Browse web demo instance
                </Button>
              </div>
              <div style={{ display: 'flex', alignSelf: 'center' }}>
                <Typography variant="caption">
                  Also check out our&nbsp;
                  <Link href="/jb2/blog">latest release blogpost</Link>,
                  our&nbsp;
                  <Link href="/jb2/download/#jbrowse-2-embedded-components">
                    embedded components
                  </Link>
                  , and our&nbsp;
                  <Link href="/jb2/download/#jbrowse-2-web">
                    command line tools
                  </Link>
                  .
                </Typography>
              </div>
            </div>
          </div>
          <div style={{ flex: '45%', paddingLeft: '20px' }}>
            <img
              className={classes.screenshot}
              alt="screenshot of jbrowse 2"
              src="img/screenshot.png"
            />
          </div>
        </div>
      </div>
      <div className={classes.banner}>
        <Typography
          variant="h4"
          style={{
            fontWeight: 'bold',
          }}
          className={classes.bannerText}
        >
          {bannerBulletin}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          size="large"
          href={`https://github.com/GMOD/jbrowse-components/releases/tag/${currentVersion}/`}
          className={classes.bannerButton}
        >
          Learn more
        </Button>
      </div>
      <div className={classes.body}>
        <div className={classes.section}>
          <Typography variant="h4">Features</Typography>
          <hr />
          <div
            className={classes.container}
            style={{ alignItems: 'flex-start' }}
          >
            <div style={{ flex: '50%' }}>
              <ul>
                <li>
                  Improved <b>structural variant</b> and{' '}
                  <b> compariative genomics visualization</b> with linear,
                  circular, dotplot, and synteny views
                </li>
                <li>
                  <b>Support for many common data types </b> including BAM,
                  CRAM, tabix indexed VCF, GFF, BED, BigBed, BigWig, and several
                  specialized formats
                </li>
                <li>
                  <b>Endless extensibility</b> with a plugin ecosytem which can
                  add additional view types, track types, data adapters, and
                  more!
                </li>
                <li>
                  <Link href="features">
                    See a summary of new features and a comparison to JBrowse 1
                  </Link>
                </li>
              </ul>
            </div>
            <div style={{ flex: '50%', paddingLeft: '20px' }}>
              <img
                className={classes.screenshot}
                alt="screenshot of jbrowse 2"
                src="img/sv_inspector_importform_loaded.png"
              />
            </div>
          </div>
        </div>

        <div className={classes.section}>
          <Typography variant="h4">Citation</Typography>
          <hr />
          <Typography variant="body1">
            Research citations are one of the main metrics the JBrowse project
            uses to demonstrate our relevance and utility when applying for
            funding to continue our work. If you use JBrowse in research that
            you publish, please cite the most recent JBrowse paper:
          </Typography>
          <br />
          <Typography variant="overline">
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
            .
          </Typography>
        </div>
        <div className={classes.section}>
          <Typography variant="h4">Funding and Collaboration</Typography>
          <hr />
          <Typography variant="body1">
            JBrowse development is supported by the US National Institutes of
            Health (U41 HG003751), The Chan Zuckerberg Initiative, The Ontario
            Institute for Cancer Research, and the University of California,
            Berkeley.
          </Typography>
        </div>
      </div>
    </Layout>
  )
}

export default Home
