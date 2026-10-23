/** Hosts whose built-in colon menu should yield when Emoji's keyboard is open. */
export function hostOverridesNativePicker(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '')
  return (
    host === 'github.com' ||
    host.endsWith('.github.com') ||
    host === 'linear.app' ||
    host.endsWith('.linear.app')
  )
}

export const FOREIGN_MENU_SELECTOR = [
  'text-expander ul',
  'ul.emoji-suggestions',
  '[data-emoji-foreign-menu]',
  '[aria-label="Emoji suggestions"]',
  '[aria-label="Emoji picker"]',
].join(', ')

export function foreignListboxSelector(hostname: string): string {
  if (!hostOverridesNativePicker(hostname)) return FOREIGN_MENU_SELECTOR
  return `${FOREIGN_MENU_SELECTOR}, [role="listbox"]`
}
