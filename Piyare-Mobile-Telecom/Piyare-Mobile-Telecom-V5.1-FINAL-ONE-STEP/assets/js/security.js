(function(){
  window.PMTGuard={token:()=>sessionStorage.getItem("pmt-admin-token")||"",admin:()=>location.pathname.includes("/admin/"),require:()=>{if(!sessionStorage.getItem("pmt-admin-token"))location.replace("login.html")}};
  if(PMTGuard.admin()&&!location.pathname.endsWith("login.html"))PMTGuard.require();
})();
