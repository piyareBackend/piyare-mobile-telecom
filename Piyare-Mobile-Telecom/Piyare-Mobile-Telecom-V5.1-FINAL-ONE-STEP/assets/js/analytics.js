(function(){
const api=()=>localStorage.getItem("pmt-api-url")||"";
window.PMTTrack=(event,meta={})=>{if(!api())return;const b=JSON.stringify({action:"analyticsEvent",event:String(event).slice(0,60),path:location.pathname,meta});try{navigator.sendBeacon(api(),new Blob([b],{type:"text/plain;charset=utf-8"}))}catch(e){}};
PMTTrack("page_view");document.addEventListener("click",e=>{const x=e.target.closest("a,button");if(x&&x.matches(".btn,.add-btn,.cart-btn,.wa-float"))PMTTrack("cta_click",{label:(x.innerText||"").slice(0,80)})});
})();