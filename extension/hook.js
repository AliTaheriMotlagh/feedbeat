/*
 * Runs in the X page itself (not the isolated content-script world), because
 * only there can it see the timeline data X loads. It copies X's own search
 * and timeline responses to collect.js, which has the full links that the page
 * only shows shortened. Nothing is sent anywhere else.
 *
 * Responses that arrive before collect.js is ready are kept (a few) and
 * replayed when it asks.
 */
(function () {
  "use strict";

  const TIMELINES = /\/i\/api\/graphql\/[^/?]+\/(SearchTimeline|UserTweets|UserTweetsAndReplies)\b/;
  const MAX_BUFFER = 20;
  const buffer = [];
  let live = false;

  const post = (msg) => window.postMessage({ source: "feedbeat-hook", ...msg }, window.location.origin);

  function emit(body) {
    if (live) return post({ type: "data", body });
    buffer.push(body);
    if (buffer.length > MAX_BUFFER) buffer.shift();
  }

  /** `header(name)` reads a response header; X says when a rate-limit window resets in x-rate-limit-reset (epoch seconds). */
  function onResponse(url, status, readBody, header) {
    if (!TIMELINES.test(url)) return;
    if (status === 429) return post({ type: "ratelimit", reset: Number(header?.("x-rate-limit-reset")) || null });
    if (status !== 200) return;
    Promise.resolve()
      .then(readBody)
      .then((body) => typeof body === "string" && body && emit(body))
      .catch(() => {});
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.source !== "feedbeat-cs" || e.data.type !== "flush") return;
    live = true;
    for (const body of buffer.splice(0)) post({ type: "data", body });
  });

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : (args[0]?.url ?? String(args[0]));
      onResponse(url, res.status, () => res.clone().text(), (name) => res.headers.get(name));
    } catch {
      // Never break X.
    }
    return res;
  };

  const { open, send } = XMLHttpRequest.prototype;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__feedbeatUrl = String(url);
    return open.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    if (TIMELINES.test(this.__feedbeatUrl ?? "")) {
      this.addEventListener("load", () => {
        try {
          onResponse(
            this.__feedbeatUrl,
            this.status,
            () => {
              if (this.responseType === "" || this.responseType === "text") return this.responseText;
              if (this.responseType === "json") return JSON.stringify(this.response);
              return null;
            },
            (name) => this.getResponseHeader(name),
          );
        } catch {
          // Never break X.
        }
      });
    }
    return send.apply(this, args);
  };
})();
