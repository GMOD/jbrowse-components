export default function getPublicUrlOrPath(isEnvDevelopment, homepage, envPublicUrl) {
  const url = envPublicUrl || homepage || '/'
  if (isEnvDevelopment && url.startsWith('.')) {
    return '/'
  }
  return url.endsWith('/') ? url : url + '/'
}
