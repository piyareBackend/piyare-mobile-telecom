/**
 * Piyare Mobile Telecom — v5.1 Production API (single final backend)
 * Storage: Google Sheets + Google Drive.
 * Keep this file server-side. Never put secrets in frontend files.
 */
const CFG={SESSION_SECONDS:21600,LOGIN_WINDOW_SECONDS:900,MAX_LOGIN_ATTEMPTS:8,MAX_UPLOAD_BYTES:5*1024*1024,PUBLIC_RATE_SECONDS:30,MAX_TEXT:1000};
function P(k){return PropertiesService.getScriptProperties().getProperty(k)||"";}
function DB(){const id=P("PMT_SPREADSHEET_ID");if(!id)throw Error("PMT_SPREADSHEET_ID is not configured");return SpreadsheetApp.openById(id);}
function S(n){return DB().getSheetByName(n);}
function J(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
function now_(){return new Date();}
function clean_(v,max){return String(v==null?"":v).replace(/[\u0000-\u001F\u007F]/g," ").trim().slice(0,max||CFG.MAX_TEXT);}
function email_(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||""));}
function phone_(v){return /^[6-9][0-9]{9}$/.test(String(v||""));}
function roleRank_(r){return ({Support:10,Editor:20,Manager:30,Owner:40}[String(r||"")]||0);}
function roleAllowed_(session,min){return !!session&&roleRank_(session.role)>=roleRank_(min);}
function forbidden_(){return J({ok:false,message:"Forbidden"});}
function requireRole_(s,min){return roleAllowed_(s,min);}
function hash_(password,salt){const b=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(salt)+"\u0000"+String(password),Utilities.Charset.UTF_8);return Utilities.base64EncodeWebSafe(b).replace(/=+$/,'');}
function sha_(text){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text),Utilities.Charset.UTF_8)).replace(/=+$/,'');}
function token_(){return Utilities.getUuid().replace(/-/g,"")+Utilities.getUuid().replace(/-/g,"");}
function auth_(token){if(!token||String(token).length<40)return null;const raw=CacheService.getScriptCache().get("session_"+token);if(!raw)return null;try{return JSON.parse(raw);}catch(e){return null;}}
function logout_(token){CacheService.getScriptCache().remove("session_"+token);return J({ok:true});}
function safeStatus_(sheet,status){const maps={Orders:["Pending","Confirmed","Processing","Shipped","Delivered","Cancelled","Completed"],Repairs:["Pending","Received","Diagnosing","Repairing","Ready","Delivered","Cancelled","Completed"]};const a=maps[sheet]||[];return a.indexOf(String(status))>=0?String(status):"";}

function doGet(e){
  const a=clean_(e&&e.parameter?e.parameter.action:"",60),p=e&&e.parameter?e.parameter:{};
  try{
    if(a==="content")return content_();
    if(a==="track")return track_(clean_(p.ticket,40));
    if(a==="publicProducts")return publicProducts_();
    if(a==="publicCoupons")return publicCoupons_();
    const modules=["dashboard","analytics","homepage","products","orders","repairs","coupons","reviews","notifications","lowStock","users","feedback","activity","customers"];
    if(modules.indexOf(a)>=0){
      const session=auth_(clean_(p.token,160));if(!session)return forbidden_();
      const minimum={dashboard:"Support",analytics:"Support",homepage:"Editor",products:"Manager",orders:"Support",repairs:"Support",coupons:"Manager",reviews:"Manager",notifications:"Support",lowStock:"Support",users:"Owner",feedback:"Support",activity:"Owner",customers:"Support"}[a];
      if(!roleAllowed_(session,minimum))return forbidden_();
      if(a==="dashboard"||a==="analytics")return analytics_();
      if(["homepage","products","orders","repairs","coupons","reviews","notifications","lowStock","users"].indexOf(a)>=0)return ownerModule_(a);
      if(a==="feedback")return feedback_();if(a==="activity")return activity_();if(a==="customers")return customers_();
    }
    return J({ok:true,service:"PMT Owner API",version:"5.1"});
  }catch(err){auditSafe_("get_error",String(err&&err.message||err));return J({ok:false,message:"Server error"});}
}
function doPost(e){
  let b={};try{b=JSON.parse((e.postData&&e.postData.contents)||"{}");}catch(err){return J({ok:false,message:"Invalid request"});}
  const a=clean_(b.action,60);
  try{
    if(a==="adminLogin")return login_(clean_(b.username,80),String(b.password||""));
    if(a==="createRepair")return createRepair_(b.payload||{});
    if(a==="createFeedback")return createFeedback_(b.payload||{});
    if(a==="createOrder")return createOrder_(b.payload||{});
    if(a==="analyticsEvent"){analyticsEvent_(b);return J({ok:true});}
    const session=auth_(b.token);if(!session)return J({ok:false,message:"Unauthorized"});
    if(a==="logout")return logout_(b.token);
    if(a==="saveContent")return requireRole_(session,"Editor")?saveContent_(b.content||{},session):forbidden_();
    if(a==="uploadImage")return requireRole_(session,"Editor")?uploadImage_(b,session):forbidden_();
    if(a==="createBackup")return requireRole_(session,"Owner")?backupCreate_(session):forbidden_();
    if(a==="restoreBackup")return requireRole_(session,"Owner")?restoreBackup_(clean_(b.snapshotId,120),session):forbidden_();
    if(a==="createUser")return requireRole_(session,"Owner")?createUser_(b.payload||{},session):forbidden_();
    if(a==="updateUser")return requireRole_(session,"Owner")?updateUser_(b.payload||{},session):forbidden_();
    if(a==="createProduct")return requireRole_(session,"Manager")?createProduct_(b.payload||{},session):forbidden_();
    if(a==="updateProduct")return requireRole_(session,"Manager")?updateProduct_(b.payload||{},session):forbidden_();
    if(a==="createCoupon")return requireRole_(session,"Manager")?createCoupon_(b.payload||{},session):forbidden_();
    if(a==="updateCoupon")return requireRole_(session,"Manager")?updateCoupon_(b.payload||{},session):forbidden_();
    if(a==="updateOrder")return requireRole_(session,"Manager")?updateOrder_(b.payload||{},session):forbidden_();
    if(a==="updateRepair")return requireRole_(session,"Support")?updateRepair_(b.payload||{},session):forbidden_();
    if(a==="updateReview")return requireRole_(session,"Manager")?updateReview_(b.payload||{},session):forbidden_();
    return J({ok:false,message:"Unknown action"});
  }catch(err){auditSafe_("server_error",String(err&&err.message||err));return J({ok:false,message:"Server error"});}
}

function login_(username,password){
  if(!username||!password||password.length<10)return J({ok:false,message:"Invalid credentials"});
  const cache=CacheService.getScriptCache(),key="login_fail_"+Utilities.base64EncodeWebSafe(username).slice(0,80);let attempts=Number(cache.get(key)||0);
  if(attempts>=CFG.MAX_LOGIN_ATTEMPTS)return J({ok:false,message:"Too many attempts. Try again later."});
  const s=S("Users");if(!s)return J({ok:false,message:"Users sheet is not configured"});const r=s.getDataRange().getValues();let user=null,row=0;
  for(let i=1;i<r.length;i++)if(String(r[i][1]).toLowerCase()===username.toLowerCase()){user=r[i];row=i+1;break;}
  if(!user||String(user[6]||"Active")!=="Active"||hash_(password,user[2])!==String(user[3])){cache.put(key,String(attempts+1),CFG.LOGIN_WINDOW_SECONDS);return J({ok:false,message:"Invalid credentials"});}
  cache.remove(key);const t=token_();cache.put("session_"+t,JSON.stringify({userId:String(user[0]),username:String(user[1]),name:String(user[4]),role:String(user[5]),row:row}),CFG.SESSION_SECONDS);audit_("login",String(user[1]));
  return J({ok:true,token:t,user:{name:String(user[4]),role:String(user[5])},expiresIn:CFG.SESSION_SECONDS});
}

function content_(){const s=S("SiteContent");if(!s)return J({ok:true,content:{}});const r=s.getDataRange().getValues(),o={};for(let i=1;i<r.length;i++)if(r[i][0]){try{o[r[i][0]]=JSON.parse(r[i][1]);}catch(e){o[r[i][0]]=String(r[i][1]);}}return J({ok:true,content:o});}
function saveContent_(c,session){const s=S("SiteContent");if(!s)return J({ok:false,message:"SiteContent sheet missing"});const allowed=["site","home","trust","banners","footer","seo"];const r=s.getDataRange().getValues(),map={};for(let i=1;i<r.length;i++)map[String(r[i][0])]=i+1;Object.keys(c).filter(k=>allowed.indexOf(k)>=0).forEach(k=>{const v=JSON.stringify(c[k]);if(v.length>30000)throw Error("Content block too large");map[k]?s.getRange(map[k],2).setValue(v):s.appendRow([k,v]);});audit_("content_edit",session.username);return J({ok:true});}

function publicRate_(kind,key){const c=CacheService.getScriptCache(),k="pub_"+kind+"_"+Utilities.base64EncodeWebSafe(String(key||"unknown")).slice(0,80);if(c.get(k))return false;c.put(k,"1",CFG.PUBLIC_RATE_SECONDS);return true;}
function createRepair_(p){p=p||{};const ph=clean_(p.phone,10);if(!phone_(ph))return J({ok:false,message:"Invalid phone"});if(!publicRate_("repair",ph))return J({ok:false,message:"Please wait before submitting again."});const s=S("Repairs");if(!s)return J({ok:false,message:"Service unavailable"});const id="PMT-"+new Date().getFullYear()+"-"+Utilities.getUuid().slice(0,8).toUpperCase();s.appendRow([id,now_(),clean_(p.name,80),ph,clean_(p.device,100),clean_(p.issue,500),clean_(p.notes,1000),"Pending","",""]);notification_("repair_received","Repair request "+id+" received",ph);auditSafe_("repair_create",id);return J({ok:true,ticket:id,message:"Repair request received"});}
function createFeedback_(p){p=p||{};const msg=clean_(p.message,1000),rating=Number(p.rating||5);if(msg.length<2||rating<1||rating>5)return J({ok:false,message:"Invalid feedback"});const ph=clean_(p.phone,10);if(ph&&!phone_(ph))return J({ok:false,message:"Invalid phone"});if(!publicRate_("feedback",ph||"anon"))return J({ok:false,message:"Please wait before submitting again."});const s=S("Feedback");if(!s)return J({ok:false,message:"Service unavailable"});s.appendRow([Utilities.getUuid(),now_(),clean_(p.name||"Customer",80),ph,rating,msg,"New"]);notification_("feedback","New customer feedback received");return J({ok:true,message:"Feedback received"});}
function createOrder_(p){
  p=p||{};const name=clean_(p.name,80),ph=clean_(p.phone,10),items=Array.isArray(p.items)?p.items:[];if(!name||!phone_(ph)||!items.length)return J({ok:false,message:"Name, valid phone and at least one item are required"});if(!publicRate_("order",ph))return J({ok:false,message:"Please wait before submitting another order."});
  const ps=S("Products"),os=S("Orders");if(!ps||!os)return J({ok:false,message:"Service unavailable"});const rows=ps.getDataRange().getValues(),map={};for(let i=1;i<rows.length;i++)map[String(rows[i][0])]={row:i+1,name:String(rows[i][1]),price:Number(rows[i][3]||0),stock:Number(rows[i][4]||0)};
  let total=0,cleanItems=[];for(const it of items){const x=map[String(it.id)];const q=Math.max(1,Math.min(99,Number(it.qty)||1));if(!x)return J({ok:false,message:"Product not found: "+clean_(it.id,80)});if(x.stock<q)return J({ok:false,message:x.name+" is out of stock"});total+=x.price*q;cleanItems.push({id:String(it.id),name:x.name,qty:q,price:x.price});}
  const coupon=clean_(p.coupon,40);let discount=0;if(coupon){const cs=S("Coupons");if(cs){const cr=cs.getDataRange().getValues();for(let i=1;i<cr.length;i++){if(String(cr[i][1]).toUpperCase()===coupon.toUpperCase()&&cr[i][5]!==false){const exp=cr[i][4]?new Date(cr[i][4]):null;if(!exp||isNaN(exp.getTime())||exp>=new Date()){const type=String(cr[i][2]||"percent");const val=Number(cr[i][3]||0);discount=type.toLowerCase()==="flat"?Math.min(val,total):Math.min(Math.round(total*val/100),total);}break;}}}}
  const finalTotal=Math.max(total-discount,0),id="PMT-ORD-"+new Date().getFullYear()+"-"+Utilities.getUuid().slice(0,8).toUpperCase();os.appendRow([id,now_(),name,ph,JSON.stringify(cleanItems),finalTotal,"WhatsApp","Pending"]);
  for(const it of cleanItems){const x=map[it.id];ps.getRange(x.row,5).setValue(Math.max(0,x.stock-it.qty));ps.getRange(x.row,7).setValue(now_());}
  upsertCustomer_(name,ph);notification_("order_received","Order "+id+" received",ph);auditSafe_("order_create",id);return J({ok:true,id:id,total:finalTotal,discount:discount,message:"Order received"});
}
function analyticsEvent_(b){const event=clean_(b.event,60),path=clean_(b.path,200);if(!event||!publicRate_("analytics",event+path))return;const s=S("Analytics");if(s)s.appendRow([now_(),event,path,JSON.stringify(b.meta||{}).slice(0,1000)]);}
function analytics_(){const s=S("Analytics");let c={};if(s){const r=s.getDataRange().getValues();for(let i=1;i<r.length;i++){const e=String(r[i][1]);c[e]=(c[e]||0)+1;}}const orders=S("Orders"),repairs=S("Repairs");let orderCount=0,repairCount=0,revenue=0;if(orders){const r=orders.getDataRange().getValues();orderCount=Math.max(0,r.length-1);for(let i=1;i<r.length;i++)revenue+=Number(r[i][5]||0);}if(repairs)repairCount=Math.max(0,repairs.getLastRow()-1);const feedback=S("Feedback")?Math.max(0,S("Feedback").getLastRow()-1):0;const low=moduleData_("Products",x=>({name:String(x[1]),stock:Number(x[4]||0),minimum:Number(x[5]||0)})).filter(x=>x.stock<=x.minimum);return J({ok:true,visitors:c.page_view||0,pageViews:c.page_view||0,shopClicks:c.shop_click||0,repairLeads:c.repair_submit||0,whatsappClicks:c.whatsapp_click||0,feedback,orders:orderCount,repairs:repairCount,revenue,alerts:low.slice(0,10).map(x=>x.name+" is low: "+x.stock+" left"),events:Object.keys(c).map(k=>({name:k,count:c[k]})),daily:[c.page_view||0,c.shop_click||0,c.repair_submit||0,c.whatsapp_click||0]});}

function publicProducts_(){const a=moduleData_("Products",x=>({id:String(x[0]),name:String(x[1]),sku:String(x[2]),price:Number(x[3]||0),stock:Number(x[4]||0),minimum:Number(x[5]||0),updated:String(x[6]||""),icon:String(x[7]||"📱"),category:String(x[8]||"Accessories")})).filter(x=>x.stock>0);return J({ok:true,items:a});}
function publicCoupons_(){const a=moduleData_("Coupons",x=>({id:String(x[0]),code:String(x[1]),type:String(x[2]||"percent"),value:Number(x[3]||0),expires:String(x[4]||""),active:x[5]!==false})).filter(x=>x.active);return J({ok:true,items:a});}
function feedback_(){return J({ok:true,feedback:moduleData_("Feedback",x=>({id:String(x[0]),date:String(x[1]),name:String(x[2]),rating:Number(x[4]||0),message:String(x[5]),status:String(x[6]||"New")}))});}
function activity_(){return J({ok:true,items:moduleData_("ActivityLog",x=>({time:String(x[0]),action:String(x[1]),detail:String(x[2])})).slice(-100).reverse()});}
function customers_(){return J({ok:true,customers:moduleData_("Customers",x=>({id:String(x[0]),name:String(x[1]),phoneMasked:maskPhone_(String(x[2]||"")),orders:Number(x[3]||0),lastActivity:String(x[4]||"")}))});}
function maskPhone_(p){return p.length>=4?"••••••"+p.slice(-4):"••••••••••";}
function track_(id){const s=S("Repairs");if(!s)return J({ok:false,status:"Unavailable"});const r=s.getDataRange().getValues();for(let i=1;i<r.length;i++)if(String(r[i][0])===id)return J({ok:true,status:String(r[i][7]||"Pending"),updated:String(r[i][9]||r[i][1]||"")});return J({ok:false,status:"Not found"});}
function moduleData_(sheet,mapper){const s=S(sheet);if(!s)return [];const r=s.getDataRange().getValues();return r.length>1?r.slice(1).map(mapper):[];}
function ownerModule_(name){
  if(name==="homepage")return J({ok:true,blocks:moduleData_("HomepageBlocks",x=>({id:String(x[0]),type:String(x[1]),title:String(x[2]),enabled:x[3]!==false,position:Number(x[4]||0)}).sort((a,b)=>a.position-b.position))});
  if(name==="products")return J({ok:true,items:moduleData_("Products",x=>({id:String(x[0]),name:String(x[1]),sku:String(x[2]),price:Number(x[3]||0),stock:Number(x[4]||0),minimum:Number(x[5]||0),updated:String(x[6]||""),icon:String(x[7]||"📱"),category:String(x[8]||"Accessories")}))});
  if(name==="orders")return J({ok:true,items:moduleData_("Orders",x=>({id:String(x[0]),date:String(x[1]),customer:String(x[2]),phoneMasked:maskPhone_(String(x[3]||"")),items:String(x[4]),total:Number(x[5]||0),payment:String(x[6]||""),status:String(x[7]||"Pending")}))});
  if(name==="repairs")return J({ok:true,items:moduleData_("Repairs",x=>({id:String(x[0]),date:String(x[1]),name:String(x[2]),phoneMasked:maskPhone_(String(x[3]||"")),device:String(x[4]),issue:String(x[5]),notes:String(x[6]),status:String(x[7]||"Pending"),estimate:Number(x[8]||0),updated:String(x[9]||"")}))});
  if(name==="coupons")return J({ok:true,items:moduleData_("Coupons",x=>({id:String(x[0]),code:String(x[1]),type:String(x[2]||"percent"),value:Number(x[3]||0),expires:String(x[4]||""),active:x[5]!==false}))});
  if(name==="reviews")return J({ok:true,reviews:moduleData_("Reviews",x=>({id:String(x[0]),name:String(x[1]),text:String(x[2]),status:String(x[3]||"Pending"),featured:x[4]===true}))});
  if(name==="notifications")return J({ok:true,items:moduleData_("Notifications",x=>({time:String(x[0]),type:String(x[1]),message:String(x[2]),read:x[3]===true})).slice(-100).reverse()});
  if(name==="lowStock")return J({ok:true,items:moduleData_("Products",x=>({id:String(x[0]),name:String(x[1]),stock:Number(x[4]||0),minimum:Number(x[5]||0)})).filter(x=>x.stock<=x.minimum)});
  if(name==="users")return J({ok:true,users:moduleData_("Users",x=>({id:String(x[0]),name:String(x[4]),role:String(x[5]),status:String(x[6]||"Active")}))});
  return J({ok:true});
}

function createProduct_(p,session){const s=S("Products");if(!s)return J({ok:false,message:"Products sheet missing"});const name=clean_(p.name,100),sku=clean_(p.sku,80),price=Number(p.price),stock=Math.max(0,Number(p.stock)||0),minimum=Math.max(0,Number(p.minimum)||0);if(!name||!isFinite(price)||price<0)return J({ok:false,message:"Invalid product data"});const id="PRD-"+Utilities.getUuid().slice(0,8).toUpperCase();s.appendRow([id,name,sku,price,stock,minimum,now_(),clean_(p.icon||"📱",8),clean_(p.category||"Accessories",60)]);audit_("product_create",id);return J({ok:true,id});}
function updateProduct_(p,session){const s=S("Products");if(!s)return J({ok:false,message:"Products sheet missing"});const id=clean_(p.id,120),r=s.getDataRange().getValues();for(let i=1;i<r.length;i++)if(String(r[i][0])===id){if(p.name!=null)s.getRange(i+1,2).setValue(clean_(p.name,100));if(p.sku!=null)s.getRange(i+1,3).setValue(clean_(p.sku,80));if(p.price!=null)s.getRange(i+1,4).setValue(Math.max(0,Number(p.price)||0));if(p.stock!=null)s.getRange(i+1,5).setValue(Math.max(0,Number(p.stock)||0));if(p.minimum!=null)s.getRange(i+1,6).setValue(Math.max(0,Number(p.minimum)||0));if(p.icon!=null)s.getRange(i+1,8).setValue(clean_(p.icon,8));if(p.category!=null)s.getRange(i+1,9).setValue(clean_(p.category,60));s.getRange(i+1,7).setValue(now_());audit_("product_update",id);return J({ok:true});}return J({ok:false,message:"Product not found"});}
function createCoupon_(p,session){const s=S("Coupons");if(!s)return J({ok:false,message:"Coupons sheet missing"});const code=clean_(p.code,40).toUpperCase(),type=String(p.type||"percent").toLowerCase(),value=Number(p.value);if(!code||["percent","flat"].indexOf(type)<0||!isFinite(value)||value<0)return J({ok:false,message:"Invalid coupon data"});const id="CPN-"+Utilities.getUuid().slice(0,8).toUpperCase();s.appendRow([id,code,type,value,clean_(p.expires,40),p.active!==false]);audit_("coupon_create",id);return J({ok:true,id});}
function updateCoupon_(p,session){const s=S("Coupons");if(!s)return J({ok:false,message:"Coupons sheet missing"});const id=clean_(p.id,120),r=s.getDataRange().getValues();for(let i=1;i<r.length;i++)if(String(r[i][0])===id){if(p.code!=null)s.getRange(i+1,2).setValue(clean_(p.code,40).toUpperCase());if(p.type!=null)s.getRange(i+1,3).setValue(String(p.type).toLowerCase());if(p.value!=null)s.getRange(i+1,4).setValue(Math.max(0,Number(p.value)||0));if(p.expires!=null)s.getRange(i+1,5).setValue(clean_(p.expires,40));if(p.active!=null)s.getRange(i+1,6).setValue(Boolean(p.active));audit_("coupon_update",id);return J({ok:true});}return J({ok:false,message:"Coupon not found"});}
function updateOrder_(p,session){return updateStatus_("Orders",p,"order_update");}
function updateRepair_(p,session){return updateStatus_("Repairs",p,"repair_update");}
function updateStatus_(sheet,p,auditAction){const s=S(sheet);if(!s)return J({ok:false,message:"Unavailable"});const id=clean_(p.id,120),status=safeStatus_(sheet,p.status);if(!id||!status)return J({ok:false,message:"Invalid status update"});const r=s.getDataRange().getValues();for(let i=1;i<r.length;i++)if(String(r[i][0])===id){s.getRange(i+1,8).setValue(status);if(sheet==="Repairs")notification_("repair_status",id+" → "+status);else notification_("order_status",id+" → "+status);audit_(auditAction,id+" → "+status);return J({ok:true});}return J({ok:false,message:"Record not found"});}
function updateReview_(p,session){const s=S("Reviews");if(!s)return J({ok:false,message:"Reviews unavailable"});const id=clean_(p.id,120),status=["Pending","Approved","Rejected"].indexOf(p.status)>=0?p.status:"Pending";const r=s.getDataRange().getValues();for(let i=1;i<r.length;i++)if(String(r[i][0])===id){s.getRange(i+1,4).setValue(status);s.getRange(i+1,5).setValue(Boolean(p.featured));audit_("review_update",id);return J({ok:true});}return J({ok:false,message:"Review not found"});}

function upsertCustomer_(name,phone){const s=S("Customers");if(!s)return;const r=s.getDataRange().getValues();for(let i=1;i<r.length;i++)if(String(r[i][2])===phone){s.getRange(i+1,4).setValue(Number(r[i][3]||0)+1);s.getRange(i+1,5).setValue(now_());return;}s.appendRow([Utilities.getUuid(),clean_(name,80),phone,1,now_()]);}
function notification_(type,message,phone){const text=clean_(message,500),s=S("Notifications");if(s)s.appendRow([now_(),type,text,false]);const email=P("PMT_ALERT_EMAIL");if(email&&email_(email)){try{MailApp.sendEmail({to:email,subject:"PMT: "+type,textBody:text});}catch(e){auditSafe_("email_error",String(e));}}if(phone)sendWhatsApp_(phone,text);}
function sendWhatsApp_(phone,message){const url=P("PMT_WA_WEBHOOK_URL");if(!url||!phone_(String(phone)))return;try{UrlFetchApp.fetch(url,{method:"post",contentType:"application/json",payload:JSON.stringify({phone:String(phone),message:clean_(message,500)}),muteHttpExceptions:true});}catch(e){auditSafe_("whatsapp_error",String(e));}}
function audit_(action,detail){const s=S("ActivityLog");if(s)s.appendRow([now_(),clean_(action,80),clean_(detail,500)]);}
function auditSafe_(a,d){try{audit_(a,d);}catch(e){}}

function uploadImage_(b,session){const data=String(b.base64||"").replace(/^data:[^;]+;base64,/i,"");if(!data)return J({ok:false,message:"Image data missing"});const bytes=Utilities.base64Decode(data);if(bytes.length>CFG.MAX_UPLOAD_BYTES)return J({ok:false,message:"Maximum image size is 5 MB"});const mime=clean_(b.mime,80);if(["image/jpeg","image/png","image/webp"].indexOf(mime)<0)return J({ok:false,message:"Only JPG, PNG and WebP are allowed"});const folder=DriveApp.getFolderById(P("PMT_MEDIA_FOLDER_ID"));const safe=clean_(b.filename||"image",80).replace(/[^a-zA-Z0-9._-]/g,"_");const file=folder.createFile(Utilities.newBlob(bytes,mime,Utilities.getUuid().replace(/-/g,"").slice(0,12)+"-"+safe));file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);audit_("media_upload",file.getId());return J({ok:true,id:file.getId(),url:"https://drive.google.com/uc?export=view&id="+file.getId()});}
function backupCreate_(session){const folder=DriveApp.getFolderById(P("PMT_BACKUP_FOLDER_ID")),data={version:"5.1",createdAt:new Date().toISOString(),sheets:{}};DB().getSheets().forEach(sh=>data.sheets[sh.getName()]=sh.getDataRange().getValues());const body=JSON.stringify(data),checksum=sha_(body),file=folder.createFile("PMT-backup-"+Utilities.formatDate(now_(),Session.getScriptTimeZone(),"yyyyMMdd-HHmmss")+".json",JSON.stringify({checksum,payload:data}),"application/json");audit_("backup_create",file.getId());return J({ok:true,id:file.getId(),name:file.getName(),checksum});}
function restoreBackup_(id,session){const folder=DriveApp.getFolderById(P("PMT_BACKUP_FOLDER_ID"));let files=folder.getFiles(),file=null;while(files.hasNext()){const f=files.next();if(f.getId()===id){file=f;break;}}if(!file)return J({ok:false,message:"Backup not found"});const obj=JSON.parse(file.getBlob().getDataAsString());if(!obj.checksum||sha_(JSON.stringify(obj.payload))!==obj.checksum)return J({ok:false,message:"Backup integrity check failed"});backupCreate_(session);const ss=DB(),payload=obj.payload.sheets||{};Object.keys(payload).forEach(name=>{const sh=ss.getSheetByName(name);if(!sh)throw Error("Unexpected sheet: "+name);const values=payload[name];sh.clearContents();if(values.length&&values[0].length)sh.getRange(1,1,values.length,values[0].length).setValues(values);});audit_("backup_restore",file.getId());return J({ok:true,message:"Backup restored"});}
function createUser_(p,session){const username=clean_(p.username,80),password=String(p.password||""),name=clean_(p.name,80),role=String(p.role||"Support");if(!username||password.length<10||!name||roleRank_(role)<10||roleRank_(role)>roleRank_(session.role))return J({ok:false,message:"Invalid user data"});const s=S("Users");if(!s)return J({ok:false,message:"Users sheet missing"});const salt=Utilities.getUuid(),id=Utilities.getUuid();s.appendRow([id,username,salt,hash_(password,salt),name,role,"Active",now_()]);audit_("user_create",username);return J({ok:true,id});}
function updateUser_(p,session){const s=S("Users");if(!s)return J({ok:false,message:"Users sheet missing"});const id=clean_(p.id,120),r=s.getDataRange().getValues();for(let i=1;i<r.length;i++)if(String(r[i][0])===id){if(p.role&&roleRank_(p.role)>roleRank_(session.role))return forbidden_();if(p.status)s.getRange(i+1,7).setValue(p.status);if(p.name)s.getRange(i+1,5).setValue(clean_(p.name,80));if(p.role)s.getRange(i+1,6).setValue(p.role);audit_("user_update",id);return J({ok:true});}return J({ok:false,message:"User not found"});}

function setupPMT(spreadsheetId,mediaFolderId,backupFolderId,adminUsername,adminPassword,adminName){
  const props=PropertiesService.getScriptProperties();const p=props.getProperties();
  if(spreadsheetId)props.setProperty("PMT_SPREADSHEET_ID",String(spreadsheetId));if(mediaFolderId)props.setProperty("PMT_MEDIA_FOLDER_ID",String(mediaFolderId));if(backupFolderId)props.setProperty("PMT_BACKUP_FOLDER_ID",String(backupFolderId));if(adminUsername)props.setProperty("PMT_OWNER_USERNAME",String(adminUsername));if(adminPassword)props.setProperty("PMT_OWNER_PASSWORD",String(adminPassword));if(adminName)props.setProperty("PMT_OWNER_NAME",String(adminName));
  const pp=props.getProperties(),id=pp.PMT_SPREADSHEET_ID,mf=pp.PMT_MEDIA_FOLDER_ID,bf=pp.PMT_BACKUP_FOLDER_ID,u=pp.PMT_OWNER_USERNAME,pw=pp.PMT_OWNER_PASSWORD,n=pp.PMT_OWNER_NAME||"Owner";
  if(!id||!mf||!bf||!u||!pw||pw.length<10)throw Error("Missing setup values. Configure PMT_SPREADSHEET_ID, PMT_MEDIA_FOLDER_ID, PMT_BACKUP_FOLDER_ID, PMT_OWNER_USERNAME, PMT_OWNER_PASSWORD and PMT_OWNER_NAME.");
  const ss=SpreadsheetApp.openById(id),defs={SiteContent:[["key","json"]],HomepageBlocks:[["id","type","title","enabled","position"]],Products:[["id","name","sku","price","stock","minimum","updated","icon","category"]],Orders:[["id","date","customer","phone","items","total","payment","status"]],Repairs:[["id","date","name","phone","device","issue","notes","status","estimate","updated"]],Coupons:[["id","code","type","value","expires","active"]],Customers:[["id","name","phone","orders","lastActivity"]],Reviews:[["id","name","text","status","featured"]],Feedback:[["id","date","name","phone","rating","message","status"]],Notifications:[["time","type","message","read"]],Users:[["id","username","salt","hash","name","role","status","created"]],Analytics:[["time","event","path","meta"]],ActivityLog:[["time","action","detail"]]};
  Object.keys(defs).forEach(name=>{let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);const headers=defs[name][0],existing=sh.getLastRow()?sh.getRange(1,1,1,Math.max(sh.getLastColumn(),headers.length)).getValues()[0]:[];if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]);else if(sh.getLastColumn()<headers.length)sh.getRange(1,1,1,headers.length).setValues([headers]);});
  const sh=ss.getSheetByName("Users"),rows=sh.getDataRange().getValues();let found=-1;for(let i=1;i<rows.length;i++)if(String(rows[i][1]).toLowerCase()===u.toLowerCase()){found=i+1;break;}const salt=Utilities.getUuid(),h=hash_(pw,salt);if(found<0)sh.appendRow([Utilities.getUuid(),u,salt,h,n,"Owner","Active",now_()]);else sh.getRange(found,3,1,6).setValues([[salt,h,n,"Owner","Active",now_()]]);props.deleteProperty("PMT_OWNER_PASSWORD");auditSafe_("setup","PMT setup complete");return "PMT setup complete.";
}
function installProductionTriggers(){ScriptApp.getProjectTriggers().forEach(t=>ScriptApp.deleteTrigger(t));ScriptApp.newTrigger("scheduledBackup_").timeBased().everyDays(1).atHour(2).create();ScriptApp.newTrigger("lowStockCheck_").timeBased().everyHours(6).create();return "Production triggers installed.";}
function scheduledBackup_(){try{backupCreate_({username:"trigger"});}catch(e){auditSafe_("scheduled_backup_error",String(e));}}
function lowStockCheck_(){try{const low=moduleData_("Products",x=>({name:String(x[1]),stock:Number(x[4]||0),minimum:Number(x[5]||0)})).filter(x=>x.stock<=x.minimum);if(low.length)notification_("low_stock",low.map(x=>x.name+" ("+x.stock+")").join(", "));}catch(e){auditSafe_("low_stock_error",String(e));}}
