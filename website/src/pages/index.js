import React from 'react'
import Layout from '@theme/Layout'

import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import {
  Link,
  ThemeProvider,
  Typography,
  Button,
  Box,
  useTheme,
  createTheme,
} from '@mui/material'
import { makeStyles } from '@mui/styles'
import GetAppIcon from '@mui/icons-material/GetApp'
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser'

const useStyles = makeStyles(theme => ({
  section: {
    marginTop: '24px',
    marginBottom: '32px',
  },
  bannerText: {
    fontWeight: 'bold',
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

  rowEvenlyContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    gap: 10,
  },
  noHoverButton: {
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
}))

function Home() {
  const context = useDocusaurusContext()
  const { siteConfig = {} } = context
  const { currentVersion, bannerBulletin } = siteConfig.customFields
  const classes = useStyles()
  const theme = useTheme()

  return (
    <Layout title={`${siteConfig.title}`}>
      <div
        style={{
          margin: theme.breakpoints.down('md') ? '0.5em' : '3em',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: theme.breakpoints.down('md') ? 'column' : 'row',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flex: '50%',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 20,
            }}
          >
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
            <div className={classes.rowEvenlyContainer}>
              <Button
                variant="contained"
                startIcon={<GetAppIcon />}
                href="/jb2/download/#jbrowse-2-desktop"
                className={classes.noHoverButton}
              >
                Download JBrowse Desktop
              </Button>
              <Button
                variant="contained"
                startIcon={<OpenInBrowserIcon />}
                href={`https://jbrowse.org/code/jb2/${currentVersion}/`}
                className={classes.noHoverButton}
              >
                Browse web demo instance
              </Button>
            </div>
            <Typography
              variant="caption"
              style={{
                textAlign: 'center',
              }}
            >
              Also check out our&nbsp;
              <Link href="/jb2/blog">latest release blogpost</Link>, our&nbsp;
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
          <div style={{ flex: '50%', paddingLeft: '20px' }}>
            <img
              style={{
                borderRadius: '8px',
                border: '4px solid #e0e0e0',

                // see https://web.dev/optimize-cls/#modern-best-practice
                // the width/height attributes are set on the image and sized using css here
                height: 'auto',
                width: '100%',
              }}
              width={1362}
              height={731}
              alt="screenshot of jbrowse 2"
              src="img/screenshot.png"
            />
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-around',
            backgroundColor: '#F0F0F0',
            padding: '25px',
            alignItems: 'center',
          }}
        >
          <Typography variant="h4" className={classes.bannerText}>
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
        <div className={classes.section}>
          <Typography variant="h4">Features</Typography>
          <hr />
          <div
            style={{
              display: 'flex',
              flexDirection: theme.breakpoints.down('md') ? 'column' : 'row',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ flex: '50%' }}>
              <ul>
                <li>
                  Improved <b>structural variant</b> and{' '}
                  <b>compariative genomics visualization</b> with linear,
                  circular, dotplot, and synteny views
                </li>
                <li>
                  <b>Support for many common data types</b> including BAM, CRAM,
                  tabix indexed VCF, GFF, BED, BigBed, BigWig, and several
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
                style={{
                  borderRadius: '8px',
                  border: '4px solid #e0e0e0',

                  // see https://web.dev/optimize-cls/#modern-best-practice
                  // the width/height attributes are set on the image and sized using css here
                  height: 'auto',
                  width: '100%',
                }}
                width={1377}
                height={614}
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
            <Link href="https://www.apache.org/licenses/LICENSE-2.0">
              Apache License, Version 2.0
            </Link>
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

export default () => {
  return (
    <ThemeProvider theme={createTheme()}>
      <Home />
    </ThemeProvider>
  )
}
