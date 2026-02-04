export function initAuthWindow() {
  if (window.name.startsWith('JBrowseAuthWindow')) {
    const parent = window.opener
    if (parent) {
      parent.postMessage({
        name: window.name,
        redirectUri: window.location.href,
      })
    }
    window.close()
  }
}
