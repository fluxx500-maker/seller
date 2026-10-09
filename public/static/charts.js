// Графики: всплывающая подсказка по столбику/дню и просмотр графика на весь экран
(function () {
  // ---------- подсказка: у каждой невидимой полосы дня в SVG есть data-tip с цифрами
  const tip = document.createElement("div");
  tip.className = "chart-tip";
  tip.hidden = true;
  document.body.appendChild(tip);

  function showTip(target, event) {
    const lines = (target.dataset.tip || "").split("\n");
    tip.replaceChildren(...lines.map((line, i) => {
      if (i === 0) {
        const b = document.createElement("b");
        b.textContent = line;
        return b;
      }
      const [label, value] = line.split(/: (?=[^:]*$)/);
      const frag = document.createDocumentFragment();
      const l = document.createElement("span");
      l.textContent = label;
      const v = document.createElement("span");
      v.className = "v";
      v.textContent = value ?? "";
      frag.append(l, v);
      return frag;
    }));
    tip.hidden = false;
    moveTip(event);
  }

  function moveTip(event) {
    const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = event.clientX + pad, y = event.clientY + pad;
    if (x + w > window.innerWidth - 8) x = event.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = event.clientY - h - pad;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }

  // подписи осей: SVG масштабируется целиком, поэтому шрифт пересчитываем под реальную ширину (не мельче ~8 px)
  function fitAxis() {
    document.querySelectorAll("svg.chart").forEach((svg) => {
      const w = svg.clientWidth || 900;
      svg.style.setProperty("--axis", Math.min(12 * 900 / w, 24) + "px");
      // крупные подписи слева могут не влезть в поле — расширяем область рисунка влево ровно настолько, сколько нужно
      svg.setAttribute("viewBox", "0 0 900 280");
      let minX = 0;
      svg.querySelectorAll("text.axis").forEach((t) => { try { minX = Math.min(minX, t.getBBox().x); } catch (e) { /* скрытый график */ } });
      if (minX < 0) svg.setAttribute("viewBox", `${minX - 4} 0 ${900 - minX + 4} 280`);
    });
  }
  fitAxis();
  let axisFrame = 0;
  const scheduleAxis = () => {
    if (axisFrame) return;
    axisFrame = requestAnimationFrame(() => { axisFrame = 0; fitAxis(); });
  };
  window.addEventListener("resize", scheduleAxis);
  // The left split pane resizes without a window resize event.
  if ("ResizeObserver" in window) {
    const widths = new WeakMap();
    const observer = new ResizeObserver((entries) => {
      let changed = false;
      entries.forEach(({ target, contentRect }) => {
        const width = Math.round(contentRect.width);
        if (widths.get(target) !== width) { widths.set(target, width); changed = true; }
      });
      if (changed) scheduleAxis();
    });
    document.querySelectorAll(".chart-card").forEach((card) => observer.observe(card));
  }

  // на телефоне нажатие по графику показывает цифры дня, а на весь экран — только кнопка ⤢
  let lastPointer = "mouse";
  document.addEventListener("pointerdown", (e) => {
    lastPointer = e.pointerType || "mouse";
    if (lastPointer !== "mouse" && !(e.target.closest && e.target.closest("svg.chart"))) tip.hidden = true;
  }, true);

  document.addEventListener("mouseover", (e) => {
    const hit = e.target.closest && e.target.closest("rect.hit");
    if (hit) showTip(hit, e);
  });
  document.addEventListener("mousemove", (e) => {
    if (tip.hidden) return;
    if (e.target.closest && e.target.closest("rect.hit")) moveTip(e); else tip.hidden = true;
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest && e.target.closest("rect.hit") && !(e.relatedTarget && e.relatedTarget.closest("rect.hit"))) tip.hidden = true;
  });

  // ---------- на весь экран: клик по графику или по кнопке ⤢
  const modal = document.createElement("div");
  modal.className = "chart-modal";
  modal.hidden = true;
  modal.innerHTML = '<div class="chart-modal-inner" role="dialog" aria-modal="true" aria-labelledby="chart-dialog-title">' +
    '<div class="chart-modal-head"><h2 id="chart-dialog-title"></h2><button type="button" class="link chart-close" aria-label="Закрыть">✕</button></div>' +
    '<div class="legend"></div><div class="chart-modal-body"></div>' +
    '<p class="muted small">Наведите на столбик или точку, чтобы увидеть цифры за день. Закрыть — Esc или клик вне графика.</p></div>';
  document.body.appendChild(modal);
  let returnFocus = null;
  let inerted = [];

  function openModal(card) {
    returnFocus = document.activeElement;
    modal.querySelector("h2").textContent = card.querySelector("h2").textContent;
    modal.querySelector(".legend").innerHTML = (card.querySelector(".legend") || {}).innerHTML || "";
    modal.querySelector(".chart-modal-body").innerHTML = card.querySelector("svg.chart").outerHTML;
    modal.hidden = false;
    fitAxis();
    document.body.classList.add("modal-open");
    inerted = [...document.body.children].filter((el) => el !== modal && el !== tip && !el.inert);
    inerted.forEach((el) => { el.inert = true; });
    modal.querySelector(".chart-close").focus();
  }

  function closeModal() {
    modal.hidden = true;
    tip.hidden = true;
    document.body.classList.remove("modal-open");
    inerted.forEach((el) => { el.inert = false; });
    inerted = [];
    returnFocus?.focus();
  }

  document.querySelectorAll(".chart-card").forEach((card) => {
    const svg = card.querySelector("svg.chart");
    if (!svg) return;
    svg.addEventListener("click", (e) => {
      if (lastPointer !== "mouse") {
        const hit = e.target.closest("rect.hit");
        if (hit) showTip(hit, e);
        return;
      }
      openModal(card);
    });
    const button = card.querySelector(".chart-zoom");
    if (button) button.addEventListener("click", () => openModal(card));
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest(".chart-close")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (modal.hidden) return;
    if (e.key === "Escape") closeModal();
    // Only the close control is interactive inside this read-only chart dialog.
    if (e.key === "Tab") { e.preventDefault(); modal.querySelector(".chart-close").focus(); }
  });
})();
