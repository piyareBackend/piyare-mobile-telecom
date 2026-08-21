window.Admin={
 api:localStorage.getItem("pmt-api-url")||"",
 async request(payload){if(!this.api)throw Error("Enter the Apps Script API URL first.");const r=await fetch(this.api,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({ok:false,message:"Invalid API response"}));return d;},
 async login(username,password,api){if(api){localStorage.setItem("pmt-api-url",api.trim());this.api=api.trim();}const d=await this.request({action:"adminLogin",username,password});if(!d.token)throw Error(d.message||"Login failed");sessionStorage.setItem("pmt-admin-token",d.token);sessionStorage.setItem("pmt-admin-user",JSON.stringify(d.user||{}));location.href="dashboard.html";},
 auth(){return sessionStorage.getItem("pmt-admin-token")},
 user(){try{return JSON.parse(sessionStorage.getItem("pmt-admin-user")||"{}")}catch(e){return {}}},
 logout(){const t=this.auth();this.request({action:"logout",token:t}).catch(()=>{});sessionStorage.removeItem("pmt-admin-token");sessionStorage.removeItem("pmt-admin-user");location.href="login.html"}
};
