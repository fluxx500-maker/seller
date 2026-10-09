// Плитки: перестановка перетаскиванием (со сдвигом остальных), скрытие и сброс порядка.
// Порядок и скрытые плитки хранятся на сервере — у каждого магазина свои, на всех устройствах одинаковые.
(function () {
  // ---------- подсказки «?»: по нажатию (мышь, палец, Enter) показываем пояснение рядом
  let pop = null;
  function closeHint() { if (pop) { pop.remove(); pop = null; } }
  document.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest("button.hint[data-hint]");
    const opened = pop && pop.dataset.for === (btn && btn.dataset.hint);
    closeHint();
    if (!btn || opened) return;
    pop = document.createElement("div");
    pop.className = "hint-pop";
    pop.setAttribute("role", "tooltip");
    pop.textContent = btn.dataset.hint;
    pop.dataset.for = btn.dataset.hint;
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect();
    const left = Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8);
    pop.style.left = Math.max(8, left) + "px";
    pop.style.top = r.bottom + window.scrollY + 6 + "px";
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeHint(); });
  window.addEventListener("resize", closeHint);

  // ---------- меню «Ещё» в шапке закрывается кликом мимо
  document.addEventListener("click", (e) => {
    document.querySelectorAll("details.nav-more[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; });
  });

  document.querySelectorAll(".tiles[data-tiles-page]").forEach(init);

  function init(grid) {
    if (grid.hasAttribute("data-readonly") || grid.hidden) return;  // «только просмотр» или пустой период  // «только просмотр»: раскладку меняет владелец или администратор
    const page = grid.dataset.tilesPage;
    const csrf = grid.dataset.csrf;
    const bar = document.createElement("div");
    bar.className = "tiles-bar";
    grid.before(bar);
    let editing = false;
    let drag = null;

    const tiles = () => Array.from(grid.querySelectorAll(".tile[data-key]"));
    const hiddenCount = () => tiles().filter((t) => t.classList.contains("is-hidden")).length;

    tiles().forEach((tile) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile-hide";
      tile.appendChild(btn);
      updateHideButton(tile);
    });

    function updateHideButton(tile) {
      const btn = tile.querySelector(".tile-hide");
      const hidden = tile.classList.contains("is-hidden");
      btn.textContent = hidden ? "Показать" : "Скрыть";
      btn.title = hidden ? "Снова показывать эту плитку" : "Не показывать эту плитку";
    }

    function renderBar(message) {
      const n = hiddenCount();
      if (editing) {
        bar.innerHTML =
          '<span class="muted small">Перетаскивайте плитки мышкой (на телефоне — пальцем). ' +
          "Кнопка «Скрыть» убирает плитку, скрытые видны только в этом режиме.</span>" +
          '<span class="tiles-bar-buttons"><button type="button" data-act="reset">Вернуть исходный порядок</button>' +
          '<button type="button" class="primary" data-act="done">Готово</button></span>';
      } else {
        bar.innerHTML =
          '<button type="button" class="link" data-act="edit">⚙ Настроить плитки</button>' +
          (n ? `<span class="muted small">Скрыто плиток: ${n}</span>` : "");
      }
      if (message) {
        const m = document.createElement("span");
        m.className = "small tiles-bar-msg";
        m.textContent = message;
        bar.appendChild(m);
      }
    }

    function setEditing(on) {
      editing = on;
      grid.classList.toggle("editing", on);
      bar.classList.toggle("is-editing", on);
      renderBar();
    }

    function save(reset) {
      const body = reset
        ? { page, reset: true }
        : {
            page,
            order: tiles().map((t) => t.dataset.key),
            hidden: tiles().filter((t) => t.classList.contains("is-hidden")).map((t) => t.dataset.key),
          };
      return fetch("/tiles", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error(r.status);
      }).catch(() => renderBar("Не удалось сохранить — обновите страницу и попробуйте ещё раз"));
    }

    bar.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "edit") setEditing(true);
      if (act === "done") setEditing(false);
      if (act === "reset" && confirm("Вернуть исходный порядок и показать все плитки?")) {
        save(true).then(() => location.reload());
      }
    });

    grid.addEventListener("click", (e) => {
      const btn = e.target.closest(".tile-hide");
      if (!btn) return;
      const tile = btn.closest(".tile");
      tile.classList.toggle("is-hidden");
      updateHideButton(tile);
      save();
      renderBar();
    });

    // ---------- перетаскивание (Pointer Events: мышь, палец, перо)
    grid.addEventListener("pointerdown", (e) => {
      const tile = e.target.closest(".tile[data-key]");
      if (!tile || e.button !== 0 || e.target.closest("button, a, .hint")) return;
      // на сенсорном экране — только в режиме настройки, иначе мешало бы прокрутке страницы
      if (e.pointerType !== "mouse" && !editing) return;
      drag = { tile, id: e.pointerId, x0: e.clientX, y0: e.clientY, started: false, before: tiles().map((t) => t.dataset.key).join() };
    });

    document.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.started) {
        if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
        start(e);
      }
      e.preventDefault();
      drag.pointer = { x: e.clientX, y: e.clientY };
      if (!drag.frame) drag.frame = requestAnimationFrame(() => {
        if (!drag) return;
        drag.frame = null;
        move(drag.pointer.x, drag.pointer.y);
      });
    }, { passive: false });

    document.addEventListener("pointerup", (e) => { if (drag && e.pointerId === drag.id) finish(true); });
    document.addEventListener("pointercancel", (e) => { if (drag && e.pointerId === drag.id) finish(false); });
    window.addEventListener("blur", () => { if (drag) finish(false); });

    function start(e) {
      const r = drag.tile.getBoundingClientRect();
      drag.started = true;
      drag.dx = e.clientX - r.left;
      drag.dy = e.clientY - r.top;
      drag.ghost = drag.tile.cloneNode(true);
      drag.ghost.classList.add("tile-ghost");
      drag.ghost.classList.remove("is-hidden", "is-empty");  // скрытую плитку в режиме настройки тоже видно, пока её несут
      Object.assign(drag.ghost.style, { left: "0", top: "0", width: r.width + "px", height: r.height + "px", transform: `translate3d(${r.left}px, ${r.top}px, 0)` });
      drag.oneColumn = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length === 1;
      document.body.appendChild(drag.ghost);
      drag.placeholder = document.createElement("div");
      drag.placeholder.className = "tile-placeholder";
      drag.placeholder.style.height = r.height + "px";
      drag.tile.before(drag.placeholder);
      drag.tile.classList.add("is-dragging");
      document.body.classList.add("tiles-dragging");
    }

    function move(x, y) {
      // у края окна — прокручиваем страницу, чтобы плитку можно было унести далеко
      if (y < 60) window.scrollBy(0, -14);
      else if (y > window.innerHeight - 60) window.scrollBy(0, 14);
      const target = document.elementFromPoint(x, y)?.closest(".tile[data-key]");
      const valid = target && target !== drag.tile && grid.contains(target);
      const r = valid ? target.getBoundingClientRect() : null;
      drag.ghost.style.transform = `translate3d(${x - drag.dx}px, ${y - drag.dy}px, 0) rotate(1deg)`;
      if (!valid) return;
      // в сетке плитки идут слева направо: левая половина плитки — вставить перед ней, правая — после;
      // в один столбик (телефон) — по верхней и нижней половине
      const before = drag.oneColumn ? y < r.top + r.height / 2 : x < r.left + r.width / 2;
      if (before) target.before(drag.placeholder);
      else target.after(drag.placeholder);
    }

    function finish(keep) {
      const d = drag;
      if (d.frame) {
        cancelAnimationFrame(d.frame);
        if (keep && d.pointer) move(d.pointer.x, d.pointer.y);
      }
      drag = null;
      if (!d.started) return;
      if (keep) d.placeholder.replaceWith(d.tile);
      else d.placeholder.remove();
      d.tile.classList.remove("is-dragging");
      d.ghost.remove();
      document.body.classList.remove("tiles-dragging");
      if (keep && tiles().map((t) => t.dataset.key).join() !== d.before) save();
    }

    renderBar();
  }
})();
