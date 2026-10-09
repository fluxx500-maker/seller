// Design-only safeguards. Original backend is intentionally not included.
(() => {
  const explain = () => alert('Дизайн-версия: здесь фиксированные демоданные. Пересчёт периода, сохранение и выгрузки доступны в исходном Python-проекте.');
  document.addEventListener('submit', event => {event.preventDefault(); explain();}, true);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    if (link.closest('.period') || /\.xlsx(?:\?|$)/.test(link.getAttribute('href'))) {event.preventDefault(); explain();}
  }, true);
  // The original full-page store menu submits a POST; emulate only navigation.
  document.querySelectorAll('.store-menu button[name="store_id"]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      const pane = document.body.classList.contains('pane-body');
      location.href = '/summary/' + encodeURIComponent(button.value) + (pane ? '?pane=1' : '');
    });
  });
})();
