// Smooth anchor jumps (works with sticky header)
(function() {
  const offset = 80;
  function jump(id) {
    const el = document.querySelector(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href.length > 1) { e.preventDefault(); jump(href); }
    });
  });
})();

// Select-all patterns (scanner/workshop)
(function() {
  const master = document.querySelector('[data-select-all="patterns"]');
  if (!master) return;
  master.addEventListener('change', () => {
    document.querySelectorAll('input[name="pattern"]').forEach(cb => cb.checked = master.checked);
  });
})();

// Minimal tooltips
document.querySelectorAll('[data-tip]').forEach(el => {
  el.addEventListener('mouseenter', () => {
    let t = document.createElement('div');
    t.className = 'tl-tip'; t.textContent = el.getAttribute('data-tip');
    document.body.appendChild(t);
    const r = el.getBoundingClientRect();
    t.style.left = (r.left + r.width/2) + 'px';
    t.style.top  = (r.top - 8) + 'px';
    requestAnimationFrame(() => t.classList.add('show'));
    el._tip = t;
  });
  el.addEventListener('mouseleave', () => el._tip && (el._tip.remove(), el._tip = null));
});
