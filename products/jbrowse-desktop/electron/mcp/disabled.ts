/**
 * Whether JBROWSE_DISABLE_MCP turns the endpoint off. Any value does, except
 * the ones that read as "no": unset, empty, `0` and `false`.
 */
export function mcpDisabled(value = process.env.JBROWSE_DISABLE_MCP) {
  return (
    value !== undefined &&
    !['', '0', 'false'].includes(value.trim().toLowerCase())
  )
}
