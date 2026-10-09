// Текущий режим (день/ночь): выбранный кнопкой (data-mode из cookie) или как в системе — для значка на кнопке.
(function () {
  const root = document.documentElement;
  root.dataset.modeNow = root.dataset.mode || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
})();
// Плавное появление блоков. Классы ставятся до отрисовки, чтобы блоки не мигали; без JS и при «уменьшить движение» всё видно сразу.
// Страница во второй половине экрана (фрейм) после сохранения формы или переадресации могла потерять ?pane=1 —
// тогда открываем её снова в режиме половины (без меню, со своим периодом и магазином).
(function () {
  try {
    if (window.self !== window.top && window.top.location.origin === location.origin && !/[?&]pane=1(&|$)/.test(location.search)) {
      const u = new URL(location.href);
      u.searchParams.set("pane", "1");
      location.replace(u.pathname + u.search + u.hash);
    }
  } catch (e) {
    // фрейм на чужом сайте — нас там быть не может (frame-ancestors 'self')
  }
})();
// Боковое меню, свёрнутое до значков (кнопка внизу меню): класс ставится до отрисовки, чтобы меню не «прыгало» при загрузке.
(function () {
  try {
    if (localStorage.getItem("seller_nav_mini") === "1") document.documentElement.classList.add("nav-mini");
  } catch (e) {
    // хранилище недоступно — меню развёрнуто
  }
})();
// js-reveal — главная, js-motion — остальные страницы (все темы). С 02.10.2026 по решению пользователя — на каждой
// странице всегда (раньше: один раз после входа и не чаще раза в день).
(function () {
  const root = document.documentElement;
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.classList.add("js-reveal", "js-motion");
  try {
    localStorage.removeItem("seller_motion_day");  // отметка прежнего правила «раз в день» больше не нужна
  } catch (e) {
    // хранилище недоступно — не важно
  }
})();
