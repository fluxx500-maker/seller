// Вторая половина рабочей области (решение пользователя 02.10.2026): кнопка «+» у пункта меню открывает раздел справа,
// левая страница остаётся. Справа — наша же страница во фрейме с ?pane=1: без меню и шапки, свой период и свой магазин
// (сервер хранит их отдельно: period_pane, pane_store_id). Ширина и открытый раздел помнит браузер (localStorage).
// Только на компьютере: на узком экране делить нечего.
(function () {
  const html = document.documentElement;
  const body = document.body;
  const KEY = "seller_split";
  const WIDE = "(min-width: 1100px)";
  const MIN = 360;  // наименьшая ширина любой половины, px

  // ---------- страница внутри правой половины: все ссылки и формы остаются в режиме половины
  if (body.classList.contains("pane-body")) {
    const params = new URLSearchParams(location.search);
    const ps = params.get("ps") || body.dataset.store || "";
    const keep = (url) => {
      const u = new URL(url, location.href);
      if (u.origin !== location.origin) return null;
      u.searchParams.set("pane", "1");
      if (ps && !u.searchParams.has("ps")) u.searchParams.set("ps", ps);
      return u;
    };
    document.querySelectorAll("a[href]").forEach((a) => {
      const raw = a.getAttribute("href");
      if (!raw || raw.startsWith("#") || a.hasAttribute("download") || /\.xlsx(\?|$)/.test(raw) || a.target) return;
      const u = keep(raw);
      if (u) a.href = u.pathname + u.search + u.hash;
    });
    document.querySelectorAll("form").forEach((f) => {
      const method = (f.getAttribute("method") || "get").toLowerCase();
      if (method === "get") {
        if (!f.querySelector("input[name=pane]")) {
          f.insertAdjacentHTML("beforeend", '<input type="hidden" name="pane" value="1">' +
            (ps ? '<input type="hidden" name="ps" value="' + ps.replace(/\D/g, "") + '">' : ""));
        }
      } else {
        const u = keep(f.getAttribute("action") || location.pathname);
        if (u) f.setAttribute("action", u.pathname + u.search);
      }
    });
    return;
  }

  // ---------- основная страница: открыть, закрыть, поменять местами, растянуть
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  const wide = () => matchMedia(WIDE).matches;
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  };
  const write = (v) => {
    try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) { /* нет хранилища */ }
  };
  const withPane = (href) => {
    const u = new URL(href, location.href);
    u.searchParams.set("pane", "1");
    if (!u.pathname.startsWith("/summary/") && body.dataset.store && !u.searchParams.has("ps")) {
      u.searchParams.set("ps", body.dataset.store);
    }
    return u.pathname + u.search;
  };
  // адрес страницы без признаков половины + её период и магазин явно — чтобы перенести её влево или на весь экран
  const fullUrl = (loc, doc) => {
    const u = new URL(loc.href);
    const store = u.searchParams.get("ps") || doc.body.dataset.store || "";
    ["pane", "ps", "m", "message", "error"].forEach((k) => u.searchParams.delete(k));
    const d = doc.body.dataset;
    if (d.since && !u.searchParams.has("preset") && !u.searchParams.has("date_from")) {
      if (d.active && d.active !== "custom") u.searchParams.set("preset", d.active);
      else { u.searchParams.set("date_from", d.since); u.searchParams.set("date_to", d.until); }
    }
    return { path: u.pathname + u.search, store };
  };

  let pane = null, frame = null, title = null, cancelDrag = null;
  let currentWidth = MIN;
  const available = () => window.innerWidth - sidebar.getBoundingClientRect().width;
  const setWidth = (px) => {
    const total = available();
    const w = Math.round(Math.max(MIN, Math.min(Number(px) || total / 2, total - MIN)));
    if (currentWidth !== w || !html.style.getPropertyValue("--split-w")) html.style.setProperty("--split-w", w + "px");
    currentWidth = w;
    const handle = pane?.querySelector(".split-handle");
    if (handle) {
      handle.setAttribute("aria-valuemin", MIN);
      handle.setAttribute("aria-valuemax", Math.floor(total - MIN));
      handle.setAttribute("aria-valuenow", w);
      handle.setAttribute("aria-valuetext", `Правая панель ${w} пикселей`);
    }
    return w;
  };
  const saveWidth = () => write({ ...(read() || {}), w: currentWidth });
  const syncAppearance = () => {
    const root = frame?.contentDocument?.documentElement;
    if (!root) return;
    ["style", "mode", "modeNow"].forEach((key) => {
      if (html.dataset[key]) root.dataset[key] = html.dataset[key];
      else delete root.dataset[key];
    });
    const sprite = ["studio", "calm", "graphite", "paper"].includes(html.dataset.style) ? "icons-lucide.svg?v=2" : "icons.svg?v=4";
    root.querySelectorAll("svg.ico use").forEach((u) => {
      const href = u.getAttribute("href") || "";
      u.setAttribute("href", href.replace(/icons(-lucide)?\.svg(\?v=\d+)?/, sprite));
    });
  };
  const build = () => {
    pane = document.createElement("aside");
    pane.className = "split-pane";
    pane.setAttribute("aria-label", "Вторая половина экрана");
    pane.innerHTML =
      '<div class="split-handle" tabindex="0" aria-label="Ширина правой панели" title="Потяните или используйте стрелки. Enter — поровну" role="separator" aria-orientation="vertical"></div>' +
      '<div class="split-bar"><span class="split-title">Загрузка…</span>' +
      '<button type="button" class="icon-btn" data-split-swap title="Поменять половины местами">⇄</button>' +
      '<button type="button" class="icon-btn" data-split-full title="Открыть на весь экран">↗</button>' +
      '<button type="button" class="icon-btn" data-split-close title="Закрыть вторую половину">×</button></div>' +
      '<iframe class="split-frame" title="Вторая половина экрана"></iframe>';
    body.appendChild(pane);
    frame = pane.querySelector("iframe");
    title = pane.querySelector(".split-title");
    frame.addEventListener("load", () => {
      let doc;
      try { doc = frame.contentDocument; } catch (e) { return; }
      if (!doc || !doc.body) return;
      syncAppearance();
      title.textContent = (doc.title || "").replace(/\s*·\s*seller\.bz\s*$/, "") || "Вторая половина";
      const loc = frame.contentWindow.location;
      const state = read() || {};
      write({ ...state, url: loc.pathname + loc.search });
    });
    pane.querySelector("[data-split-close]").addEventListener("click", close);
    pane.querySelector("[data-split-full]").addEventListener("click", () => {
      const r = fullUrl(frame.contentWindow.location, frame.contentDocument);
      close();
      location.href = goto(r);
    });
    pane.querySelector("[data-split-swap]").addEventListener("click", swap);
    dragging(pane.querySelector(".split-handle"));
  };
  // переход на страницу с нужным магазином: /summary/{id}?next=… переключает магазин и ведёт на страницу
  const goto = (r) => (r.store && r.store !== body.dataset.store
    ? "/summary/" + r.store + "?next=" + encodeURIComponent(r.path) : r.path);

  function open(href) {
    if (!wide()) { location.href = href; return; }
    if (!pane) build();
    const state = read() || {};
    setWidth(state.w || Math.round((window.innerWidth - sidebar.getBoundingClientRect().width) / 2));
    const url = href.includes("pane=1") ? href : withPane(href);
    title.textContent = "Загрузка…";
    if (frame.getAttribute("src") !== url) frame.setAttribute("src", url);
    html.classList.add("split-on");
    write({ ...state, url });
  }
  function close() {
    cancelDrag?.();
    html.classList.remove("split-on");
    const state = read() || {};
    write(state.w ? { w: state.w } : null);  // ширину помним и после закрытия
    if (pane) { pane.remove(); pane = frame = title = null; }
  }
  function swap() {
    let right;
    try { right = fullUrl(frame.contentWindow.location, frame.contentDocument); } catch (e) { return; }
    const left = fullUrl(location, document);
    const leftForPane = new URL(left.path, location.href);
    leftForPane.searchParams.set("pane", "1");
    if (left.store) leftForPane.searchParams.set("ps", left.store);
    write({ ...(read() || {}), url: leftForPane.pathname + leftForPane.search });
    location.href = goto(right);
  }
  function dragging(handle) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || cancelDrag) return;
      e.preventDefault();
      handle.focus();
      handle.setPointerCapture(e.pointerId);
      html.classList.add("split-dragging");  // фрейм не перехватывает мышь, пока тянем
      let pending = null, animationFrame = 0;
      const apply = () => {
        animationFrame = 0;
        if (pending !== null) setWidth(pending);
      };
      const move = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        pending = window.innerWidth - ev.clientX;
        if (!animationFrame) animationFrame = requestAnimationFrame(apply);
      };
      const up = (ev) => {
        if (ev?.pointerId !== undefined && ev.pointerId !== e.pointerId) return;
        if (animationFrame) cancelAnimationFrame(animationFrame);
        apply();
        saveWidth();
        html.classList.remove("split-dragging");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        window.removeEventListener("blur", up);
        handle.removeEventListener("lostpointercapture", up);
        cancelDrag = null;
        if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
      };
      cancelDrag = up;
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      window.addEventListener("blur", up);
      handle.addEventListener("lostpointercapture", up);
    });
    handle.addEventListener("dblclick", () => {  // двойной щелчок — снова пополам
      const w = setWidth(Math.round((window.innerWidth - sidebar.getBoundingClientRect().width) / 2));
      write({ ...(read() || {}), w });
    });
    handle.addEventListener("keydown", (e) => {
      const actions = { ArrowLeft: currentWidth + (e.shiftKey ? 80 : 24), ArrowRight: currentWidth - (e.shiftKey ? 80 : 24), Home: MIN, End: available() - MIN, Enter: available() / 2 };
      if (!(e.key in actions)) return;
      e.preventDefault();
      setWidth(actions[e.key]);
      saveWidth();
    });
  }

  // кнопки «+» у пунктов меню; в свёрнутом меню — щелчок по значку с Ctrl
  document.querySelectorAll("[data-split]").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    open(b.dataset.split);
  }));
  sidebar.querySelectorAll(".nav-row > .nav-link").forEach((a) => a.addEventListener("click", (e) => {
    if (!(e.ctrlKey || e.metaKey) || !html.classList.contains("nav-mini") || !wide()) return;
    e.preventDefault();
    open(a.getAttribute("href"));
  }));
  window.addEventListener("resize", () => {
    if (!pane) return;
    if (!wide()) { html.classList.remove("split-on"); return; }
    html.classList.add("split-on");
    setWidth(parseFloat(getComputedStyle(html).getPropertyValue("--split-w")) || MIN);
  });
  if ("ResizeObserver" in window) new ResizeObserver(() => {
    if (pane && wide()) setWidth(currentWidth);
  }).observe(sidebar);
  new MutationObserver(syncAppearance).observe(html, { attributes: true, attributeFilter: ["data-style", "data-mode", "data-mode-now"] });

  // открытая раньше вторая половина остаётся при переходах по страницам
  const saved = read();
  if (saved && saved.url && wide()) open(saved.url);
})();
