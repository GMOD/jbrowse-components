export function getPort(output: string) {
  const portMatch = output.match(/localhost:([0-9]{4})/)
  const port = portMatch?.[1]
  if (!port) {
    throw new Error(`Port not found in "${JSON.stringify(output)}"`)
  }
  return port
}

export function getAdminKey(output: string) {
  const keyMatch = output.match(/adminKey=([a-zA-Z0-9]{10,12}) /)
  const key = keyMatch?.[1]
  if (!key) {
    throw new Error(`Admin key not found in "${output}"`)
  }
  return key
}

export async function killExpress({ stdout }: { stdout: string }) {
  // if (!stdout || typeof stdout !== 'string') {
  //   // This test didn't start a server
  //   return
  // }
  return fetch(`http://localhost:${getPort(stdout)}/shutdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey: getAdminKey(stdout) }),
  })
}
