export default function getPublicUrlOrPath(
  isEnvDevelopment: boolean,
  homepage: string | undefined,
  envPublicUrl: string | undefined,
) {
  const url = envPublicUrl || homepage || '/'
  if (isEnvDevelopment && url.startsWith('.')) {
    return '/'
  }
  return url.endsWith('/') ? url : `${url}/`
}
