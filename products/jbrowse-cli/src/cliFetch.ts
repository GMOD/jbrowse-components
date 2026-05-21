// Wrapper around fetch that allows tests to mock API calls. All modules in
// jbrowse-cli must use this instead of the global fetch function. See
// CLAUDE.md for details.
export default function cliFetch(
  url: string | URL,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(url, options)
}
