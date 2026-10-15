// A remote control for the scan. It runs in the X tab (or the iframe on the
// Feedbeat page) and keeps going when this popup closes.
const $ = (id) => document.getElementById(id);
const L = globalThis.FeedbeatLib;
const fmt = (n) => n.toLocaleString("en-US");
const month = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });

let busy = false;
let last = [null, true]; // [summary, signed in to X]

function statusLine(s, signedIn) {
  if (!s) return signedIn ? ["Scans in your X tab (or opens one). Keep it in front while it runs; pause any time."] : ["Sign in to X in this browser first.", "warn"];
  if (s.message && s.status === "error") return [s.message, "bad"];
  if (s.message && ["cooldown", "running"].includes(s.status)) return [s.message, "warn"];
  switch (s.status) {
    case "running":
      return [s.oldest && s.mode === "all" ? `Reading posts from ${month(s.oldest)}…` : "Reading your posts…"];
    case "done":
      return [s.complete ? "Your whole history is scanned." : (s.message ?? "Up to date.")];
    case "paused":
      return [s.oldest ? `Paused at ${month(s.oldest)}. Continue any time.` : "Paused."];
    default:
      return [s.message ?? ""];
  }
}

function render(s, signedIn) {
  $("who").textContent = s?.handle ? `@${s.handle}` : "";
  $("songs").textContent = fmt(s?.songs ?? 0);
  $("posts").textContent = fmt(s?.scanned ?? 0);
  const [text, tone] = statusLine(s, signedIn);
  $("status").textContent = text;
  $("status").className = tone ?? "";

  const active = s && ["running", "cooldown"].includes(s.status);
  $("start").hidden = active;
  $("start").textContent = !s || !s.scanned ? "Scan my posts in this tab" : s.complete ? "Check for new posts" : "Continue scanning";
  $("pause").hidden = !active;
  $("new").hidden = active || !s?.newest || s.complete;
  $("reset").hidden = active || !s;
  $("site").textContent = s?.unpublished ? `Publish ${fmt(s.unpublished)} new songs on Feedbeat` : "Open Feedbeat";
  for (const b of document.querySelectorAll("button")) b.disabled = busy;
}

async function send(type, payload) {
  busy = true;
  render(...last);
  const res = await chrome.runtime.sendMessage({ type, payload }).catch((err) => ({ ok: false, error: err.message }));
  busy = false;
  if (!res?.ok) {
    render(...last);
    $("status").textContent = res?.error ?? "Something went wrong.";
    $("status").className = "bad";
    return null;
  }
  if ("state" in res) last = [res.state, last[1]];
  render(...last);
  return res;
}

$("start").addEventListener("click", () => send("feedbeat:start", { kind: "continue" }));
$("new").addEventListener("click", () => send("feedbeat:start", { kind: "new" }));
$("pause").addEventListener("click", () => send("feedbeat:pause"));
$("site").addEventListener("click", () => send("feedbeat:open-site").then(() => window.close()));
$("reset").addEventListener("click", () => {
  if (confirm("Forget everything collected so far? Songs already published stay on Feedbeat.")) send("feedbeat:reset");
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.scan) return;
  last = [L.summarize(changes.scan.newValue ?? null), last[1]];
  render(...last);
});

chrome.runtime.sendMessage({ type: "feedbeat:get" }).then((res) => {
  last = [res?.state ?? null, res?.signedIn ?? false];
  render(...last);
});
