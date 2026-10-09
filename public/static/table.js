// Сортировка по клику на заголовок и поиск по таблице товаров
document.querySelectorAll("table.sortable").forEach((table) => {
  const tbody = table.tBodies[0];
  table.querySelectorAll("th[data-sort]").forEach((th) => {
    th.tabIndex = 0;
    th.title = th.title || "Нажмите, чтобы отсортировать";
    th.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); th.click(); }
    });
    th.addEventListener("click", () => {
      const index = Array.from(th.parentNode.children).indexOf(th);
      const dir = th.dataset.dir === "desc" ? "asc" : "desc";
      table.querySelectorAll("th").forEach((h) => { delete h.dataset.dir; h.removeAttribute("aria-sort"); });
      th.dataset.dir = dir;
      th.setAttribute("aria-sort", dir === "asc" ? "ascending" : "descending");
      const rows = Array.from(tbody.rows);
      // строка с объединённой ячейкой («нет данных за период») короче заголовка — считаем её пустой
      const blank = { dataset: {}, textContent: "" };
      const cell = (r) => {
        let col = 0;
        for (const c of r.cells) {
          if (col === index && c.colSpan === 1) return c;
          col += c.colSpan;
          if (col > index) return blank;
        }
        return blank;
      };
      rows.sort((a, b) => {
        const va = cell(a).dataset.v, vb = cell(b).dataset.v;
        const na = va === "" || va === undefined ? null : parseFloat(va);
        const nb = vb === "" || vb === undefined ? null : parseFloat(vb);
        if (na === null && nb === null) {
          return cell(a).textContent.localeCompare(cell(b).textContent, "ru") * (dir === "asc" ? 1 : -1);
        }
        if (na === null) return 1;  // пустые всегда внизу
        if (nb === null) return -1;
        return dir === "asc" ? na - nb : nb - na;
      });
      rows.forEach((r) => tbody.appendChild(r));
    });
  });
});

// Поиск и кнопки-фильтры: нажатая кнопка — фильтр, повторное нажатие снимает; несколько кнопок — все условия сразу
const search = document.querySelector("input[data-filter]");
const tagBox = document.querySelector("[data-tag-buttons]");
const table = (search || tagBox) && document.querySelector(search ? search.dataset.filter : tagBox.dataset.tagButtons);
if (table && table.tBodies[0]) {
  const rows = Array.from(table.tBodies[0].rows);
  const counter = document.querySelector("[data-filter-count]");
  const buttons = tagBox ? Array.from(tagBox.querySelectorAll("button[data-tag]")) : [];
  const brand = document.querySelector("select[data-brand-filter]");
  // список «показать товары» (себестоимость): значение — метка из data-tags строки, пусто — все
  const rowFilter = document.querySelector("select[data-row-filter]");
  // списки по полю строки: <select data-attr-filter="category"> оставляет строки с data-category = выбранному
  const attrFilters = Array.from(document.querySelectorAll("select[data-attr-filter]"));
  const noResults = document.createElement("div");
  noResults.className = "empty table-empty";
  noResults.hidden = true;
  noResults.setAttribute("role", "status");
  noResults.innerHTML = '<b>Ничего не найдено</b><p>Попробуйте другой запрос или уберите фильтры.</p><button type="button">Сбросить фильтры</button>';
  (table.closest(".table-wrap") || table).after(noResults);
  if (counter) { counter.setAttribute("aria-live", "polite"); counter.setAttribute("aria-atomic", "true"); }
  const apply = () => {
    const q = search ? search.value.trim().toLowerCase() : "";
    const attrs = attrFilters.filter((f) => f.value);
    const b = brand ? brand.value : "";
    const need = buttons.filter((b) => b.classList.contains("on")).map((b) => b.dataset.tag);
    if (rowFilter && rowFilter.value) need.push(rowFilter.value);
    let shown = 0;
    rows.forEach((r) => {
      const tags = (r.dataset.tags || "").split(" ");
      const visible = (!q || r.textContent.toLowerCase().includes(q)) && need.every((t) => tags.includes(t))
        && (!b || r.dataset.brand === b) && attrs.every((f) => r.dataset[f.dataset.attrFilter] === f.value);
      r.style.display = visible ? "" : "none";
      shown += visible;
    });
    const filtered = Boolean(q || b || need.length || attrs.length);
    if (counter) counter.textContent = filtered ? `Найдено: ${shown} из ${rows.length}` : `Всего: ${rows.length}`;
    noResults.hidden = !filtered || shown > 0;
    sumSelected(rows.filter((r) => r.style.display !== "none"), filtered);
  };
  // «Сумма по выбранным»: суммы складываются, доли (маржа, ДРР, ROI…) пересчитываются из сумм, а не усредняются
  const sumRow = table.querySelector("[data-sum-row]");
  const NB = " ";
  const money = (v, unit) => {
    const text = Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NB);
    return (v < -0.5 ? "−" : "") + text + (unit ? NB + unit : "");
  };
  const show = (v, fmt) => {
    if (v === null || v === undefined || !isFinite(v)) return "—";
    if (fmt === "rub") return money(v, "₽");
    if (fmt === "units") return money(v, "шт.");
    if (fmt === "pct0") return (v < 0 ? "−" : "") + Math.round(Math.abs(v) * 100) + NB + "%";
    if (fmt === "days") return v > 365 ? "больше года" : Math.round(v) + NB + "дн.";
    if (fmt === "dec") return v === 0 ? "0" : v < 0.05 ? "меньше 0,1" : (Math.round(v * 10) / 10).toString().replace(".", ",");
    return money(v, "");
  };
  function sumSelected(selected, filtered) {
    if (!sumRow) return;
    if (!selected || !selected.length) { sumRow.hidden = true; return; }
    const all = sumRow.dataset.sumAll || rows.length;
    const label = sumRow.querySelector("[data-sum-label]");
    if (label) {
      label.textContent = filtered ? `Итого по отобранным (${selected.length} из ${all})` : `Итого по всем товарам (${all})`;
    }
    const t = {};
    selected.forEach((r) => {
      let raw = {};
      try { raw = JSON.parse(r.dataset.raw || "{}"); } catch (e) { raw = {}; }
      Object.entries(raw).forEach(([k, v]) => { if (typeof v === "number") t[k] = (t[k] || 0) + v; });
      // ROI — только по товарам с себестоимостью (как в строках: без себестоимости ROI нет)
      if (raw.cogs > 0 && !raw.no_cost) {
        t.roi_profit = (t.roi_profit || 0) + (raw.profit || 0);
        t.roi_cogs = (t.roi_cogs || 0) + raw.cogs;
      }
    });
    const net = (t.sold || 0) - (t.returned || 0);
    const div = (a, b) => (b ? a / b : null);
    const value = {
      margin: div(t.profit || 0, t.sale_gross), roi: t.roi_cogs > 0 ? t.roi_profit / t.roi_cogs : null,
      profit_per_unit: net > 0 ? (t.profit || 0) / net : null, drr: div(t.ads || 0, t.sale_gross),
      avg_price: net > 0 ? (t.paid || 0) / net : null, returns_pct: div(t.returned || 0, t.sold),
      coinvest_pct: t.sale > 0 ? (t.sale - (t.paid || 0)) / t.sale : null,
      days_left: t.per_day > 0 ? (t.stock || 0) / t.per_day : null,
    };
    sumRow.querySelectorAll("[data-sum-key]").forEach((c) => {
      const k = c.dataset.sumKey;
      const v = k in value ? value[k] : k in t ? t[k] : undefined;
      c.textContent = v === undefined ? "" : show(v, c.dataset.sumFmt);
      c.classList.toggle("neg", ["profit", "margin", "roi", "profit_per_unit"].includes(k) && v < 0);
    });
    sumRow.hidden = false;
  }
  if (rowFilter) rowFilter.addEventListener("change", apply);
  // порядок строк (себестоимость): без цены первыми, по продажам, по названию, по себестоимости
  const rowSort = document.querySelector("select[data-row-sort]");
  if (rowSort) {
    const body = document.querySelector(rowSort.dataset.rowSort + " tbody");
    const num = (r, k) => parseFloat(r.dataset[k] || "0") || 0;
    const order = {
      nocost: (a, b) => num(b, "nocost") - num(a, "nocost") || num(b, "sold") - num(a, "sold"),
      sold: (a, b) => num(b, "sold") - num(a, "sold"),
      name: (a, b) => (a.dataset.name || "").localeCompare(b.dataset.name || "", "ru"),
      cost: (a, b) => num(b, "cost") - num(a, "cost"),
    };
    rowSort.addEventListener("change", () => {
      [...body.children].sort(order[rowSort.value] || order.nocost).forEach((r) => body.appendChild(r));
    });
  }
  buttons.forEach((b) => b.addEventListener("click", () => {
    b.classList.toggle("on");
    b.setAttribute("aria-pressed", b.classList.contains("on") ? "true" : "false");
    apply();
  }));
  if (search) search.addEventListener("input", apply);
  noResults.querySelector("button").addEventListener("click", () => {
    if (search) search.value = "";
    if (brand) brand.value = "";
    if (rowFilter) rowFilter.value = "";
    attrFilters.forEach((f) => { f.value = ""; });
    buttons.forEach((b) => { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); });
    apply();
    search?.focus();
  });
  if (brand) brand.addEventListener("change", apply);
  attrFilters.forEach((f) => f.addEventListener("change", apply));
  apply();
}
