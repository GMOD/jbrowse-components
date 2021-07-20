#!/usr/bin/env node
import fs from 'fs'
import { Track } from './types'
import { convertTrackConfig } from './index'

const [
  file,
  outFile = 'config.json',
  dataRoot = 'http://localhost/',
] = process.argv.slice(2)

if (!file) {
  console.log('usage: jb1tojb2 trackList.json [config.json] [dataRoot]')
  console.log(
    ' where trackList.json is inputted jbrowse 1 configuration JSON, config.json is the outputted jbrowse 2 config.json, and dataRoot is an optional relative URL prefix',
  )
  process.exit()
}

const jb1config: { tracks: Track[] } = JSON.parse(fs.readFileSync(file, 'utf8'))
const tracks = jb1config.tracks.map(track =>
  convertTrackConfig(track, dataRoot, {
    type: 'IndexedFastaAdapter',
  }),
)

console.log({ tracks })

fs.writeFileSync(outFile, JSON.stringify(tracks, null, 2))
