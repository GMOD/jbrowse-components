import RedErrorMessageBox from './RedErrorMessageBox.tsx'

export default function ErrorMessage({ error }: { error: unknown }) {
  return <RedErrorMessageBox>{`${error}`}</RedErrorMessageBox>
}
