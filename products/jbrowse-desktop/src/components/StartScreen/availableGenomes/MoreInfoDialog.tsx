import { InfoDialog } from '@jbrowse/core/ui'
import { DialogContentText, Link } from '@mui/material'

export default function MoreInfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <InfoDialog maxWidth="md" onClose={onClose} title="More info" open>
      <DialogContentText>
        This resource was created using data from UCSC, NCBI, and other
        resources. Please see{' '}
        <Link href="https://genomes.jbrowse.org/about">
          https://genomes.jbrowse.org/about
        </Link>{' '}
        for more info
      </DialogContentText>
    </InfoDialog>
  )
}
