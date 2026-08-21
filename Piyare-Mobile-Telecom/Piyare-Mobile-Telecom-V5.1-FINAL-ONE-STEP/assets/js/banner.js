async function initBanners(){
 const c=document.getElementById("bannerCarousel"); if(!c)return;
 const data=await loadSiteContent(), items=(data.banners||[]).filter(x=>x.active!==false);
 if(!items.length){c.style.display="none";return}
 c.innerHTML=items.map((b,i)=>`<article class="banner-slide ${i===0?"show":""}" data-i="${i}" style="${b.image?`background-image:linear-gradient(90deg,rgba(27,31,59,.9),rgba(27,31,59,.35)),url('${escapeHtml(b.image)}')`:''}">
 <div class="banner-copy"><div class="section-tag" style="color:var(--amber)">Featured</div><h2>${escapeHtml(b.title)}</h2><p>${escapeHtml(b.subtitle)}</p><a class="btn btn-primary" href="${escapeHtml(b.link||'#')}">${escapeHtml(b.button||"Explore")}</a></div></article>`).join("");
 let i=0;
 const show=n=>{i=(n+items.length)%items.length;c.querySelectorAll(".banner-slide").forEach((x,j)=>x.classList.toggle("show",j===i));c.querySelector(".banner-prev")?.setAttribute("aria-label","Previous banner")};
 c.insertAdjacentHTML("beforeend",`<button class="banner-prev" aria-label="Previous banner">‹</button><button class="banner-next" aria-label="Next banner">›</button><div class="banner-dots">${items.map((_,j)=>`<button data-dot="${j}" aria-label="Banner ${j+1}"></button>`).join("")}</div>`);
 c.querySelector(".banner-prev").onclick=()=>show(i-1); c.querySelector(".banner-next").onclick=()=>show(i+1);
 c.querySelectorAll("[data-dot]").forEach(x=>x.onclick=()=>show(+x.dataset.dot));
 setInterval(()=>show(i+1),5000);
}
document.addEventListener("DOMContentLoaded",initBanners);
