export function navigateToSession(configPath: string) {
  window.location.hash = `#/session?config=${encodeURIComponent(configPath)}`
}

export function navigateToStartScreen() {
  window.location.hash = '#/'
}
