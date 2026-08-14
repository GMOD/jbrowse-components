import { lazy } from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { getSession, installablePlugins, isElectron } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useFetchPlugins } from '@jbrowse/core/util/useFetchPlugins'
import { getEnv } from '@jbrowse/mobx-state-tree'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import {
  Accordion,
  AccordionSummary,
  Button,
  Chip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import ClearableSearchField from '../../shared/ClearableSearchField.tsx'
import InstalledPluginsList from './InstalledPluginsList.tsx'
import PluginCard from './PluginCard.tsx'

import type { PluginStoreModel } from '../model.ts'

// lazies
const AddCustomPluginDialog = lazy(() => import('./AddCustomPluginDialog.tsx'))

const useStyles = makeStyles()(theme => ({
  expandIcon: {
    color: theme.palette.tertiary.contrastText,
  },
  adminBadge: {
    borderRadius: 3,
    backgroundColor: theme.palette.quaternary.main,
    padding: '1em',
    display: 'flex',
    alignContent: 'center',
  },
  customPluginButton: {
    margin: '1em auto',
    display: 'flex',
  },
  mr: {
    marginRight: '0.3em',
  },
  m: {
    margin: '1em',
  },
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.3em',
    margin: '0.5em 0',
  },
  noMatches: {
    margin: '1em',
  },
}))

const PluginStoreWidget = observer(function PluginStoreWidget({
  model,
}: {
  model: PluginStoreModel
}) {
  const { classes } = useStyles()
  const { plugins, error } = useFetchPlugins()
  const { filterText, selectedTags } = model
  const session = getSession(model)
  const { adminMode } = session
  const { pluginManager } = getEnv(model)

  const textMatched = installablePlugins(plugins ?? [], isElectron).filter(
    plugin => plugin.name.toLowerCase().includes(filterText.toLowerCase()),
  )
  // Offer a tag if something surviving the text filter carries it, plus any tag
  // already selected — otherwise the last chip in a narrow result set vanishes
  // out from under the click that would have cleared it.
  const availableTags = [
    ...new Set([...textMatched.flatMap(p => p.tags ?? []), ...selectedTags]),
  ].sort()
  // AND, not OR: each tag added narrows the list, which is what makes combining
  // a setup tag with a topic tag ("plug-and-play" + "alignment") useful.
  const shown = textMatched.filter(plugin => {
    const tags = new Set(plugin.tags ?? [])
    return [...selectedTags].every(tag => tags.has(tag))
  })

  return (
    <div>
      {adminMode && (
        <>
          {!isElectron && (
            <div className={classes.adminBadge}>
              <InfoOutlinedIcon className={classes.mr} />
              <Typography>
                You are using the <code>admin-server</code>. Any changes you
                make will be saved to your configuration file. You also have the
                ability to add custom plugins that are not in the store.
              </Typography>
            </div>
          )}
          <Button
            className={classes.customPluginButton}
            variant="contained"
            onClick={() => {
              session.queueDialog(onClose => [
                AddCustomPluginDialog,
                {
                  model,
                  onClose,
                },
              ])
            }}
          >
            Add custom plugin
          </Button>
        </>
      )}
      <ClearableSearchField
        fullWidth
        label="Filter plugins"
        value={filterText}
        onChange={text => {
          model.setFilterText(text)
        }}
      />
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Installed plugins</Typography>
        </AccordionSummary>
        <div className={classes.m}>
          <InstalledPluginsList
            pluginManager={pluginManager}
            model={model}
            storePlugins={plugins}
          />
        </div>
      </Accordion>
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography variant="h5">Available plugins</Typography>
        </AccordionSummary>
        {error ? (
          <ErrorMessage error={error} />
        ) : plugins ? (
          <>
            {availableTags.length > 0 && (
              <div className={classes.tagRow}>
                {availableTags.map(tag => (
                  <Chip
                    key={tag}
                    data-testid={`tagFilter-${tag}`}
                    label={tag}
                    size="small"
                    color={selectedTags.has(tag) ? 'primary' : 'default'}
                    variant={selectedTags.has(tag) ? 'filled' : 'outlined'}
                    onClick={() => {
                      model.toggleTagFilter(tag)
                    }}
                  />
                ))}
                {selectedTags.size > 0 && (
                  <Button
                    size="small"
                    onClick={() => {
                      model.clearTagFilters()
                    }}
                  >
                    Clear tags
                  </Button>
                )}
              </div>
            )}
            {shown.length > 0 ? (
              shown.map(plugin => (
                <PluginCard key={plugin.name} plugin={plugin} model={model} />
              ))
            ) : (
              <Typography className={classes.noMatches}>
                {selectedTags.size > 0 || filterText
                  ? 'No plugins match these filters.'
                  : 'No plugins available.'}
              </Typography>
            )}
          </>
        ) : (
          <LoadingEllipses />
        )}
      </Accordion>
    </div>
  )
})

export default PluginStoreWidget
