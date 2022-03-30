import React from 'react'
import Layout from '@theme/Layout'

import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import {
  Link,
  ThemeProvider,
  Typography,
  Button,
  Box,
  createTheme,
} from '@mui/material'
import GetAppIcon from '@mui/icons-material/GetApp'
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser'

function Home() {
  const context = useDocusaurusContext()
  const { siteConfig = {} } = context
  const { currentVersion, bannerBulletin } = siteConfig.customFields

  return (
    <Layout title={`${siteConfig.title}`}>
      <Box sx={{ margin: { xs: '0.5em', sm: '0.5em', md: '3em' } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'column', md: 'row' },
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <Box sx={{ flex: '50%' }}>
            <Box sx={{ marginLeft: { xs: 0, sm: 0, md: 4 }, margin: 2 }}>
              <Typography variant="h5">
                JBrowse: The next generation genome browser
              </Typography>
              <Typography variant="body1">
                The mission of the JBrowse Consortium is to develop a
                comprehensive, pluggable, open-source computational platform for
                visualizing and integrating biological data.
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
                href="/jb2/download/#jbrowse-2-desktop"
                sx={{
                  fontSize: { xs: 'x-small', sm: 'x-small', md: 'small' },
                }}
                style={{ color: 'white' }}
              >
                Download JBrowse Desktop
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<OpenInBrowserIcon />}
                href={`https://jbrowse.org/code/jb2/${currentVersion}/?session=share-HShsEcnq3i&password=nYzTU`}
                sx={{
                  fontSize: { xs: 'x-small', sm: 'x-small', md: 'small' },
                }}
                style={{ color: 'black' }}
              >
                Browse web demo instance
              </Button>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption">
                Also check out our{' '}
                <Link href="/jb2/blog">latest release blogpost</Link>, our{' '}
                <Link href="/jb2/download/#embedded-components">
                  embedded components
                </Link>
                , and our{' '}
                <Link href="/jb2/download/#jbrowse-cli-tools">
                  command line tools
                </Link>
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
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-around',
          backgroundColor: '#F0F0F0',
          padding: '25px',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 'bold',
            fontSize: { xs: 'medium', sm: 'medium', md: 'x-large' },
          }}
        >
          {bannerBulletin}
        </Typography>
        <Button
          variant="contained"
          href={`https://github.com/GMOD/jbrowse-components/releases/tag/${currentVersion}/`}
          sx={{
            fontSize: { xs: 'x-small', sm: 'x-small', md: 'small' },
            maxWidth: { xs: 'min-content', sm: 'min-content', md: 'inherit' },
          }}
          style={{ color: 'white' }}
        >
          Learn more
        </Button>
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
          <Typography variant="body1">
            Research citations are one of the main metrics the JBrowse project
            uses to demonstrate our relevance and utility when applying for
            funding to continue our work. If you use JBrowse in research that
            you publish, please cite the most recent JBrowse paper:
          </Typography>
          <br />
          <Typography variant="body1">
            Buels, Robert, et al. &quot;JBrowse: a dynamic web platform for
            genome visualization and analysis.&quot; Genome Biology 17.1 (2016):
            66.
          </Typography>
        </Box>
        <Box sx={{ marginBottom: 6 }}>
          <Typography variant="h4">License</Typography>
          <hr />
          <Typography>
            JBrowse is released under the{' '}
            <Link href="https://www.apache.org/licenses/LICENSE-2.0">
              Apache License, Version 2.0
            </Link>
            .
          </Typography>
        </Box>
        <Box sx={{ marginBottom: 6 }}>
          <Typography variant="h4">Funding and Collaboration</Typography>
          <hr />
          <Typography variant="body1">
            JBrowse development is supported by the US National Institutes of
            Health (U41 HG003751), The Chan Zuckerberg Initiative, The Ontario
            Institute for Cancer Research, and the University of California,
            Berkeley.
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
