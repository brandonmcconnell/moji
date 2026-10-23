export const PAGE_STYLE = `
.emoji-ext-atom {
  display: inline-block;
  width: 1em;
  height: 1em;
  vertical-align: -0.15em;
  position: relative;
  line-height: 1;
  user-select: all;
}
.emoji-ext-code {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.emoji-ext-img {
  display: block;
  width: 1em;
  height: 1em;
  object-fit: contain;
  pointer-events: none;
}
.emoji-ext-mirror,
.emoji-ext-measurer {
  position: fixed;
  box-sizing: border-box;
  margin: 0;
  border: 0;
  pointer-events: none;
  overflow: hidden;
  white-space: pre-wrap;
  word-wrap: break-word;
  background: transparent;
  color: CanvasText;
  z-index: 2147483646;
}
.emoji-ext-measurer {
  visibility: hidden;
  z-index: 0;
}
.emoji-ext-mirror .emoji-ext-img {
  display: inline-block;
  vertical-align: -0.15em;
}
.emoji-ext-suppressed {
  display: none !important;
}
.emoji-ext-keyboard-host {
  position: fixed;
  z-index: 2147483647;
  top: 0;
  left: 0;
}
`

export const KEYBOARD_STYLE = `
:host { all: initial; }
.panel {
  position: fixed;
  width: min(352px, calc(100vw - 16px));
  max-height: min(360px, calc(100vh - 16px));
  display: flex;
  flex-direction: column;
  background: #fffdf8;
  color: #1c1917;
  border: 1px solid #e6dccf;
  border-radius: 16px;
  box-shadow: 0 16px 50px rgba(40, 24, 8, 0.18);
  overflow: hidden;
  font: 13px/1.3 "Segoe UI", system-ui, sans-serif;
}
.query {
  padding: 10px 14px 0;
  color: #78716c;
  font-weight: 650;
}
.tabs {
  display: flex;
  gap: 4px;
  padding: 8px 10px;
  overflow-x: auto;
  border-bottom: 1px solid #f0e7dc;
}
.tabs button, .grid button, .row button {
  font: inherit;
  color: inherit;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.tabs button {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 4px 8px;
  color: #57534e;
}
.tabs button[aria-selected="true"] {
  background: #1c1917;
  color: #fffdf8;
}
.grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  padding: 8px;
  overflow: auto;
}
.grid button {
  height: 36px;
  border-radius: 8px;
  font-size: 22px;
}
.grid button img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.grid button[data-active="true"], .row button[data-active="true"], .grid button:hover, .row button:hover {
  background: #f4ece3;
}
.rows { overflow: auto; padding: 6px; }
.row button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  padding: 6px 8px;
  text-align: left;
}
.row img { width: 22px; height: 22px; object-fit: contain; }
.glyph { width: 22px; text-align: center; font-size: 20px; }
.name { font-weight: 650; }
.meta { color: #78716c; }
.empty { padding: 18px 14px 22px; color: #78716c; }
`
