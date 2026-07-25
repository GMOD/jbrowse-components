import { Typography } from '@mui/material'

/**
 * Why the pre-configured picker has nothing to offer for an assembly pair, and
 * what to do about it. Shared so the synteny and dotplot import forms give the
 * same diagnosis; `remedy` is the view's own way out, since the two forms reach
 * the uploader and Quick start differently.
 *
 * A same-assembly pair gets its own wording. It is a legal pair, but only a
 * track naming that assembly twice satisfies it, so the generic "nothing
 * connects these two" would read as a missing cross-species dataset and send the
 * user looking for the wrong file.
 */
export default function NoSyntenyTrackMessage({
  assembly1,
  assembly2,
  remedy,
}: {
  assembly1: string
  assembly2: string
  remedy: string
}) {
  return (
    <Typography color="text.secondary">
      {assembly1 === assembly2
        ? `Both sides of this pair use ${assembly1}, and no self-alignment synteny track references it twice. Pick a different assembly, or add a self-alignment track. `
        : `No pre-configured synteny track connects ${assembly1} and ${assembly2}. `}
      {remedy}
    </Typography>
  )
}
