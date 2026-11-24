(()=>{"use strict";const e=[["Combat",[["silent","Silent Aim","Mouse (Sticky) · 400 studs","V",!0],["aim","Aimblock","Distance · hold F","F",!0],["block","Autoblock","Counter · M1 back","None"],["face-lock","Face Lock","Hold E","E"],["auto-dash","Auto-dash","Tap G","G"],["perfect","Perfect Dash","Tap T","T"]]],["Instant techs",[["lethal","Instant Lethal","Tap Z","Z"],["twisted","Instant Twisted","Tap X","X"]]],["Dash Lab",[["dash-lab","Dash curve","Open the interactive lab"]]],["Blatant",[["cooldown","No Dash Cooldown","Toggle only"],["noclip","Noclip","Toggle only"],["godmode","Godmode","Keybind available","H"],["afk","Anti Afk","Toggle only"],["lethal-dash","Lethal Dash","Toggle only"],["reach","M1 Reach","Toggle only"],["reset","M1 Reset","Keybind available","R"],["halloween","Halloween Auto Collect","Seasonal"]]],["Theme",[["preview-theme","Appearance","Browser theme"]]],["Settings",[["preview-settings","Interface","Browser settings"]]]],t=new Map(e.flatMap((([e,t],n)=>t.map((([t,a,o,i,c])=>[t,{id:t,name:a,summary:o,key:i,on:Boolean(c),page:e,pageIndex:n}]))))),n=e=>"dash-lab"===e||e.startsWith("preview-"),a=e=>document.getElementById(e),o=a("interface"),i=o.querySelector(".stage-canvas"),c=a("hub-nav"),s=a("hub-content"),r=a("hub-window"),d=a("hub-restore"),l=a("hub-find"),u=a("find-query"),p=matchMedia("(prefers-reduced-motion: reduce)"),h=document.createElement("span");h.className="hub-indicator",h.setAttribute("aria-hidden","true"),c.append(h);let b,f,m=0,g="hub",v=!1;function y(e,t,n){const a=document.createElement(e);return t&&(a.className=t),void 0!==n&&(a.textContent=n),"button"===e&&(a.type="button"),a}function k(...e){const t=s.offsetHeight;if(f?.cancel(),s.replaceChildren(...e),p.matches||v||!t)return;const n=s.offsetHeight;Math.abs(t-n)>1&&(f=s.animate([{height:`${t}px`},{height:`${n}px`}],{duration:430,easing:"cubic-bezier(.22,1,.36,1)"}))}function w(){const e=I[m];if(!e.offsetWidth)return;h.style.width=`${e.offsetWidth}px`,h.style.transform=`translateX(${e.offsetLeft}px)`;const t=e.offsetLeft,n=t+e.offsetWidth;t<c.scrollLeft&&(c.scrollLeft=Math.max(0,t-3)),n>c.scrollLeft+c.clientWidth&&(c.scrollLeft=n-c.clientWidth+3)}function L(e){m=e,I.forEach(((t,n)=>t.setAttribute("aria-pressed",String(e===n)))),w()}function E(){a("hub-count").textContent=[...t.values()].filter((e=>e.on)).length}function A(e,t,n){const a=y("button","hub-switch");return a.setAttribute("role","switch"),a.setAttribute("aria-label",e),a.setAttribute("aria-checked",String(t)),a.addEventListener("click",(()=>{const e="true"!==a.getAttribute("aria-checked");a.setAttribute("aria-checked",String(e)),n(e)})),a}function S(e,t){return A(e.name,e.on,(n=>{e.on=n,t&&(t.dataset.on=String(n)),E()}))}// The grid reserves the window's footprint in both states. Only the requested surface is interactive.
const dock = (() => {
  const shell=i.querySelector('.dock-case');
  const smooth=x=>x*x*(3-2*x), clamp=x=>Math.min(1,Math.max(0,x));
  const wide=matchMedia('(min-width:741px)');
  let progress=1, target=1, velocity=0,frame=0,last=0,width=1,height=1,pw=1,ph=1;
  const still=()=>p.matches||v;
  // One pose drives the body, the controls and the pill lettering. The body never crossfades.
  function paint(){
    const u=clamp(progress), arc=Math.sin(u*Math.PI),front=wide.matches&&!still();
    const sx=1-(1-pw/width)*(1-u)**1.6,sy=ph/height+(1-ph/height)*u*u*(2-u);
    const tilt=(front?4*u:0)+67*arc*Math.sin(Math.PI*1.36*u);
    const hinge=`translate3d(0,${-9*arc}px,${21*arc}px) rotateX(${tilt}deg) rotateY(${(front?-2.5*u:0)-6*arc}deg)`;
    const skin=`${hinge} scale(${sx},${sy})`, radius=ph/2+(28-ph/2)*u;
    shell.style.borderRadius=`${radius/sx}px / ${radius/sy}px`;
    shell.style.transform=skin;
    if(progress===target&&velocity===0){
      r.style.removeProperty('transform');r.style.removeProperty('opacity');d.style.removeProperty('transform');d.style.removeProperty('opacity');delete i.dataset.dockRunning;return;
    }
    i.dataset.dockRunning='';r.style.transform=skin;
    // Fade ink only while the panel is actually folding, never during ordinary navigation.
    r.style.opacity=String(smooth(clamp((u-.24)/.44)));
    d.style.transform=`${hinge} scale(${1+.12*arc})`;
    d.style.opacity=String(1-smooth(clamp(u/.37)));
  }
  function measure(){width=Math.max(1,r.offsetWidth);height=Math.max(1,r.offsetHeight);pw=d.offsetWidth||pw;ph=d.offsetHeight||ph;shell.style.width=width+'px';shell.style.height=height+'px';paint()}
  function settle(){cancelAnimationFrame(frame);frame=0;progress=target;velocity=0;last=0;paint()}
  function tick(now){frame=0;if(still()){settle();return}const dt=Math.max(0,now-last)/1000;last=now;
    // Analytic spring: reversing retains velocity; timing is independent of refresh rate.
    const rate=target?35:43,offset=progress-target,impulse=velocity+rate*offset,decay=Math.exp(-rate*dt);
    progress=target+(offset+impulse*dt)*decay;velocity=(velocity-rate*impulse*dt)*decay;
    if(Math.abs(progress-target)<.0008&&Math.abs(velocity)<.03){settle();return}
    paint();frame=requestAnimationFrame(tick);
  }
  function move(toPill){target=toPill?0:1;i.dataset.hubView=toPill?'pill':'hub';
    if(still()||(progress===target&&velocity===0)){settle();return}
    // Both surfaces must be focusable on arrival, even before the first animation frame.
    if(!frame){measure();last=performance.now();frame=requestAnimationFrame(tick)}
  }
  const sizes=new ResizeObserver(measure);sizes.observe(r);sizes.observe(d);wide.addEventListener('change',measure);
  p.addEventListener('change',()=>{if(still())settle();else measure()});
  new MutationObserver(()=>{if(still())settle();else measure()}).observe(o,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&frame)settle()});
  return {move};
})();

function x(target,focus=false){
  if(g===target)return;
  const open=target==='hub', transfer=focus||(open?d:r).contains(document.activeElement);
  if(l.open)l.close();b?.cancel();f?.cancel();g=target;
  r.inert=!open;d.inert=open;d.setAttribute('aria-expanded',String(open));
  dock.move(!open);
  if(open)w();
  a('stage-hint').textContent=open?'Click a card, toggle a switch, or try Quick find.':'Click the pill to reopen the window.';
  if(transfer)(open?a('hub-minimize'):d).focus({preventScroll:true});
}

function C(a,o=!0){L(a);const i=y("div","hub-grid");for(const[o,[c]]of e[a][1].entries()){const e=t.get(c),a=y("div","hub-card");a.style.setProperty("--card-order",o),a.dataset.on=String(e.on);const s=y("button","hub-card-open");s.append(y("strong","",e.name),y("small","",e.summary)),s.addEventListener("click",(()=>T(e))),a.append(s),e.key&&a.append(y("span","hub-chip",e.key)),n(c)||a.append(S(e,a));const r=y("button","hub-chevron","›");r.setAttribute("aria-label",`Open ${e.name}`),r.tabIndex=-1,r.addEventListener("click",(()=>T(e))),a.append(r),i.append(a)}o?k(i):s.replaceChildren(i),!o||p.matches||v||i.classList.add("hub-grid-enter")}function T(t,i=!0){"hub"!==g&&x("hub"),L(t.pageIndex);const c=y("div","hub-detail-top"),d=y("button","hub-icon","‹");d.setAttribute("aria-label",`Back to ${t.page}`),d.addEventListener("click",(()=>{C(t.pageIndex),s.querySelectorAll(".hub-card-open")[e[t.pageIndex][1].findIndex((([e])=>e===t.id))]?.focus({preventScroll:!0})}));const l=y("h2");l.append(y("span","",`${t.page} › `),t.name),c.append(d,l),t.key&&c.append(y("span","hub-chip",t.key)),n(t.id)||c.append(S(t));const u=y("div","hub-group");if(u.append(y("h3","","Controls")),["dash-lab","lethal","twisted"].includes(t.id)){const e=y("a","hub-row","Open Dash Lab ↗");e.href="#preview",e.addEventListener("click",(()=>{a("tab-dash").click(),"dash-lab"!==t.id&&document.querySelector(`[data-pattern="${t.id}"]`).click()})),u.append(e)}else if("preview-theme"===t.id){const e=y("div","hub-row","High-contrast borders");e.append(A("High-contrast borders",r.classList.contains("high-contrast"),(e=>r.classList.toggle("high-contrast",e)))),u.append(e)}else if("preview-settings"===t.id){const e=y("div","hub-row","Reduce motion");e.append(A("Reduce menu motion",v,(e=>{v=e,o.classList.toggle("no-menu-motion",e),b?.cancel(),f?.cancel()}))),u.append(e)}else{const e=y("div","hub-row"),n=y("output","",t.on?"On":"Off");e.append(y("span","","State"),n),c.querySelector(".hub-switch").addEventListener("click",(()=>{n.value=t.on?"On":"Off"})),u.append(e)}k(c,u,y("p","hub-detail-note","Changes apply here, not in Roblox.")),i&&d.focus({preventScroll:!0})}const I=e.map((([e],t)=>{const n=y("button","",e);return n.addEventListener("click",(()=>C(t))),c.append(n),n}));function D(){const e=u.value.trim().toLowerCase(),n=[...t.values()].filter((t=>`${t.name} ${t.page}`.toLowerCase().includes(e))),o=a("find-results");o.replaceChildren(),n.length||o.append(y("p","find-empty","No matching features."));for(const t of n.slice(0,e?20:6)){const e=y("button","",t.name);e.append(y("small","",t.page)),e.addEventListener("click",(()=>{l.close(),T(t)})),o.append(e)}}function $(){"hub"===g&&(l.open?l.close():(u.value="",D(),l.show(),u.focus()))}new ResizeObserver(w).observe(c),document.fonts.ready.then(w),a("find-open").addEventListener("click",$),a("find-close").addEventListener("click",(()=>{l.close(),a("find-open").focus()})),u.addEventListener("input",D),u.addEventListener("keydown",(e=>{"Enter"===e.key&&a("find-results").querySelector("button")?.click(),"ArrowDown"===e.key&&(e.preventDefault(),a("find-results").querySelector("button")?.focus())})),document.addEventListener("keydown",(e=>{"Escape"===e.key&&l.open&&(l.close(),a("find-open").focus()),(e.ctrlKey||e.metaKey)&&"k"===e.key.toLowerCase()&&o.contains(document.activeElement)&&"hub"===g&&(e.preventDefault(),$())})),a("hub-minimize").addEventListener("click",(()=>x("pill",!0))),d.addEventListener("click",(()=>x("hub",!0))),document.querySelectorAll("[data-hub-page]").forEach((t=>t.addEventListener("click",(n=>{if(n.ctrlKey||n.metaKey||n.shiftKey||n.altKey)return;const a=e.findIndex((([e])=>e===t.dataset.hubPage));a<0||("hub"!==g&&x("hub"),C(a),I[a].focus({preventScroll:!0}))})))),p.addEventListener("change",(()=>{p.matches&&(b?.cancel(),f?.cancel())})),E(),C(0,!1),d.inert=!0,d.setAttribute("aria-expanded","true"),d.hidden=!1})();
