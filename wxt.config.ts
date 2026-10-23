import { defineConfig } from 'wxt'

/**
 * Public key so the extension id, and therefore the OAuth redirect URI,
 * stays stable between local installs. The Chrome Web Store replaces this
 * key on publish; copy the store redirect URI into each provider app after that.
 */
const extensionKey =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwweHTjpd22seQ7oCzm9MibDPm+O0Ul3PGAXzYUHp5FuTcplDW3lBB0Wc0S4boUhnm/FEI6tQUpqBbi4yNcLiU4snPfKu7PGfoWmdvnkqTIDI6rCvHkNxh8f7O2VABRuVpbhgTuh8ExH21oyYKYUTavEtvFc9wPPkLqIJS84EbjZX/XwcMu0F25OKgwXErd+iu0VbnbM6WkS9EvinIzFd2bOqLBy2IEHOMaTfWYDANigDjA6zyXWg6zTM0dUSZTJdL/4P7/Yu6O0etClBLl6zjdNMR3CZfO1ay+IWdR4bJnkjbYFqO0tA0C+FO+bAeBEzb7F3YVuh4l0PkSiJkMQ/lQIDAQAB'

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Emoji',
    description:
      'Use custom emoji from Slack, Discord, and Teams on the websites you choose.',
    key: extensionKey,
    permissions: ['storage', 'identity', 'alarms'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Emoji',
    },
  },
})
