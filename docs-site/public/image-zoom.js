/* Click-to-zoom for docs screenshots.
 *
 * WHY THIS EXISTS
 * ---------------
 * docs.css caps content images at 760px on purpose: the shots are captured
 * large and rendered small, which is what buys back the pixel density on HiDPI
 * screens. The side effect is that a 1600px screenshot of a preferences pane is
 * legible as a picture and not as text. This gives that detail back on demand
 * without touching the cap.
 *
 * Vanilla and dependency-free on purpose. A lightbox library would be more
 * bytes than the feature, on a docs site that otherwise ships no client JS.
 *
 * Loaded from astro.config.mjs `head` with `defer`, so it runs on every page
 * including the splash home page, and never blocks the parse.
 */
(function () {
  "use strict";

  var SELECTOR = ".sl-markdown-content img";
  var overlay = null;
  var overlayImg = null;
  var overlayCaption = null;
  var lastFocused = null;

  function build() {
    overlay = document.createElement("div");
    overlay.className = "docs-zoom";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Enlarged screenshot");
    overlay.hidden = true;
    overlay.tabIndex = -1;

    overlayImg = document.createElement("img");
    overlayImg.className = "docs-zoom-img";
    overlayImg.alt = "";

    overlayCaption = document.createElement("p");
    overlayCaption.className = "docs-zoom-caption";

    var figure = document.createElement("figure");
    figure.className = "docs-zoom-figure";
    figure.appendChild(overlayImg);
    figure.appendChild(overlayCaption);
    overlay.appendChild(figure);
    document.body.appendChild(overlay);

    // Anywhere, including the image itself — the whole overlay is the target.
    overlay.addEventListener("click", close);
  }

  function open(img) {
    if (!overlay) build();

    // currentSrc, not src: astro:assets emits a srcset, and this is whichever
    // candidate the browser actually settled on.
    overlayImg.src = img.currentSrc || img.src;
    overlayImg.alt = img.alt || "";
    overlayCaption.textContent = img.alt || "";
    overlayCaption.hidden = !img.alt;

    // Never upscale past the file's own pixels — a 188px-wide pull-tab crop
    // blown up to the viewport is a blurry mess, not a better look at it.
    //
    // naturalWidth is 0 until the file has decoded, and every content image is
    // loading="lazy". Clicking one you cannot see is not possible, so in
    // practice it has decoded — but astro:assets writes the intrinsic width
    // onto the tag, so fall back to that rather than to "no limit".
    var natural =
      img.naturalWidth || parseInt(img.getAttribute("width"), 10) || 0;
    overlayImg.style.maxWidth = natural
      ? "min(calc(100vw - 3rem), " + natural + "px)"
      : "calc(100vw - 3rem)";

    // Most shots are of a translucent shade over a desktop, so they have
    // transparent corners. docs.css puts a plate behind those; carry whatever
    // it decided across rather than restating the rule here.
    overlayImg.style.background = window.getComputedStyle(img).backgroundColor;

    lastFocused = document.activeElement;
    // `hidden` is the ONLY visibility gate. An earlier version faded the
    // overlay in from opacity 0 — first via a class added in
    // requestAnimationFrame, then via a CSS animation — and both share one
    // failure: frame-driven styles do not advance in a throttled tab, so the
    // overlay could sit fully transparent over the page, eating clicks. The
    // entrance is a scale animation on the image now (see docs.css); if it
    // never runs, nothing is hidden by it.
    overlay.hidden = false;
    overlay.focus({ preventScroll: true });
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    overlayImg.removeAttribute("src");
    if (lastFocused && document.contains(lastFocused)) {
      lastFocused.focus({ preventScroll: true });
    }
    lastFocused = null;
  }

  function enhance(img) {
    if (img.dataset.zoomable) return;
    // An image inside a link belongs to the link. Do not steal the click.
    if (img.closest("a")) return;
    img.dataset.zoomable = "true";
    img.tabIndex = 0;
    img.setAttribute("role", "button");
    img.setAttribute(
      "aria-label",
      (img.alt ? img.alt + " — " : "") + "click to enlarge"
    );
  }

  document.addEventListener("click", function (e) {
    var img = e.target.closest ? e.target.closest(SELECTOR) : null;
    if (!img || !img.dataset.zoomable) return;
    e.preventDefault();
    open(img);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key !== "Enter" && e.key !== " ") return;
    var img = document.activeElement;
    if (!img || !img.dataset || !img.dataset.zoomable) return;
    e.preventDefault();
    open(img);
  });

  // Scrolling away from an overlay is a close, not a scroll behind it. Cheaper
  // and less jarring than locking the body, which shifts the layout by the
  // width of the scrollbar the moment it is applied.
  window.addEventListener(
    "scroll",
    function () {
      if (overlay && !overlay.hidden) close();
    },
    { passive: true }
  );

  function scan() {
    document.querySelectorAll(SELECTOR).forEach(enhance);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }

  // No-ops today: this Starlight build does not enable view transitions, so
  // every navigation is a full page load and the scan above is enough. Kept so
  // that turning them on later does not quietly ship a page of dead images.
  document.addEventListener("astro:page-load", scan);
  document.addEventListener("astro:before-swap", close);
})();
