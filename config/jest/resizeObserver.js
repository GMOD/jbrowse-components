global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Disable workspaces (dockview) in tests
if (typeof localStorage !== 'undefined') {
  localStorage.setItem('useWorkspaces', 'false')
}
