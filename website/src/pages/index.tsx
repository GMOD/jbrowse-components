import React from 'react'
import Layout from '@theme/Layout'

import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import GetAppIcon from '@mui/icons-material/GetApp'
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import GoogleCalendarScheduleFunction from './util'

function Home() {
  const context = useDocusaurusContext()
  const { siteConfig = {} } = context
  // @ts-expect-error
  const { currentVersion } = siteConfig.customFields

  return (
    // @ts-expect-error
    <Layout title={`${siteConfig.title}`}>
      <GoogleCalendarScheduleFunction />
      <Box sx={{ margin: { xs: '0.5em', sm: '0.5em', md: '3em' } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'column', md: 'row' },
            marginBottom: 6,
          }}
        >
          <Box sx={{ flex: '50%' }}>
            <Box>
              <Typography variant="h3" gutterBottom>
                JBrowse
              </Typography>
              <Typography variant="h4" gutterBottom>
                The next-generation genome browser
              </Typography>
              <Typography variant="body1">
                JBrowse is a new kind of genome browser that runs on the web, on
                your desktop, or embedded in your app.
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-evenly',
                gap: 1,
                margin: { xs: 0, sm: 0, md: 2 },
              }}
            >
              <Button
                variant="contained"
                startIcon={<GetAppIcon />}
                href="/jb2/download/"
                style={{ color: 'white' }}
              >
                Download
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<OpenInBrowserIcon />}
                href={`https://jbrowse.org/code/jb2/${currentVersion}/?session=share-HShsEcnq3i&password=nYzTU`}
                style={{ color: 'black' }}
              >
                Browse demo
              </Button>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography>
                Also check out our{' '}
                <a href="/jb2/blog">latest release blogpost</a>, our{' '}
                <a href="/jb2/docs/embedded_components/">embedded components</a>
                , and our{' '}
                <a href="/jb2/download/#jbrowse-cli-tools">
                  command line tools
                </a>
                .
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flex: '50%' }}>
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
              src="img/screenshot.webp"
            />
          </Box>
        </Box>
      </Box>
      <Box sx={{ margin: { xs: '0.5em', sm: '0.5em', md: '3em' } }}>
        <Box sx={{ marginBottom: 6 }}>
          <Typography variant="h4">Features</Typography>
          <hr />
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'column', md: 'row' },
              alignItems: 'flex-start',
            }}
          >
            <Box sx={{ flex: '50%' }}>
              <ul>
                <li>
                  Improved <b>structural variant</b> and{' '}
                  <b>comparative genomics visualization</b> with linear,
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
                  <a href="features">
                    See a summary of new features and a comparison to JBrowse 1
                  </a>
                </li>
              </ul>
            </Box>
            <Box sx={{ flex: '50%', paddingLeft: '20px' }}>
              <img
                style={{
                  border: '4px solid #e0e0e0',
                  borderRadius: '8px',
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
            </Box>
          </Box>
        </Box>

        <Box sx={{ marginBottom: 6 }}>
          <Typography variant="h4">Citation</Typography>
          <hr />
          <p>
            We at the JBrowse Consortium are working to make JBrowse a
            pluggable, open-source computational platform for integrating many
            kinds of biological data from many different places.
          </p>
          <p>
            Research citations are one of the main metrics the consortium uses
            to demonstrate our relevance and utility when applying for funding
            to continue our work. If you use JBrowse in research that you
            publish, please cite the most recent JBrowse paper:
          </p>
          <cite>
            JBrowse 2: a modular genome browser with views of synteny and
            structural variation. Genome Biology (2023).{' '}
            <a href="https://doi.org/10.1186/s13059-023-02914-z">
              https://doi.org/10.1186/s13059-023-02914-z
            </a>
          </cite>
        </Box>
        <Box sx={{ marginBottom: 6 }}>
          <Typography variant="h4">License</Typography>
          <hr />
          <Typography>
            JBrowse is released under the{' '}
            <a href="https://www.apache.org/licenses/LICENSE-2.0">
              Apache License, Version 2.0
            </a>
            .
          </Typography>
        </Box>
        <Box sx={{ marginBottom: 6 }}>
          <Typography variant="h4">Funding and Collaboration</Typography>
          <hr />
          <Typography variant="body1">
            JBrowse development is supported by the US National Institutes of
            Health (U41 HG003751), The Chan Zuckerberg Initiative, The Ontario
            Institute for Cancer Research (OICR), and the University of
            California, Berkeley.
          </Typography>
        </Box>
      </Box>
    </Layout>
  )
}

const theme = createTheme({
  palette: { secondary: { main: '#ccc' }, primary: { main: '#3f51b5' } },
})

export default () => {
  return (
    <ThemeProvider theme={theme}>
      <Home />
    </ThemeProvider>
  )
}
