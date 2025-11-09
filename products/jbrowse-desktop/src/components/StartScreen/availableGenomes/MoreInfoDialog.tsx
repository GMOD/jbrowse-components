import { Dialog } from '@jbrowse/core/ui'
import { DialogContent, DialogContentText, Link } from '@mui/material'

export default function MoreInfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog maxWidth="md" onClose={onClose} title="More info" open>
      <DialogContent>
        <DialogContentText>
          This resource was created using data from UCSC, NCBI, and other
          resources. Please see{' '}
          <Link href="https://genomes.jbrowse.org/about">
            https://genomes.jbrowse.org/about
          </Link>{' '}
          for more info
        </DialogContentText>
      </DialogContent>
    </Dialog>
  )
}
