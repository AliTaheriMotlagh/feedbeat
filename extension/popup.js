// The background worker does the whole job, so the popup only starts it.
// The popup may close while the X tab scrolls; the result still reaches the site.
const go = document.getElementById("go");
const status = document.getElementById("status");

go.addEventListener("click", async () => {
  go.disabled = true;
  status.textContent = "Scrolling your profile… keep the X tab open.";
  const res = await chrome.runtime.sendMessage({ type: "feedbeat:start" }).catch((err) => ({ ok: false, error: err.message }));
  status.textContent = res?.ok ? `Found ${res.count} songs. Opening Feedbeat to publish…` : (res?.error ?? "Something went wrong.");
  go.disabled = false;
});
