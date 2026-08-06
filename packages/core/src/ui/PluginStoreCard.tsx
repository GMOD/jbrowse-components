import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import PersonIcon from '@mui/icons-material/Person'
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Typography,
} from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'
import ExternalLink from './ExternalLink.tsx'

import type { PluginDefinition } from '../pluginDefinitions.ts'
import type { ResolvedPlugin } from '../util/pluginStore.ts'
import type { JBrowsePlugin } from '../util/types/index.ts'

const useStyles = makeStyles()({
  card: {
    margin: '0.5em',
  },
  bold: {
    fontWeight: 600,
  },
  dataField: {
    display: 'flex',
    alignItems: 'center',
  },
  mr: {
    marginRight: '0.5em',
  },
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.3em',
    marginTop: '0.5em',
  },
})

/**
 * One plugin-store entry. Presentational, and shared by every surface that
 * installs from the store (the in-session plugin store widget, Desktop's global
 * plugins dialog) so all of them install the version `resolvePlugin` picked —
 * version-pinned, integrity-carrying, and refused when no published version
 * supports this JBrowse.
 */
export default function PluginStoreCard({
  plugin,
  resolved,
  installed,
  disabled,
  onInstall,
}: {
  plugin: JBrowsePlugin
  resolved: ResolvedPlugin
  installed: boolean
  disabled?: boolean
  onInstall: (definition: PluginDefinition) => void
}) {
  const { classes } = useStyles()
  const { definition, compatible, supportedRanges, pluginVersion } = resolved
  const installable = compatible && definition !== undefined
  return (
    <Card variant="outlined" className={classes.card}>
      <CardContent>
        <Typography variant="h5">
          <ExternalLink href={`${plugin.location}#readme`}>
            {plugin.name}
            {pluginVersion ? ` (v${pluginVersion})` : ''}
          </ExternalLink>
        </Typography>
        <div className={classes.dataField}>
          <PersonIcon className={classes.mr} />
          <Typography>{plugin.authors.join(', ')}</Typography>
        </div>
        <Typography className={classes.bold}>Description:</Typography>
        <Typography>{plugin.description}</Typography>
        {plugin.tags?.length ? (
          <div className={classes.tagRow}>
            {plugin.tags.map(tag => (
              <Chip key={tag} label={tag} size="small" variant="outlined" />
            ))}
          </div>
        ) : null}
        {compatible ? null : (
          <Typography color="error">
            Not compatible with this version of JBrowse (requires JBrowse{' '}
            {supportedRanges.join(' or ')})
          </Typography>
        )}
      </CardContent>
      <CardActions>
        <Button
          variant="contained"
          disabled={installed || disabled || !installable}
          startIcon={installed ? <CheckIcon /> : <AddIcon />}
          onClick={() => {
            if (definition !== undefined) {
              onInstall(definition)
            }
          }}
        >
          {installed ? 'Installed' : 'Install'}
        </Button>
      </CardActions>
    </Card>
  )
}
