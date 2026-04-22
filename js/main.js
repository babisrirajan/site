(function () {
  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.querySelector("[data-nav]");
  if (!toggle || !nav) return;

  function close() {
    nav.classList.remove("is-open");
    document.body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", function () {
    var open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", close);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });
})();

(function () {
  var forms = document.querySelectorAll("[data-contact-form]");
  forms.forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var thanks =
        form.parentElement && form.parentElement.querySelector("[data-thanks]");
      if (!thanks) thanks = form.querySelector("[data-thanks]");
      if (thanks) thanks.classList.add("is-visible");
      form.reset();
    });
  });
})();

/* Media page: hero video stays fixed to the viewport like background-attachment: fixed */
(function () {
  var hero = document.querySelector("[data-media-hero]");
  var vid = document.querySelector(".media-hero-video--viewport-fixed");
  if (!hero || !vid) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var ticking = false;

  function applyClip() {
    ticking = false;
    var h = hero.getBoundingClientRect();
    var vh = window.innerHeight;
    var vw = window.innerWidth;
    if (h.bottom <= 0 || h.top >= vh) {
      vid.style.clipPath = "inset(100% 100% 100% 100%)";
      return;
    }
    var top = Math.max(0, h.top);
    var left = Math.max(0, h.left);
    var right = Math.max(0, vw - h.right);
    var bottom = Math.max(0, vh - h.bottom);
    vid.style.clipPath =
      "inset(" + top + "px " + right + "px " + bottom + "px " + left + "px)";
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(applyClip);
    }
  }

  applyClip();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", applyClip);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(applyClip).observe(hero);
  }
})();

/* Media page: modelling — endless strip ([clone][real][clone]); ±blockW only after wrap scrollend */
(function () {
  var root = document.querySelector("[data-modelling-carousel]");
  if (!root) return;

  var viewport = root.querySelector("[data-modelling-viewport]");
  var track = viewport && viewport.querySelector("[data-modelling-track]");
  var dots = root.querySelectorAll("[data-modelling-dot]");
  var prevBtn = root.querySelector("[data-modelling-prev]");
  var nextBtn = root.querySelector("[data-modelling-next]");
  if (!viewport || !track || !dots.length) return;

  var originals = Array.prototype.slice.call(
    track.querySelectorAll(".media-modelling-slide")
  );
  var n = originals.length;
  if (!n) return;

  for (var pi = n - 1; pi >= 0; pi--) {
    var pre = originals[pi].cloneNode(true);
    pre.setAttribute("aria-hidden", "true");
    track.insertBefore(pre, track.firstChild);
  }
  for (var ai = 0; ai < n; ai++) {
    var post = originals[ai].cloneNode(true);
    post.setAttribute("aria-hidden", "true");
    track.appendChild(post);
  }

  var slides = track.querySelectorAll(".media-modelling-slide");
  var blockW = 0;
  var i = 0;
  var jumpLock = false;
  /** Set only when animating into a clone strip; scrollend applies ±blockW once — never on plain 0→1. */
  var wrapForward = false;
  var wrapBack = false;
  var scrollAnimRafId = null;
  var savedScrollBehaviorForAnim = null;
  var suppressDebouncedScrollSync = false;
  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function easeInOutQuart(t) {
    return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
  }

  function cancelProgrammaticScrollAnim() {
    if (scrollAnimRafId !== null) {
      cancelAnimationFrame(scrollAnimRafId);
      scrollAnimRafId = null;
    }
    if (savedScrollBehaviorForAnim !== null) {
      viewport.style.scrollBehavior = savedScrollBehaviorForAnim;
      savedScrollBehaviorForAnim = null;
    }
    suppressDebouncedScrollSync = false;
  }

  function measureBlock() {
    blockW = slides[2 * n].offsetLeft - slides[n].offsetLeft;
    if (blockW <= 0) blockW = slides[n].offsetWidth * n;
  }

  function updateDots(active) {
    i = active;
    dots.forEach(function (dot, dotIdx) {
      var on = dotIdx === i;
      dot.classList.toggle("is-active", on);
      dot.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function afterProgrammaticScrollMotion() {
    applyWrapJumpIfNeeded();
    syncFromScroll();
  }

  function scrollSlideIntoCenter(slide, instant) {
    if (!slide) return;
    cancelProgrammaticScrollAnim();
    var v = viewport.getBoundingClientRect();
    var s = slide.getBoundingClientRect();
    var nextLeft =
      viewport.scrollLeft + (s.left + s.width / 2) - (v.left + v.width / 2);
    var maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    nextLeft = Math.max(0, Math.min(nextLeft, maxScroll));
    if (reduce || instant) {
      setScrollLeftInstant(nextLeft);
      afterProgrammaticScrollMotion();
      return;
    }
    var from = viewport.scrollLeft;
    if (Math.abs(nextLeft - from) < 1) {
      setScrollLeftInstant(nextLeft);
      afterProgrammaticScrollMotion();
      return;
    }
    var dist = Math.abs(nextLeft - from);
    var durationMs = Math.min(1150, Math.max(580, dist * 0.78));
    suppressDebouncedScrollSync = true;
    savedScrollBehaviorForAnim = viewport.style.scrollBehavior;
    viewport.style.scrollBehavior = "auto";
    var t0 = performance.now();
    function tick(now) {
      var u = Math.min(1, (now - t0) / durationMs);
      var eased = easeInOutQuart(u);
      viewport.scrollLeft = from + (nextLeft - from) * eased;
      if (u < 1) {
        scrollAnimRafId = requestAnimationFrame(tick);
      } else {
        scrollAnimRafId = null;
        viewport.scrollLeft = nextLeft;
        viewport.style.scrollBehavior = savedScrollBehaviorForAnim;
        savedScrollBehaviorForAnim = null;
        suppressDebouncedScrollSync = false;
        afterProgrammaticScrollMotion();
      }
    }
    scrollAnimRafId = requestAnimationFrame(tick);
  }

  /** Must be instant: CSS `scroll-behavior: smooth` on the viewport would animate ±blockW and look like a double glitch after wrap. */
  function setScrollLeftInstant(x) {
    var prev = viewport.style.scrollBehavior;
    viewport.style.scrollBehavior = "auto";
    viewport.scrollLeft = x;
    viewport.style.scrollBehavior = prev;
  }

  function applyWrapJumpIfNeeded() {
    if (!blockW) return;
    if (wrapForward) {
      wrapForward = false;
      jumpLock = true;
      setScrollLeftInstant(viewport.scrollLeft - blockW);
      jumpLock = false;
      return;
    }
    if (wrapBack) {
      wrapBack = false;
      jumpLock = true;
      setScrollLeftInstant(viewport.scrollLeft + blockW);
      jumpLock = false;
      return;
    }
  }

  function syncFromScroll() {
    var vr = viewport.getBoundingClientRect();
    var mid = vr.left + vr.width / 2;
    var bestLogical = 0;
    var bestDist = Infinity;
    for (var j = 0; j < slides.length; j++) {
      var r = slides[j].getBoundingClientRect();
      var c = r.left + r.width / 2;
      var d = Math.abs(c - mid);
      if (d < bestDist) {
        bestDist = d;
        bestLogical = j % n;
      }
    }
    if (bestLogical !== i) updateDots(bestLogical);
  }

  function onScrollEnd() {
    if (scrollAnimRafId !== null) return;
    applyWrapJumpIfNeeded();
    syncFromScroll();
  }

  function go(idx, instant) {
    wrapForward = false;
    wrapBack = false;
    var k = ((idx % n) + n) % n;
    scrollSlideIntoCenter(slides[n + k], instant);
    updateDots(k);
  }

  function next() {
    if (i < n - 1) {
      go(i + 1, false);
    } else {
      wrapForward = true;
      scrollSlideIntoCenter(slides[2 * n], false);
      updateDots(0);
    }
  }

  function prev() {
    if (i > 0) {
      go(i - 1, false);
    } else {
      wrapBack = true;
      scrollSlideIntoCenter(slides[n - 1], false);
      updateDots(n - 1);
    }
  }

  if (prevBtn) prevBtn.addEventListener("click", prev);
  if (nextBtn) nextBtn.addEventListener("click", next);

  dots.forEach(function (dot) {
    dot.addEventListener("click", function () {
      var idx = parseInt(dot.getAttribute("data-modelling-dot"), 10);
      if (!isNaN(idx)) go(idx, reduce);
    });
  });

  root.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    }
  });

  var scrollTimer;
  var settleTimer;
  var hasScrollEnd = "onscrollend" in window;
  viewport.addEventListener(
    "scroll",
    function () {
      if (!suppressDebouncedScrollSync) {
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(syncFromScroll, 50);
      }
      if (!hasScrollEnd) {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(
          onScrollEnd,
          scrollAnimRafId !== null ? 1300 : 550
        );
      }
    },
    { passive: true }
  );
  if (hasScrollEnd) {
    viewport.addEventListener("scrollend", onScrollEnd);
  }

  function layout() {
    measureBlock();
    go(0, true);
  }

  requestAnimationFrame(function () {
    requestAnimationFrame(layout);
  });
  window.addEventListener("resize", function () {
    wrapForward = false;
    wrapBack = false;
    measureBlock();
    go(i, true);
  });
})();

/* Design page: horizontal nudge on project image strips */
(function () {
  document.querySelectorAll("[data-portfolio-strip]").forEach(function (strip) {
    var root = strip.closest(".portfolio-project");
    if (!root) return;
    var prev = root.querySelector("[data-portfolio-prev]");
    var next = root.querySelector("[data-portfolio-next]");
    var step = function (dir) {
      strip.scrollBy({
        left: dir * Math.max(120, strip.clientWidth * 0.55),
        behavior: "smooth",
      });
    };
    if (prev) prev.addEventListener("click", function () { step(-1); });
    if (next) next.addEventListener("click", function () { step(1); });
  });
})();
