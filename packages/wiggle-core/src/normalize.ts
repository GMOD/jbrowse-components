export {
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG,
  makeScoreNormalizer,
} from '@jbrowse/render-core/scoreScale'

/**
 * #api
 * The symlog constant actually used for a domain. `0` (the config default)
 * means "pick one from the domain": a thousandth of its largest magnitude, so
 * the log-ish part of the curve covers the top three decades of whatever the
 * track holds and the linear knee sits below the data rather than through it.
 *
 * The alternative — d3's default of 1 — is `log(x + 1)`, which is fine for read
 * depth and useless for anything living below 1, because the entire domain then
 * falls in the linear part of the curve. A p-value track configured that way is
 * just a linear track wearing a log label, which is the reason this is resolved
 * rather than hard-coded.
 */
export function resolveSymlogConstant(
  min: number,
  max: number,
  configured: number,
): number {
  if (configured > 0) {
    return configured
  }
  const magnitude = Math.max(Math.abs(min), Math.abs(max))
  return magnitude > 0 ? magnitude / 1000 : 1
}
