/* bravepuffin.com DIY comments widget (vanilla JS, no dependencies).
 * Lists approved comments (keyset paginated) and submits new ones. Comment text
 * is untrusted and always rendered with textContent. A failure here only affects
 * the comments area, never the surrounding post. */
(function () {
  "use strict";
  var root = document.getElementById("bp-comments");
  if (!root) return;

  var api = root.getAttribute("data-api");
  var postId = root.getAttribute("data-post");
  var listEl = document.getElementById("bp-comments-list");
  var moreBtn = document.getElementById("bp-load-more");
  var form = document.getElementById("bp-comment-form");
  var msgEl = document.getElementById("bp-form-msg");
  var closedEl = document.getElementById("bp-closed");

  // Owner's site-wide switch (reported by every GET): hide the form when closed.
  function setPostingOpen(open) {
    form.hidden = !open;
    closedEl.hidden = open;
  }

  var nextCursor = null;
  var started = false;
  var submissionUuid = newUuid();
  var formShownAt = Date.now(); // spam check: the server drops instant submissions

  // Cloudflare Turnstile (optional): the token is single-use, so reset after every attempt.
  var siteKey = root.getAttribute("data-turnstile-sitekey");
  var tsWidget = null;
  var tsToken = null;
  function renderTurnstile() {
    if (!siteKey || tsWidget !== null) return;
    if (!window.turnstile) { setTimeout(renderTurnstile, 200); return; } // script still loading
    tsWidget = turnstile.render("#bp-turnstile", {
      sitekey: siteKey,
      appearance: "interaction-only",
      callback: function (t) { tsToken = t; },
      "expired-callback": function () { tsToken = null; },
      "error-callback": function () { tsToken = null; }
    });
  }
  function resetTurnstile() {
    tsToken = null;
    if (tsWidget !== null && window.turnstile) turnstile.reset(tsWidget);
  }
  renderTurnstile();

  function newUuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
    catch (e) { return ""; }
  }

  function commentsUrl(cursor) {
    var u = api + "/posts/" + encodeURIComponent(postId) + "/comments";
    return cursor ? u + "?cursor=" + encodeURIComponent(cursor) : u;
  }

  function renderComment(c) {
    var el = document.createElement("article");
    el.className = "bp-comment";
    var head = document.createElement("div");
    head.className = "bp-comment-head";
    var name = document.createElement("span");
    name.className = "bp-comment-name";
    name.textContent = c.author_name;
    var time = document.createElement("time");
    time.className = "bp-comment-time";
    time.textContent = fmtDate(c.created_at);
    head.appendChild(name);
    head.appendChild(time);
    var body = document.createElement("div");
    body.className = "bp-comment-body";
    body.textContent = c.body;
    el.appendChild(head);
    el.appendChild(body);
    return el;
  }

  function load() {
    return fetch(commentsUrl(nextCursor))
      .then(function (r) { if (!r.ok) throw new Error("load"); return r.json(); })
      .then(function (data) {
        if (!started) { listEl.innerHTML = ""; started = true; }
        (data.comments || []).forEach(function (c) { listEl.appendChild(renderComment(c)); });
        if (data.posting_enabled === false) setPostingOpen(false);
        nextCursor = data.next_cursor || null;
        moreBtn.hidden = !nextCursor;
        if (!listEl.children.length) {
          listEl.innerHTML = '<p class="bp-muted">No comments yet. Be the first!</p>';
        }
      })
      .catch(function () {
        if (!started) listEl.innerHTML = '<p class="bp-muted">Comments couldn’t load right now.</p>';
      });
  }

  function refresh() {
    nextCursor = null; started = false; listEl.innerHTML = "";
    return load();
  }

  moreBtn.addEventListener("click", load);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var submit = form.querySelector("button[type=submit]");
    var payload = {
      author_name: form.author_name.value,
      body: form.body.value,
      website: form.website.value, // honeypot
      submission_uuid: submissionUuid,
      elapsed_ms: Date.now() - formShownAt,
      turnstile_token: tsToken
    };
    if (!payload.author_name.trim() || !payload.body.trim()) {
      msgEl.textContent = "Name and comment are required.";
      return;
    }
    if (siteKey && !tsToken) {
      msgEl.textContent = "Checking you're human… please try again in a moment.";
      return;
    }
    submit.disabled = true;
    msgEl.textContent = "Posting…";
    fetch(commentsUrl(null), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        if (r.status === 201 || r.status === 202) return {};
        if (r.status === 429 || r.status === 503) throw new Error("the site is busy, please try again in a minute");
        if (r.status === 403) { setPostingOpen(false); throw new Error("comments are closed"); }
        return r.json().then(function (d) { throw new Error(d && d.error ? d.error : "error"); });
      })
      .then(function () {
        msgEl.textContent = "Posted!";
        form.author_name.value = "";
        form.body.value = "";
        submissionUuid = newUuid(); // a fresh id for the next comment
        formShownAt = Date.now();
        refresh();
      })
      .catch(function (err) {
        // leave the typed message intact so nothing is lost
        msgEl.textContent = "Could not post: " + (err.message || "please try again");
      })
      .then(function () { submit.disabled = false; resetTurnstile(); });
  });

  load();
})();
