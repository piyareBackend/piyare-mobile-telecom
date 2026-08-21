/* PMT cart — server revalidates price, stock and coupon before accepting an order. */
let PRODUCTS=[
{id:"1",name:"Tempered Glass Screen Guard",cat:"Screen Protection",price:149,old:249,icon:"🛡️",stock:24},
{id:"2",name:"Shockproof Silicone Case",cat:"Cases & Covers",price:199,old:349,icon:"📱",stock:5},
{id:"3",name:"20W Fast Charger (Type-C)",cat:"Chargers",price:399,old:599,icon:"🔌",stock:18},
{id:"4",name:"1.5m Braided USB-C Cable",cat:"Cables",price:149,old:0,icon:"🔗",stock:30},
{id:"5",name:"Wired Earphones with Mic",cat:"Audio",price:249,old:399,icon:"🎧",stock:12},
{id:"6",name:"Bluetooth Neckband",cat:"Audio",price:699,old:999,icon:"🎶",stock:9},
{id:"7",name:"10000mAh Power Bank",cat:"Power",price:899,old:1299,icon:"🔋",stock:3},
{id:"8",name:"Ring Light Phone Holder",cat:"Accessories",price:349,old:499,icon:"💡",stock:14}
];
let cart=JSON.parse(localStorage.getItem("pmt-cart")||"[]"),appliedCoupon=null;
function saveCart(){localStorage.setItem("pmt-cart",JSON.stringify(cart));}
function addToCart(id){const p=PRODUCTS.find(x=>String(x.id)===String(id));if(!p)return;const x=cart.find(x=>String(x.id)===String(id));if(x)x.qty=Math.min(x.qty+1,p.stock);else cart.push({...p,qty:1});saveCart();renderCart();openCart();}
function changeQty(id,d){const x=cart.find(x=>String(x.id)===String(id));if(!x)return;x.qty+=d;if(x.qty<=0)cart=cart.filter(i=>String(i.id)!==String(id));saveCart();renderCart();}
function subtotal(){return cart.reduce((s,i)=>s+Number(i.price)*Number(i.qty),0);}
function openCart(){document.getElementById("drawer")?.classList.add("open");document.getElementById("overlay")?.classList.add("open");}
function closeCart(){document.getElementById("drawer")?.classList.remove("open");document.getElementById("overlay")?.classList.remove("open");}
function renderCart(){
 const c=document.getElementById("cartCount");if(c)c.textContent=cart.reduce((s,i)=>s+i.qty,0);
 const b=document.getElementById("cartBody"),f=document.getElementById("cartFoot");if(!b||!f)return;
 if(!cart.length){b.innerHTML='<div class="empty-cart">🛒<br><br>Cart khali hai.<br>Shop se kuch add karo!</div>';f.innerHTML="";return;}
 b.innerHTML=cart.map(i=>`<div class="cart-item"><div class="ic">${escapeHtml(i.icon)}</div><div class="cart-item-info"><h5>${escapeHtml(i.name)}</h5><div class="p">₹${Number(i.price)} × ${Number(i.qty)}</div></div><div class="qty-ctrl"><button data-minus="${escapeHtml(i.id)}">−</button><span>${i.qty}</span><button data-plus="${escapeHtml(i.id)}">+</button></div></div>`).join("");
 const discount=appliedCoupon?(appliedCoupon.type==="flat"?Number(appliedCoupon.value):Math.round(subtotal()*Number(appliedCoupon.value)/100)):0;
 const total=Math.max(0,subtotal()-discount);
 f.innerHTML=`<div class="coupon-apply"><input id="couponInput" placeholder="Coupon code"><button id="couponBtn">Apply</button></div><div id="couponMsg"></div><div class="sum-row"><span>Subtotal</span><span>₹${subtotal()}</span></div>${discount?`<div class="sum-row"><span>Discount</span><span>−₹${discount}</span></div>`:""}<div class="sum-row total"><span>Total</span><span>₹${total}</span></div><button class="btn btn-primary btn-full" id="checkoutBtn" style="margin-top:14px">Confirm Order</button>`;
 b.querySelectorAll("[data-minus]").forEach(x=>x.onclick=()=>changeQty(x.dataset.minus,-1));b.querySelectorAll("[data-plus]").forEach(x=>x.onclick=()=>changeQty(x.dataset.plus,1));
 document.getElementById("couponBtn").onclick=applyCoupon;document.getElementById("checkoutBtn").onclick=checkoutOrder;
}
async function applyCoupon(){const input=document.getElementById("couponInput"),msg=document.getElementById("couponMsg");const code=(input?.value||"").trim().toUpperCase();if(!code)return;if(!window.PMT_API_URL){msg.textContent="API not configured.";return;}try{const d=await pmtGet("publicCoupons");const x=(d?.items||[]).find(c=>String(c.code).toUpperCase()===code);if(!x){appliedCoupon=null;msg.textContent="Invalid or expired coupon.";}else{appliedCoupon=x;msg.textContent="Coupon applied.";}renderCart();}catch(e){msg.textContent="Unable to validate coupon.";}}
async function checkoutOrder(){
 if(!cart.length)return;
 const name=prompt("Your name:");if(!name)return;const phone=prompt("10-digit mobile number:");if(!phone||!/^[6-9][0-9]{9}$/.test(phone))return alert("Valid 10-digit mobile number required.");
 if(!window.PMT_API_URL)return alert("API not configured.");
 try{const d=await pmtPost({action:"createOrder",payload:{name,phone,items:cart.map(i=>({id:i.id,qty:i.qty})),coupon:appliedCoupon?.code||""}});if(!d.ok)throw Error(d.message||"Order failed");alert("Order received. ID: "+d.id+"\nTotal: ₹"+d.total);cart=[];appliedCoupon=null;saveCart();renderCart();closeCart();}catch(e){alert(e.message||"Order failed. Please try again.");}
}
document.getElementById("cartOpen")?.addEventListener("click",openCart);document.getElementById("cartClose")?.addEventListener("click",closeCart);document.getElementById("overlay")?.addEventListener("click",closeCart);renderCart();
