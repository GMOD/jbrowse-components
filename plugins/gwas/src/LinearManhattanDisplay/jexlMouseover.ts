import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

function toP(s = 0) {
  return +s.toPrecision(6)
}

const en = (n: number) => n.toLocaleString('en-US')

function getTooltip(feature: Feature) {
  const start = feature.get('start') + 1
  const end = feature.get('end')
  const refName = feature.get('refName')
  const name = feature.get('name')
  const rsid = feature.get('rsid')
  const loc = [refName, start === end ? en(start) : `${en(start)}..${en(end)}`]
    .filter(f => !!f)
    .join(':')

  const nameOrId = name || rsid
  return `${loc}<br/>${toP(feature.get('score'))}${nameOrId ? `<br/>${nameOrId}` : ''}`
}

export default function JexlMouseoverF(pluginManager: PluginManager) {
  pluginManager.jexl.addFunction('getTooltip', (feature: Feature) =>
    getTooltip(feature),
  )
}
