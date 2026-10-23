# Emoji — where this stopped, and how to pick it up

This is a WXT browser extension. It is not usable yet. The library modules under `src/lib` are a draft of the data model and a few pure helpers. Nothing renders on a page, nothing connects to Slack, and there is no options UI. `src/entrypoints/background.ts` exists only so the project can install.

Stop here on purpose. The next slice needs a couple of decisions, and one Slack experiment, before more UI.

## What the product is

People install the extension and connect the places their custom emoji already live: any number of Slack workspaces, and later Discord servers and Teams tenants. They point each source at URL patterns, such as `https://github.com/acme/*`.

On a matched page, `:emoji_name:` is drawn inline at the size of the surrounding text, including inside a heading. Finishing the shortcode while typing does the same thing in the composer. Coworkers who install the extension and connect the same workspace see the same images. People who do not install it still see the shortcode.

The stored text for a custom emoji stays `:name:`. The extension is the renderer. That is what makes one Slack workspace show up for a whole GitHub org without pasting images into GitHub.

## Decisions that are already made

- One Slack app, not one app per workspace. Each workspace is an install of that app. Each person signs in and gets their own user token. An admin approves the app once if that workspace requires approval.
- The only Slack scope is the user scope `emoji:read`. No bot, no channels, no permission to post. `emoji.list` returns the workspace map, including `.gif` for animated emoji and `alias:other-name` for aliases. A test on 2 October 2026 showed the whole set in one response. Follow `response_metadata.next_cursor` if Slack ever sends one.
- Do not scrape the logged-in Slack tab. `app.slack.com` sends `X-Frame-Options: SAMEORIGIN`, so an iframe cannot load it. The web client's `xoxc` token only works with the `d` cookie, Slack does not support that use, and it only exists when Slack is logged in inside the same browser. The desktop app does not count.
- The Chat SDK does not list custom emoji. It is a messaging bot framework. Leave it out.
- Images are fetched by the extension's background worker and shown as `data:` URLs. GitHub's page image policy blocks `emoji.slack-edge.com`. Do not strip GitHub's Content-Security-Policy.
- Standard emoji come from `emojibase-data` (GitHub shortcodes, CLDR groups). Category labels match the iOS picker: Smileys & Emotion, People & Body, Animals & Nature, Food & Drink, Travel & Places, Activities, Objects, Symbols, Flags. Skip the component group. Keep skin-tone variants in the shortcode lookup and out of the default grid.
- Custom emoji on a matched site win over a standard emoji with the same name. Sources on a rule are searched in the order listed.
- Backspace has two modes. `delete` removes the whole emoji. `unwrap` leaves `:name` with the closing colon gone, so the next backspaces walk through the text. Default is `delete`.
- The standard keyboard can be everywhere, or only on sites that have a rule. A separate switch hides standard emoji entirely. Custom emoji show only on rules that include their source. If neither set applies, leave the site's own picker alone.
- GitHub and Linear are the first hosts whose colon menus should yield. Add other hosts only after reproducing them. Suppress a host menu only when our keyboard is actually allowed to open.

`slack-app-manifest.json` matches the Slack decision: PKCE on, token rotation off, org install allowed, user scope `emoji:read` only. `wxt.config.ts` pins a public extension key so the local extension id, and therefore the OAuth redirect, stays stable. The Chrome Web Store replaces that key on publish, so the redirect URL in Slack has to be updated then.

## What is in the tree

| Path | State |
| --- | --- |
| `src/lib/types.ts`, `state.ts` | Draft state shape: settings, connections, site rules, Discord user. `normalizeState` is the migration point. |
| `src/lib/pkce.ts`, `pattern.ts`, `shortcode.ts` | Pure helpers. URL globs treat `*` as "anything, including slashes". |
| `src/lib/catalog.ts` | Resolves aliases, decides whether standard emoji are allowed, and builds keyboard rows. |
| `src/lib/standard-emoji.ts` | Loads the full emojibase JSON. Import this from the content script only. Keep it out of the service worker. |
| `src/lib/sources/slack.ts` | `auth.test`, `emoji.list`, and the OAuth token response. Alias records have an empty `cacheKey` until `resolveAlias` walks them. |
| `src/lib/sources/discord.ts`, `teams.ts` | API shapes only. They assume the caller already has a token. They are not a product decision about where that token lives. |
| `src/lib/overrides.ts` | A guess at GitHub and Linear menu selectors. Treat it as a hypothesis. |
| `src/lib/page/render.ts`, `keyboard.ts`, `style.ts` | Unmounted DOM drafts. Do not turn the contenteditable walker on for every page. See below. |
| `src/entrypoints/background.ts` | Empty shell. |

No options page, popup, content script, image cache, tests, or icons. `vitest.config.ts` is ready for `tests/**/*.test.ts`. Those tests do not exist yet.

## Think through these before writing the next feature

### 1. Slack sign-in is unproven

Chrome's identity redirect is `https://<extension-id>.chromiumapp.org/`. That is an HTTPS URL. Slack's PKCE docs say the code exchange omits the client secret, and that custom URI schemes always get rotating tokens and cannot request bot scopes. This redirect is not a custom scheme. Token rotation is off in the manifest so an HTTPS redirect can stay long-lived.

Enabling PKCE cannot be undone without Slack support. Before building the options page around it:

1. Create the app from the manifest and paste the real redirect URL.
2. Confirm `oauth.v2.access` accepts `code` plus `code_verifier` and no `client_secret`.
3. Call `emoji.list` with the user token and confirm a `.gif` and an `alias:` entry.

If Slack still demands a client secret, stop and choose one fallback: a tiny exchange endpoint that returns the user token and stores nothing, or a pasted `xoxp-` token for local development. Do not put a client secret or bot token in the extension package.

Write the result of that spike into this file.

### 2. A textarea and a rich editor are different problems

Rendered HTML is the straightforward case. Walk text nodes, skip `code`, `pre`, `script`, `style`, Monaco, and CodeMirror, and replace a finished shortcode with an image whose height is `1em`. A mutation observer covers comments that arrive later. Guard it so our own DOM edits do not loop.

A `<textarea>` cannot contain an image. GitHub's classic comment box is a textarea. The value that gets submitted should remain `:partyparrot:` for custom emoji. The image is a visual layer: a `position: fixed` mirror aligned to the field's padding box, with the field's text color transparent and `caret-color` restored. Do not wrap the textarea in a new parent. GitHub and React will throw that away. Copy font, line height, padding, and scroll. Expect this to be wrong inside transformed ancestors and during some IME compositions. Get rendered pages right before spending time on the mirror.

`setRangeText` is the way to change a slice of a textarea without wiping the undo stack. Use it when backspace in `delete` mode removes a whole `:name:` that ends at the caret. `unwrap` mode should let that single backspace happen.

Standard emoji in a field are a product choice that is still open:

- Leave `:grinning:` in the value and draw the Unicode character in the mirror. GitHub's own markdown renderer also understands that shortcode.
- Or, when the closing colon is typed, replace that one range with the Unicode character so the comment contains a real emoji for everyone.

Recommendation: replace a standard shortcode with the Unicode character at the caret, and leave custom shortcodes as text under the mirror. Confirm that against a GitHub comment before locking it in. `render.ts` does not implement the mirror.

Linear's editor is ProseMirror. Inserting a `contenteditable="false"` atom, which `renderTextNode` knows how to do, will be reverted by the editor. Swallowing the `:` keydown so their menu never opens will also desync ProseMirror, because the editor misses the event the browser used to insert the character. For Linear, hide their menu after it appears, and take arrow keys and Enter only while our keyboard is open. Look at the live DOM first. The selectors in `overrides.ts` are not that look.

GitHub's colon menu is the `text-expander` element. It fires `text-expander-change` with `key: ':'`. A capture listener on that event can stop it when our keyboard is allowed to open. Confirm this on the current comment box. GitHub has been changing editors, and gist.github.com may differ.

`renderWithin` will happily rewrite a contenteditable. The content script, when it exists, should run that only on plain rendered text and on a contenteditable we have decided to own. A fixture page is the place to prove the atom and the backspace behavior. Linear is not that fixture.

### 3. Discord and Teams wait

Discord's supported read is `GET /guilds/{guild.id}/emojis` with a bot that has been invited to that server. User OAuth with `identify` and `guilds` lists servers and does not return emoji. A bot token inside every coworker's extension is a shared secret. The real options are a small backend that holds the bot token and checks the person belongs to the server, or "paste a bot token" for a private prototype. Do not build the Discord section of the options page until that choice is made. Shipping Slack on GitHub is the first usable product.

Teams custom emoji are per tenant, PNG and GIF, up to 5,000, via Graph beta `GET /teamwork/messaging/customEmojis` and the delegated permission `TeamworkCustomEmoji.Read`. Beta is not a production contract. An admin may have to consent. The images arrive as base64 and will not fit in `chrome.storage.local` (about 10MB). They belong in IndexedDB, written as each page arrives, not held in one array. Do this after Discord's token question is settled, or skip it until someone asks.

### 4. Storage, sync, and the keyboard

`chrome.storage.local` holds settings, connection records, and the emoji index (name, remote URL, alias, cache key). Do not use `storage.sync`. Tokens and a few thousand names do not belong there.

Image bytes go through the background worker: Cache API or IndexedDB, then a `data:` URL back to the page. Content-script `fetch` is still subject to CORS. A `data:` URL can be returned as-is.

Refresh on browser startup, on a manual button, and on an alarm of a few hours. `emoji.list` is one call per workspace and the limit is Tier 2, about 20 per minute. If a token fails, mark that connection `needs-auth` and badge the toolbar. The page itself should not nag.

The keyboard opens on the unfinished `:query` at the caret. `findOpenQuery` already refuses to treat the closing colon of `:name:` as a new query. The panel must not take focus (`mousedown` preventDefault on the panel). Filter from the typed query. With an empty query, show category tabs, Custom first when this URL has custom emoji. Cap the filter list.

`<all_urls>` is in the manifest because rules are arbitrary and the standard keyboard can be everywhere. When the options page exists, say that in plain language next to the permission.

## Order to resume

1. Run the Slack PKCE spike and record it here.
2. Persist one Slack connection and its emoji index. Background fetch for images.
3. Replace shortcodes in rendered HTML. Prove it on a local fixture: a heading, a paragraph, and a `code` element that must stay text. Then on a real GitHub page. The heading image should measure about the heading's font size.
4. Textarea mirror, backspace modes, and the value that would be submitted.
5. Colon keyboard, including "do not suppress GitHub or Linear unless our keyboard is allowed to open".
6. GitHub override, verified in the browser. Then Linear, after looking at its DOM.
7. Options page: behavior, site rules, Slack connect, reconnect when a token dies.
8. Discord only after choosing where the bot token lives. Teams after that.

## Checks to add when the matching slice exists

Pure tests, in Vitest, for URL globs, shortcode scan, open-query detection, backspace range, alias cycles, and "custom wins over standard on a matched rule".

Browser check for anything that draws: load the built extension in Chrome, open the fixture over HTTP (a `file://` page will not match the content script), and exercise typing, backspace, and the keyboard. A green unit test does not cover the mirror or GitHub.

## Rough edges already in the draft

- `keyboard.ts` rebuilds the panel on every update, so scroll position and the active category can jump. Fix that when the keyboard is actually mounted.
- `standard-emoji.ts` pulls in the full compact dataset. Confirm the content-script bundle size before shipping.
- `teamsListEmoji` accumulates every image in memory. Replace that with paged writes to IndexedDB if Teams gets built.
- Alias emoji are stored with `cacheKey: ''`. Display code has to use the resolved target's URL and cache key, and the typed name as the shortcode.
