// Каркас кабинета: выдвижное меню на телефоне, выпадающие меню в шапке (магазин, период)
const REVEAL = ":is(.lp-pills, .lp-kicker, .lp-title, .lp-tagline, .lp-lead-c, .lp-show, .lp-slogan, .lp-cta-c, .lp-small-link, .lp-split > *, .lp-h2-c, .lp-sub-c, .lp-mp, .lp-steps > article, .lp-safe > li, .lp-faq-wrap > h2, .lp-faq > details, .lp-final, .lp-checks > li, .mk-feed > li, .mk-stock > li, .lp-msg)";
const MOTION = ":is(.main > :not(.hero):not(.tiles):not(.grid-2):not(.signals):not(.tiles-bar):not(script), .hero > *, .tiles > *, .grid-2 > *, .signals > *, " +
  "tbody > tr:nth-child(-n+30), .auth-wrap > *, .help-toc, .help-doc > :not(.help-cards), .help-cards > *, .chart-card, .flow)";

(function () {
  const body = document.body;
  const btn = document.querySelector("[data-menu-toggle]");
  const sidebar = document.querySelector(".sidebar");
  const appMain = document.querySelector(".app-main");
  const mobileNav = matchMedia("(max-width: 900px)");
  const setOpen = (on) => {
    const wasOpen = body.classList.contains("nav-open");
    body.classList.toggle("nav-open", on);
    if (btn) btn.setAttribute("aria-expanded", on ? "true" : "false");
    if (sidebar) sidebar.inert = mobileNav.matches && !on;
    if (appMain) appMain.inert = mobileNav.matches && on;
    if (on && mobileNav.matches) sidebar?.querySelector("[data-menu-close]")?.focus();
    else if (wasOpen) btn?.focus();
  };
  setOpen(false);
  mobileNav.addEventListener("change", () => setOpen(false));
  if (btn) btn.addEventListener("click", () => setOpen(!body.classList.contains("nav-open")));
  document.querySelectorAll("[data-menu-close]").forEach((x) => x.addEventListener("click", () => setOpen(false)));

  // меню, свёрнутое до значков: кнопка внизу меню, положение — в браузере; у значков всплывает название раздела
  const html = document.documentElement;
  const mini = document.querySelector("[data-nav-mini]");
  const label = mini && mini.querySelector("span");
  const showMini = () => {
    const on = html.classList.contains("nav-mini");
    if (!mini) return;
    mini.setAttribute("aria-pressed", on ? "true" : "false");
    label.textContent = on ? "Развернуть меню" : "Свернуть меню";
  };
  showMini();
  if (mini) mini.addEventListener("click", () => {
    const on = !html.classList.contains("nav-mini");
    html.classList.toggle("nav-mini", on);
    try { localStorage.setItem("seller_nav_mini", on ? "1" : "0"); } catch (e) { /* хранилище недоступно */ }
    showMini();
    hideTip();
  });
  const tip = document.createElement("div");
  tip.className = "nav-tip";
  tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);
  function hideTip() { tip.classList.remove("on"); }
  document.querySelectorAll(".sidebar :is(.nav-link, .nav-scope-head, .sidebar-brand)").forEach((el) => {
    el.addEventListener("mouseenter", () => {
      if (!html.classList.contains("nav-mini") || matchMedia("(max-width: 900px)").matches) return;
      const text = el.classList.contains("sidebar-brand") ? "Общая сводка" : el.textContent.replace(/\s+/g, " ").trim();
      if (!text) return;
      const r = el.getBoundingClientRect();
      tip.textContent = text;
      tip.style.top = (r.top + r.height / 2) + "px";
      tip.style.left = (r.right + 10) + "px";
      tip.classList.add("on");
    });
    el.addEventListener("mouseleave", hideTip);
  });
  const navScroll = document.querySelector(".sidebar-nav");
  if (navScroll) navScroll.addEventListener("scroll", hideTip, { passive: true });

  // выпадающие меню: одно открытое за раз, закрываются кликом мимо и клавишей Esc
  const opened = () => document.querySelectorAll("details.dropdown[open]");
  document.addEventListener("click", (e) => {
    opened().forEach((d) => { if (!d.contains(e.target)) d.open = false; });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && mobileNav.matches && body.classList.contains("nav-open") && sidebar) {
      const controls = [...sidebar.querySelectorAll('a[href], button:not(:disabled)')].filter((el) => el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
    if (e.key !== "Escape") return;
    opened().forEach((d) => { d.open = false; });
    setOpen(false);
  });
  document.querySelectorAll("details.dropdown").forEach((d) => d.addEventListener("toggle", () => {
    if (d.open) opened().forEach((o) => { if (o !== d) o.open = false; });
  }));

  // сравнение на сводке: «со своими датами» открывает поля дат, остальное отправляет форму сразу
  document.querySelectorAll("select[data-compare]").forEach((sel) => sel.addEventListener("change", () => {
    const dates = sel.form.querySelector(".compare-dates");
    if (dates) dates.hidden = sel.value !== "custom";
    if (sel.value !== "custom") sel.form.submit();
  }));

  // P&L: сразу показать последние месяцы — они справа
  document.querySelectorAll(".pnl-wrap").forEach((w) => { w.scrollLeft = w.scrollWidth; });

  // кнопка «Показать» у полей пароля: пароль видно, пока кнопка нажата
  document.querySelectorAll('input[type="password"]').forEach((input) => {
    const wrap = document.createElement("span");
    wrap.className = "pw-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pw-toggle";
    btn.textContent = "Показать";
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", "Показать пароль");
    btn.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Скрыть" : "Показать";
      btn.setAttribute("aria-pressed", show ? "true" : "false");
      btn.setAttribute("aria-label", show ? "Скрыть пароль" : "Показать пароль");
      input.focus();
    });
    wrap.appendChild(btn);
  });

  // тема оформления: меняется сразу на всей странице и запоминается на год (cookie, чтобы сервер отдавал её сразу)
  document.querySelectorAll("[data-theme-choice]").forEach((b) => b.addEventListener("click", () => {
    const code = b.dataset.themeChoice;
    document.documentElement.dataset.style = code;
    // у спокойных тем — иконки Lucide (как LUCIDE_THEMES в app.py): меняем спрайт у уже нарисованных иконок
    const sprite = ["studio", "calm", "graphite", "paper"].includes(code) ? "icons-lucide.svg?v=2" : "icons.svg?v=4";
    document.querySelectorAll("svg.ico use").forEach((u) => {
      const href = u.getAttribute("href") || "";
      u.setAttribute("href", href.replace(/icons(-lucide)?\.svg(\?v=\d+)?/, sprite));
    });
    document.cookie = "ui_style=" + encodeURIComponent(code) + "; path=/; max-age=31536000; SameSite=Lax";
    document.querySelectorAll("[data-theme-choice]").forEach((x) => {
      const on = x.dataset.themeChoice === code;
      x.classList.toggle("active", on);
      x.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const menu = b.closest("details");
    if (menu) menu.open = false;
  }));
  // плавное появление при прокрутке, соседние блоки — по очереди. Главная — список REVEAL (landing.css),
  // остальные страницы — MOTION (themes.css, пока только тема «Яркая фиолетовая»). После анимации — rv-done:
  // блок возвращается в обычное состояние, чтобы переходы не мешали перетаскиванию плиток и наведению.
  const reveal = (selector, step, cap) => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      io.unobserve(el);
      el.classList.add("is-in");
      setTimeout(() => { el.classList.add("rv-done"); el.classList.remove("is-in"); },
        parseInt(el.style.getPropertyValue("--rd") || "0", 10) + 1800);
    }), { rootMargin: "0px", threshold: 0.01 });
    document.querySelectorAll(selector).forEach((el) => {
      const sibs = [...el.parentElement.children].filter((x) => x.matches(selector));
      const k = el.tagName === "TR" ? 25 : step;
      el.style.setProperty("--rd", Math.min(sibs.indexOf(el), el.tagName === "TR" ? 30 : cap) * k + "ms");
      io.observe(el);
    });
  };
  const root = document.documentElement.classList;
  if (root.contains("js-reveal")) reveal(".lp " + REVEAL, 90, 6);
  if (root.contains("js-motion")) reveal(MOTION, 70, 8);
  // видео-знакомство: открывается в окне поверх страницы, при закрытии останавливается. Без JS ссылка ведёт на /tour.
  const tour = document.querySelector(".tour-dialog");
  if (tour && typeof tour.showModal === "function") {
    const video = tour.querySelector("video");
    document.querySelectorAll("[data-tour-open]").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      tour.showModal();
      video.play().catch(() => {});
    }));
    tour.querySelector("[data-tour-close]").addEventListener("click", () => tour.close());
    tour.addEventListener("click", (e) => { if (e.target === tour) tour.close(); });  // щелчок по затемнению вокруг
    tour.addEventListener("close", () => video.pause());
  }
  // кнопка «Скопировать» (data-copy="#поле"): текст поля — в буфер обмена, на кнопке — «Скопировано»
  document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => {
    const field = document.querySelector(b.dataset.copy);
    if (!field) return;
    field.select();
    const done = () => { const t = b.textContent; b.textContent = "Скопировано"; setTimeout(() => { b.textContent = t; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(field.value).then(done, () => document.execCommand("copy") && done());
    else if (document.execCommand("copy")) done();
  }));
  // меню пользователя открывается и нажатием, и наведением мыши (только там, где есть мышь); закрывается с задержкой,
  // чтобы не пропадало, пока курсор идёт от кнопки к пунктам
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll(".user-menu").forEach((menu) => {
      let timer = null;
      menu.addEventListener("mouseenter", () => { clearTimeout(timer); menu.open = true; });
      menu.addEventListener("mouseleave", () => { timer = setTimeout(() => { menu.open = false; }, 250); });
      // нажатие на уже открытое наведением меню не должно его закрывать
      menu.querySelector("summary").addEventListener("click", (e) => { if (menu.open && menu.matches(":hover")) e.preventDefault(); });
    });
  }
  // кнопка «ночь/день»: переключает режим сразу на всей странице и запоминает выбор на год
  document.querySelectorAll("[data-mode-toggle]").forEach((b) => b.addEventListener("click", () => {
    const root = document.documentElement;
    const next = root.dataset.modeNow === "dark" ? "light" : "dark";
    root.dataset.mode = next;
    root.dataset.modeNow = next;
    document.cookie = "ui_mode=" + next + "; path=/; max-age=31536000; SameSite=Lax";
  }));
})();
