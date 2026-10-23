function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function randomUrlSafe(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return bytesToBase64Url(new Uint8Array(digest))
}

export function readOAuthCode(responseUrl: string, expectedState: string): string {
  const url = new URL(responseUrl)
  const error = url.searchParams.get('error')
  if (error) {
    const description = url.searchParams.get('error_description')
    throw new Error(description && description.length > 0 ? description : error)
  }
  const state = url.searchParams.get('state')
  if (state !== expectedState) {
    throw new Error('The sign-in response did not match the request that started it.')
  }
  const code = url.searchParams.get('code')
  if (!code) throw new Error('The sign-in response did not include an authorization code.')
  return code
}
