export default async function factoryReset() {
  // @ts-expect-error
  window.location = window.location.pathname
}
