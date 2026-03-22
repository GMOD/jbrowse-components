#!/usr/bin/env node
/**
 * Lightweight webhook receiver for RL analytics data.
 *
 * Usage: node webhook_receiver.mjs [port] [output_file]
 *   port:        HTTP port (default: 8081)
 *   output_file: JSONL output path (default: rl_analytics_data.jsonl)
 *
 * Endpoints:
 *   POST /ingest  — receives {steps: [...]} from WebhookExporter
 *   GET  /status  — returns collection stats
 *   GET  /episodes — returns episode summary
 */

import { createServer } from 'node:http'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'

const port = parseInt(process.argv[2] || '8081', 10)
const outputFile = process.argv[3] || 'rl_analytics_data.jsonl'

let totalSteps = 0
let lastTimestamp = null
const episodeCounts = new Map()

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'POST' && req.url === '/ingest') {
    try {
      const body = JSON.parse(await readBody(req))
      const steps = body.steps || []
      for (const step of steps) {
        appendFileSync(outputFile, JSON.stringify(step) + '\n')
        totalSteps++
        lastTimestamp = step.timestamp || Date.now()
        const epId = step.episode_id || 'unknown'
        episodeCounts.set(epId, (episodeCounts.get(epId) || 0) + 1)
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, received: steps.length }))
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      totalSteps,
      totalEpisodes: episodeCounts.size,
      lastTimestamp,
      outputFile,
      fileExists: existsSync(outputFile),
    }))
    return
  }

  if (req.method === 'GET' && req.url === '/episodes') {
    const episodes = Object.fromEntries(episodeCounts)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ episodes, count: episodeCounts.size }))
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(port, () => {
  console.log(`RL Analytics webhook receiver listening on http://localhost:${port}`)
  console.log(`  POST /ingest  — receive step data`)
  console.log(`  GET  /status  — collection stats`)
  console.log(`  GET  /episodes — episode summary`)
  console.log(`  Output: ${outputFile}`)
})
