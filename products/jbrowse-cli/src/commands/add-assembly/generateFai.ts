import fs from 'node:fs'
import { Readable, Writable } from 'node:stream'

import { generateFastaIndex } from '@gmod/faidx'

export interface FaiToGenerate {
  fasta: string
  fai: string
}

export async function generateFai({
  fasta,
  fai,
  force,
}: FaiToGenerate & { force?: boolean }) {
  const handle = await fs.promises.open(fai, force ? 'w' : 'wx')
  try {
    await generateFastaIndex(
      Writable.toWeb(handle.createWriteStream()),
      Readable.toWeb(fs.createReadStream(fasta)),
    )
  } catch (e) {
    await handle.close()
    await fs.promises.rm(fai, { force: true })
    throw e
  }
}
