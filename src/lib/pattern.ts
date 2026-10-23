/**
 * Match a page URL against a glob. A leading scheme is optional.
 * `*` matches every character, including `/`.
 */
export function matchUrlPattern(pattern: string, url: string): boolean {
  const trimmed = pattern.trim()
  if (trimmed.length === 0) return false
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `*://${trimmed.replace(/^\/\//, '')}`
  const escaped = withScheme.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')
  return new RegExp(`^${escaped}$`, 'i').test(url)
}
