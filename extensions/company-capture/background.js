// Saves a company by opening the site's /companies/add page in a small
// window that closes itself once saved. Only the link (and the tab title, for
// the name) is sent; nothing is read from the page itself. The site's normal
// login is used, so the extension stores no keys.

const DEFAULT_SITE = "http://localhost:3000";

async function siteUrl() {
  const { site } = await chrome.storage.sync.get("site");
  return (site || DEFAULT_SITE).replace(/\/+$/, "");
}

// Either a link (url, with an optional title) or a selected name (text).
async function save({ url, title, text }) {
  const params = new URLSearchParams({ close: "1" });
  if (url && /^https?:/i.test(url)) params.set("url", url);
  if (title) params.set("title", title);
  if (text) params.set("text", text.trim().slice(0, 200));
  if (!params.has("url") && !params.has("text")) return;
  await chrome.windows.create({
    url: `${await siteUrl()}/companies/add?${params}`,
    type: "popup",
    width: 420,
    height: 320,
    focused: false,
  });
}

// Toolbar button and Alt+Shift+S: save the current tab.
chrome.action.onClicked.addListener((tab) => save({ url: tab.url, title: tab.title }));

// Right-click a link to save where it points, or select a name (plain text,
// e.g. "Maven Robotics" in a post) and right-click to save it by name.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "save-company-link", title: "Save company", contexts: ["link"] });
  chrome.contextMenus.create({ id: "save-company-text", title: 'Save company "%s"', contexts: ["selection"] });
  chrome.runtime.openOptionsPage();
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "save-company-link") save({ url: info.linkUrl, title: info.selectionText });
  else if (info.menuItemId === "save-company-text") save({ text: info.selectionText });
});
