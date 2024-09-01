import React from 'react'
import pluginStyles from './styles.module.css'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardActions from '@mui/material/CardActions'
import CardMedia from '@mui/material/CardMedia'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'

import Person from '@mui/icons-material/Person'
import AccountBalance from '@mui/icons-material/AccountBalance'
import GitHub from '@mui/icons-material/GitHub'
import Book from '@mui/icons-material/Book'
import Outbound from '@mui/icons-material/Outbound'

const plugins = [
  {
    name: 'GDC',
    authors: ['Garrett Stevens', 'Colin Diesh', 'Rob Buels', 'Caroline Bridge'],
    description:
      "JBrowse 2 plugin for integrating resources from NCI's Genomic Data Commons (GDC).",
    location: 'https://github.com/GMOD/jbrowse-plugin-gdc',
    repoName: 'jbrowse-plugin-gdc',
    url: 'https://unpkg.com/jbrowse-plugin-gdc/dist/jbrowse-plugin-gdc.umd.production.min.js',
    license: 'MIT',
    image:
      'https://raw.githubusercontent.com/GMOD/jbrowse-plugin-list/main/img/gdc-screenshot-fs8.png',
    guideURL: '/jb2/docs/tutorials/plugin_usage/#gdc-plugin',
    resourceURL: 'https://portal.gdc.cancer.gov/',
  },
  {
    name: 'ICGC',
    authors: ['Caroline Bridge'],
    description:
      'JBrowse 2 plugin for integrating resources from the International Cancer Genome Consortium (ICGC).',
    location: 'https://github.com/GMOD/jbrowse-plugin-icgc',
    repoName: 'jbrowse-plugin-icgc',
    url: 'https://unpkg.com/jbrowse-plugin-icgc/dist/jbrowse-plugin-icgc.umd.production.min.js',
    license: 'Apache License 2.0',
    image:
      'https://raw.githubusercontent.com/GMOD/jbrowse-plugin-list/main/img/icgc-screenshot-fs8.png',
    guideURL: '/jb2/docs/tutorials/plugin_usage/#icgc-plugin',
    resourceURL: 'https://dcc.icgc.org/',
  },
  {
    name: 'UCSC',
    authors: ['Colin Diesh'],
    description:
      'JBrowse 2 plugin for integrating resources from the UCSC API.',
    location: 'https://github.com/cmdcolin/jbrowse-plugin-ucsc-api',
    repoName: 'jbrowse-plugin-usc-api',
    url: 'https://unpkg.com/jbrowse-plugin-ucsc/dist/jbrowse-plugin-ucsc.umd.production.min.js',
    license: 'MIT',
    image:
      'https://raw.githubusercontent.com/GMOD/jbrowse-plugin-list/main/img/ucsc-screenshot-fs8.png',
    guideURL: '/jb2/docs/tutorials/plugin_usage/#ucsc-plugin',
    resourceURL: 'https://genome.ucsc.edu/',
  },
  {
    name: 'Biothings',
    authors: ['Colin Diesh'],
    description:
      "JBrowse 2 plugin for adapting the API's from mygene.info and myvariant.info to get super rich gene annotations.",
    location: 'https://github.com/cmdcolin/jbrowse-plugin-biothings-api',
    repoName: 'jbrowse-plugin-biothings-api',
    url: 'https://unpkg.com/jbrowse-plugin-biothings/dist/jbrowse-plugin-biothings.umd.production.min.js',
    license: 'MIT',
    image:
      'https://raw.githubusercontent.com/GMOD/jbrowse-plugin-list/main/img/biothings-screenshot-fs8.png',
    guideURL: '/jb2/docs/tutorials/plugin_usage/#biothings-plugin',
    resourceURL: 'https://biothings.io/',
  },
  {
    name: 'CIVIC',
    authors: ['Colin Diesh'],
    description:
      'JBrowse 2 plugin for fetching data from the CIVIC clinical interpretation of cancer variants.',
    location: 'https://github.com/cmdcolin/jbrowse-plugin-civic-api',
    repoName: 'jbrowse-plugin-civic-api',
    url: 'https://unpkg.com/jbrowse-plugin-civic/dist/jbrowse-plugin-civic.umd.production.min.js',
    license: 'Apache License 2.0',
    image:
      'https://raw.githubusercontent.com/GMOD/jbrowse-plugin-list/main/img/civic-screenshot-fs8.png',
    guideURL: '/jb2/docs/tutorials/plugin_usage/#civic-plugin',
    resourceURL: 'https://civicdb.org/welcome',
  },
]

export const PluginCard = ({ plugin }) => {
  return (
    <Card variant="outlined" key={plugin.name} className={pluginStyles.card}>
      {plugin.image ? (
        <CardMedia
          className={pluginStyles.cardMedia}
          image={plugin.image}
          title={plugin.name}
        />
      ) : null}
      <CardContent>
        <div className={pluginStyles.dataField}>
          <Typography variant="h4">{plugin.name}</Typography>
        </div>
        <div className={pluginStyles.dataField}>
          <Person style={{ marginRight: '0.5em' }} />
          <Typography>{plugin.authors.join(', ')}</Typography>
          <AccountBalance className={pluginStyles.icon} />
          <Typography>
            {plugin.license === 'NONE' ? 'No license' : plugin.license}
          </Typography>
        </div>
        <div className={pluginStyles.dataField}>
          <GitHub style={{ marginRight: '0.5em' }} />
          <Link href={plugin.location} target="_blank" rel="noopener">
            {plugin.repoName}
          </Link>
          <Outbound className={pluginStyles.icon} />
          <Link href={plugin.resourceURL} target="_blank" rel="noopener">
            {plugin.name} website
          </Link>
        </div>
        <Typography variant="h6">Description:</Typography>
        <Typography>{plugin.description}</Typography>
      </CardContent>
      <CardActions style={{ justifyContent: 'center', alignSelf: 'end' }}>
        <Button
          style={{ marginLeft: '1em', backgroundColor: '#721e63' }}
          color="primary"
          variant="contained"
          disableRipple
          size="small"
          endIcon={<Book />}
        >
          <Link
            style={{ color: 'white', textDecorationColor: 'white' }}
            href={plugin.guideURL}
            target="_blank"
          >
            {plugin.name} Plugin Usage Guide
          </Link>
        </Button>
      </CardActions>
    </Card>
  )
}

export default function MiniPlugins() {
  return (
    <div style={{ flexBasis: '50%' }}>
      <div className="container">
        <div className="row">
          {plugins.map((plugin, idx) => (
            <PluginCard plugin={plugin} key={idx} />
          ))}
        </div>
      </div>
    </div>
  )
}
