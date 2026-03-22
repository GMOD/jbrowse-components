#!/usr/bin/env node
/**
 * Generate a parasitic JBrowse config that injects the RL analytics plugin.
 *
 * Usage:
 *   node generate_parasitic_config.mjs <source_url> <plugin_url> [webhook_url]
 *
 * Example:
 *   node generate_parasitic_config.mjs \
 *     https://jbrowse.org/code/jb2/main \
 *     https://myserver.com/jbrowse-plugin-rl-analytics.umd.js \
 *     http://localhost:8081/ingest \
 *     > parasitic_config.json
 */

const sourceUrl = process.argv[2]
const pluginUrl = process.argv[3]
const webhookUrl = process.argv[4] || ''

if (!sourceUrl || !pluginUrl) {
  console.error('Usage: generate_parasitic_config.mjs <source_url> <plugin_url> [webhook_url]')
  console.error('')
  console.error('Arguments:')
  console.error('  source_url   Base URL of the JBrowse instance (e.g. https://jbrowse.org/code/jb2/main)')
  console.error('  plugin_url   URL where the RL analytics UMD bundle is hosted')
  console.error('  webhook_url  Optional webhook URL for real-time data collection')
  process.exit(1)
}

async function main() {
  // 1. Fetch the source config
  const configUrl = sourceUrl.replace(/\/$/, '') + '/config.json'
  console.error(`Fetching config from ${configUrl}...`)
  const response = await fetch(configUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`)
  }
  const config = await response.json()

  // 2. Resolve relative URIs to absolute
  const resolved = resolveRelativeUris(config, sourceUrl.replace(/\/$/, ''))

  // 3. Inject the RL analytics plugin
  const plugins = resolved.plugins || []
  plugins.push({
    name: 'RLAnalyticsPlugin',
    umdUrl: pluginUrl,
  })
  resolved.plugins = plugins

  // 4. Add plugin configuration if webhook URL provided
  if (webhookUrl) {
    resolved.configuration = resolved.configuration || {}
    resolved.configuration.RLAnalyticsPlugin = {
      ...(resolved.configuration.RLAnalyticsPlugin || {}),
      enabled: true,
      webhookUrl,
    }
  }

  // 5. Output the modified config
  console.log(JSON.stringify(resolved, null, 2))
  console.error('Done. Parasitic config written to stdout.')
}

/**
 * Deep-walk a config object and resolve all relative URIs to absolute.
 */
function resolveRelativeUris(obj, baseUrl) {
  if (obj === null || obj === undefined) {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(item => resolveRelativeUris(item, baseUrl))
  }
  if (typeof obj === 'object') {
    const result = {}
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'uri' && typeof value === 'string' && !isAbsoluteUrl(value)) {
        // Resolve relative URI
        result[key] = new URL(value, baseUrl + '/').toString()
      } else if (key === 'localPath') {
        // localPath won't work remotely — convert to URI if possible
        console.error(`Warning: localPath "${value}" found — skipping (won't work remotely)`)
        result[key] = value
      } else {
        result[key] = resolveRelativeUris(value, baseUrl)
      }
    }
    return result
  }
  return obj
}

function isAbsoluteUrl(url) {
  return /^https?:\/\//i.test(url) || /^data:/i.test(url) || /^blob:/i.test(url)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
