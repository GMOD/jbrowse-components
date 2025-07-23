import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { DialogContent, Tab, Tabs } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import GenArkDataTable from './GenArkDataTable'
import MainGenomesDialogPanel from './MainGenomesDialogPanel'
import TabPanel from './TabPanel'

import type { Fav, LaunchCallback } from '../types'

const useStyles = makeStyles()({
  mb: {
    marginBottom: 5,
  },
})

export default function AllGenomesDialog({
  favorites,
  setFavorites,
  onClose,
  launch,
}: {
  onClose: () => void
  favorites: Fav[]
  setFavorites: (arg: Fav[]) => void
  launch: LaunchCallback
}) {
  const [tabValue, setTabValue] = useState(0)
  const { classes } = useStyles()

  return (
    <Dialog maxWidth="xl" open title="All available genomes" onClose={onClose}>
      <DialogContent>
        <Tabs
          className={classes.mb}
          aria-label="genome source tabs"
          value={tabValue}
          onChange={(_, newValue) => {
            setTabValue(newValue)
          }}
        >
          <Tab label="Main Genome Browsers" />
          <Tab label="UCSC GenArk" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <MainGenomesDialogPanel
            favorites={favorites}
            setFavorites={setFavorites}
            onClose={onClose}
            launch={launch}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <GenArkDataTable
            favorites={favorites}
            setFavorites={setFavorites}
            onClose={onClose}
            launch={launch}
          />
        </TabPanel>
      </DialogContent>
    </Dialog>
  )
}
