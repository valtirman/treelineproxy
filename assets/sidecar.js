
// copy-to-clipboard and sticky hash highlighting
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-copy');
      const el = document.getElementById(id);
      if (!el) return;
      try{
        await navigator.clipboard.writeText(el.innerText);
        const prev = btn.innerText;
        btn.innerText = 'Copied ✓';
        setTimeout(()=>btn.innerText=prev, 1100);
      }catch(e){ console.warn('copy failed', e); }
    });
  });
});
