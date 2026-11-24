/* Impulse 01. Parametric solid geometry, batched by moving assembly. */
(() => {
  'use strict';
  const canvas=document.querySelector('#rotor'); if(!canvas)return;
  const box=canvas.parentElement, figure=box.closest('.specimen'), poster=box.querySelector('img');
  const switches=[...figure.querySelectorAll('[data-view]')], pause=figure.querySelector('.pause');
  const pref=matchMedia('(prefers-reduced-motion: reduce)');
  let gl;try{gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:false})}catch{}
  const TAU=Math.PI*2, cos=Math.cos,sin=Math.sin;
  let mode=0,time=0,spread=0,turbo=0,rotation=0,dx=0,dy=0,yaw=0,pitch=0,paused=pref.matches,seen=true,frame=0,last=0,needs=true,drag=null,live=false;
  const viewNames=['Orbit','Section','Drive'];
  function label(){figure.querySelector('.view-name').textContent=viewNames[mode];pause.textContent=paused?'Play motion':'Pause motion';pause.setAttribute('aria-pressed',String(paused));}
  function modelMode(i){mode=i;switches.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));if(!live)poster.src=`assets/core-${i}.webp`;label();wake()}
  switches.forEach((b,i)=>b.addEventListener('click',()=>modelMode(i)));
  pause.addEventListener('click',()=>{paused=!paused;last=0;label();wake()});pref.addEventListener('change',()=>{paused=pref.matches;label();wake()});label();
  function still(){live=false;cancelAnimationFrame(frame);frame=0;figure.classList.remove('rendering');canvas.hidden=true;pause.hidden=true;figure.querySelector('.gesture').textContent='SELECT A VIEW';poster.src=`assets/core-${mode}.webp`;}
  if(!gl){still();return}
  const vs=`attribute vec3 pos,norm,ink;attribute float metal;uniform mat4 assembly;uniform vec2 ratio;varying vec3 vP,vN,vC,vL;varying float vM;void main(){vec4 p=assembly*vec4(pos,1.); vP=p.xyz;vL=pos;vN=mat3(assembly)*norm;vC=ink;vM=metal;float w=8.2-p.z;gl_Position=vec4(p.xy*ratio,p.z*(-.99)+6.1,w);}`;
  const fs=`precision highp float;varying vec3 vP,vN,vC,vL;varying float vM;
  float panel(vec3 r,vec3 axis,float softness,float width){return smoothstep(width-softness,width,dot(r,normalize(axis)));}
  void main(){vec3 n=normalize(vN),v=normalize(vec3(0.,0.,8.2)-vP),r=reflect(-v,n);float f=pow(1.-abs(dot(n,v)),4.);float k=max(dot(n,normalize(vec3(-.7,.9,.7))),0.);float fill=max(dot(n,normalize(vec3(.9,-.3,.4))),0.);
  vec3 env=mix(vec3(.025,.033,.05),vec3(.50,.56,.64),smoothstep(-.2,.98,r.y));
  env+=vec3(1.05,1.05,1.05)*panel(r,vec3(-1.,.8,.4),.17,.81)+vec3(.83,.35,.38)*panel(r,vec3(.8,-.2,.4),.19,.79);
  env+=vec3(.70,.85,1.)*(1.-smoothstep(.025,.16,abs(r.y+.41*r.x-.06)))*smoothstep(-.65,.4,r.z);
  float grain=(sin(length(vL.xy)*2600.)*.5+.5)*.028;vec3 c=vC*(.30+.77*k+.29*fill+grain)+env*(mix(vec3(.09),vC,.64)*vM+f*.28);
  if(vM>1.8){float p=smoothstep(.45,.0,length(vL.xy));c=vec3(.76,.005,.019)*(.54+.24*k+p*.63)+env*(.22+.52*f)+vec3(.22,.004,.012)*p;}
  if(vM<0.)c=vC;gl_FragColor=vec4(pow(max(c,0.),vec3(.80)),1.);}`.replace('smoothstep(.45,.0,length(vL.xy))','(1.-smoothstep(.0,.45,length(vL.xy)))');
  function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('shader');return s}
  let program;try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('link');gl.useProgram(program)}catch{still();return}
  const geom=[[],[],[],[]];let g=0;
  const lacquer=[.83,.007,.023,.91],dark=[.046,.057,.072,.98],ti=[.46,.49,.52,1.18],carbon=[.023,.027,.032,.72],pale=[.86,.86,.86,.74],bright=[1,.035,.07,-1],lens=[.71,.014,.034,2.2];
  function vert(p,n,c){geom[g].push(...p,...n,...c)}
  function quad(a,b,c,d,na,nb,ink){vert(a,na,ink);vert(b,nb,ink);vert(c,nb,ink);vert(a,na,ink);vert(c,nb,ink);vert(d,na,ink)}
  function shell(profile,col,start=0,end=TAU,steps=112,x=0,y=0){const at=([r,z],a)=>[x+r*cos(a),y+r*sin(a),z];for(let i=0;i<steps;i++){const a=start+(end-start)*i/steps,b=start+(end-start)*(i+1)/steps;for(let j=1;j<profile.length;j++){const u=profile[j-1],v=profile[j],dr=v[0]-u[0],dz=v[1]-u[1],len=Math.hypot(dr,dz),nr=dz/len,nz=-dr/len;if(!len)continue;quad(at(u,a),at(u,b),at(v,b),at(v,a),[nr*cos(a),nr*sin(a),nz],[nr*cos(b),nr*sin(b),nz],col)}}
  if(end-start<TAU-.0001){for(const [a,sg] of [[start,-1],[end,1]]){const n=[-sin(a)*sg,cos(a)*sg,0],mean=profile.slice(1).reduce((s,p)=>[s[0]+p[0],s[1]+p[1]],[0,0]).map(s=>s/(profile.length-1));for(let j=1;j<profile.length;j++){vert(at(mean,a),n,col);vert(at(profile[j-1],a),n,col);vert(at(profile[j],a),n,col)}}}}
  function band(inner,outer,z,h,col,b=.022,a=0,e=TAU,n=112,x=0,y=0){b=Math.min(b,(outer-inner)*.45,h*.4);const l=z-h/2,r=z+h/2; shell([[inner+b,l],[outer-b,l],[outer,l+b],[outer,r-b],[outer-b,r],[inner+b,r],[inner,r-b],[inner,l+b],[inner+b,l]],col,a,e,n,x,y)}
  function repeat(n,fn){for(let i=0;i<n;i++)fn(i*TAU/n,i)}
  // Outer flywheel: black isolation channel, four anodized shrouds, engraved scale and recessed fasteners.
  band(1.59,1.88,0,.35,dark,.054);band(1.71,1.895,-.131,.046,ti);band(1.59,1.637,.13,.12,ti);
  repeat(4,(a)=>{band(1.66,1.932,.107,.29,lacquer,.052,a+.028,a+TAU/4-.028,38);band(1.805,1.837,.262,.014,dark,.004,a+.19,a+1.26,26)});
  repeat(96,(a,i)=>band(i%8===0?1.69:1.71,i%8===0?1.781:1.742,.255,.014,i%8===0?pale:carbon,.002,a,a+.009,1));
  repeat(12,(a)=>{let x=1.83*cos(a+.08),y=1.83*sin(a+.08);band(.002,.044,.255,.02,carbon,.006,0,TAU,16,x,y);band(.016,.033,.268,.016,ti,.003,0,TAU,6,x,y)});
  g=1;band(1.16,1.54,0,.29,dark,.052);band(1.48,1.555,-.083,.055,ti);band(1.32,1.525,.115,.14,ti,.037);band(1.23,1.31,.149,.08,lacquer);band(1.151,1.21,.11,.12,carbon);
  repeat(60,(a,i)=>band(1.361,1.48,.186,.015,i%5===0?lacquer:carbon,.002,a,a+.044,3));
  g=2;band(.65,1.095,-.006,.36,carbon,.07);band(1.01,1.105,.122,.096,ti);band(.66,.748,.18,.105,ti);repeat(23,a=>{band(.755,1.005,.176,.093,dark,.017,a+.025,a+.22,8);band(.80,.965,.226,.01,lacquer,.004,a+.06,a+.087,2)});
  g=3;band(.003,.619,-.01,.61,carbon,.07);band(.47,.605,.279,.153,ti,.029);band(.376,.473,.345,.073,dark);band(.337,.38,.369,.04,bright,.01);shell([[.355,.366],[.347,.394],[.321,.416],[.263,.45],[.165,.479],[.003,.498],[0,.498]],lens);
  repeat(32,(a,i)=>band(.498,i%4===0?.571:.54,.356,.013,carbon,.003,a,a+.029,2));
  const attrs=['pos','norm','ink','metal'].map(k=>gl.getAttribLocation(program,k));attrs.forEach(k=>gl.enableVertexAttribArray(k));
  const batches=geom.map(arr=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.STATIC_DRAW);return {b,count:arr.length/10}});geom.length=0;
  const mat=gl.getUniformLocation(program,'assembly'),ratio=gl.getUniformLocation(program,'ratio');
  function matrix(rx,ry,rz,zOffset,phase){const a=cos(rx),b=sin(rx),c=cos(ry),d=sin(ry),e=cos(rz),f=sin(rz),X=[e*c,f*c,-d],Y=[e*d*b-f*a,f*d*b+e*a,c*b],Z=[e*d*a+f*b,f*d*a-e*b,c*a],cp=cos(phase),sp=sin(phase);return [...X.map((v,i)=>v*cp+Y[i]*sp),0,...Y.map((v,i)=>v*cp-X[i]*sp),0,...Z,0,zOffset*.74,zOffset*.37,zOffset*.48,1]}
  function render(){const w=canvas.width,h=canvas.height,unit=Math.min(w/4.55,h/4.15)*8.2/(1+spread*.15);gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform2f(ratio,2*unit/w,2*unit/h);
    const wave=sin(time*.34),rx=.29+pitch+.17*wave+turbo*.3,ry=-.53+yaw+cos(time*.28)*.12-spread*.39,rz=-.34+turbo*.78;
    batches.forEach(({b,count},i)=>{const lift=(i-1.5)*spread*.72;
      let x=rx+[.06,.48,-.38,.08][i]*(1-spread*.86),y=ry+[-.29,.41,.21,.16][i]*(1-spread*.8);if(i===1)y+=turbo*(.76+.47*sin(time*1.2));if(i===2)x+=turbo*(.41+.64*cos(time*1.4));
      gl.uniformMatrix4fv(mat,false,matrix(x,y,rz,lift,rotation*[.27,-.54,1,-.26][i]));gl.bindBuffer(gl.ARRAY_BUFFER,b);attrs.forEach((k,j)=>gl.vertexAttribPointer(k,j===3?1:3,gl.FLOAT,false,40,j*12));gl.drawArrays(gl.TRIANGLES,0,count)});
  }
  function tick(now){frame=0;if(!live||!seen||document.hidden)return;const dt=last?Math.min(.07,(now-last)/1000):0;if(dt>0&&dt<.026&&!needs){frame=requestAnimationFrame(tick);return}last=now;needs=false;const snap=paused||pref.matches,k=snap?1:1-Math.exp(-Math.max(.016,dt)*6);spread+=((mode===1?1:0)-spread)*k;turbo+=((mode===2?1:0)-turbo)*k;yaw+=(dx-yaw)*k;pitch+=(dy-pitch)*k;if(!paused){time+=dt;rotation+=dt*(.16+turbo*1.3)}render();if(!paused)frame=requestAnimationFrame(tick)}
  function wake(){needs=true;if(live&&seen&&!document.hidden&&!frame)frame=requestAnimationFrame(tick)}
  function resize(){let d=Math.min(devicePixelRatio||1,1.65,1100/Math.max(1,box.clientWidth));canvas.width=Math.max(1,Math.round(box.clientWidth*d));canvas.height=Math.max(1,Math.round(box.clientHeight*d));wake()}
  gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);live=true;canvas.hidden=false;figure.classList.add('rendering');resize();render();
  new ResizeObserver(resize).observe(box);new IntersectionObserver(([item])=>{seen=item.isIntersecting;last=0;if(seen)wake();else{cancelAnimationFrame(frame);frame=0}}).observe(figure);
  document.addEventListener('visibilitychange',()=>{last=0;wake()});canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();still()});
  canvas.addEventListener('pointerdown',e=>{if(drag||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;dx+=(e.clientX-drag.x)*.009;dy=Math.max(-1.35,Math.min(1.35,dy+(e.clientY-drag.y)*.007));drag.x=e.clientX;drag.y=e.clientY;wake()});canvas.addEventListener('lostpointercapture',()=>drag=null);
  canvas.addEventListener('keydown',e=>{if(e.key==='Home'){dx=dy=0}else if(e.key==='ArrowRight')dx+=.22;else if(e.key==='ArrowLeft')dx-=.22;else if(e.key==='ArrowUp')dy-=.17;else if(e.key==='ArrowDown')dy+=.17;else return;e.preventDefault();wake()});
})();
