const input = document.getElementById("site");
const status = document.getElementById("status");

chrome.storage.sync.get("site").then(({ site }) => {
  input.value = site || "http://localhost:3000";
});

document.getElementById("save").addEventListener("click", async () => {
  try {
    const url = new URL(input.value.trim());
    await chrome.storage.sync.set({ site: url.origin });
    input.value = url.origin;
    status.textContent = " Saved.";
  } catch {
    status.textContent = " That doesn't look like an address.";
  }
});
