
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-copy]"); if(!b) return;
  const pre = b.closest(".copy")?.querySelector("pre");
  if(!pre) return;
  try{ await navigator.clipboard.writeText(pre.innerText);
    b.classList.add("ok"); b.innerText="copied";
    setTimeout(()=>{ b.classList.remove("ok"); b.innerText="copy"; }, 1200);
  }catch{}
});
