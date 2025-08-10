<script defer data-domain="treelineproxy.io" src="https://plausible.io/js/script.js"></script>
<script>
(function(){
  // Preserve UTM params on outbound links
  function preserveUtms(url){
    try{
      const u=new URL(url, location.origin);
      const qs=new URLSearchParams(location.search);
      ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(k=>{
        if(qs.get(k)) u.searchParams.set(k, qs.get(k));
      });
      return u.toString();
    }catch(e){ return url; }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('a[href]').forEach(a=>{
      const href=a.getAttribute('href'); if(!href) return;
      a.setAttribute('href', preserveUtms(href));
    });
  });

  // Plausible goals
  const goals = {
    'cta-helpnow-pay':'CTA: HelpNow Pay',
    'cta-open-consults':'CTA: Open Consults',
    'cta-open-workshop':'CTA: Open Workshop',
    'cta-open-scanner':'CTA: Open Scanner',
    'cta-lead-submit':'Lead Form Submit'
  };
  for (const [id, name] of Object.entries(goals)) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', ()=> window.plausible && plausible(name));
  }
})();
</script>
