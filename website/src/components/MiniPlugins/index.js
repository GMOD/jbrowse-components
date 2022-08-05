import React from 'react'
import pluginStyles from './styles.module.css'
import pluginJSON from '../../../static/plugins.json'
const { plugins } = pluginJSON

import {
  Link,
  Typography,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Button,
} from '@mui/material'

import {
  Person,
  AccountBalance,
  GitHub,
  Book,
  Outbound,
} from '@mui/icons-material'

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
            <Typography>{plugin.repoName}</Typography>
          </Link>
          <Outbound className={pluginStyles.icon} />
          <Link href={plugin.resourceURL} target="_blank" rel="noopener">
            <Typography>{plugin.name} website</Typography>
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
