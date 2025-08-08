import { Dialog } from '@jbrowse/core/ui'
import { DialogContent } from '@mui/material'

import GenomesDataTable from './GenomesDataTable'

import type { Fav, LaunchCallback } from '../types'

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
  return (
    <Dialog maxWidth="xl" open title="Available genomes" onClose={onClose}>
      <DialogContent>
        <GenomesDataTable
          favorites={favorites}
          setFavorites={setFavorites}
          onClose={onClose}
          launch={launch}
        />
      </DialogContent>
    </Dialog>
  )
}
