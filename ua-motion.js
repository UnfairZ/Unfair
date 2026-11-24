(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');
  const stage=document.querySelector('.emblem-stage'),replay=document.querySelector('.logo-replay');
  if(stage&&replay){
    replay.hidden=false;
    replay.addEventListener('click',()=>{
      if(reduced.matches)return;
      // Restart the ink layers, not the page or the focused button.
      stage.getAnimations({subtree:true}).filter(a=>a instanceof CSSAnimation).forEach(a=>{a.currentTime=0;a.play()});
    });
    let next=null,frame=0;const reset=()=>{if(frame)cancelAnimationFrame(frame);frame=0;next=null;stage.style.removeProperty('--tilt-x');stage.style.removeProperty('--tilt-y')};
    stage.addEventListener('pointermove',e=>{if(!fine.matches||reduced.matches||e.pointerType==='touch')return;next=[e.clientX,e.clientY];if(frame)return;frame=requestAnimationFrame(()=>{frame=0;const r=stage.getBoundingClientRect();stage.style.setProperty('--tilt-y',((next[0]-r.left)/r.width*12-6).toFixed(2)+'deg');stage.style.setProperty('--tilt-x',(4-(next[1]-r.top)/r.height*8).toFixed(2)+'deg')})});
    stage.addEventListener('pointerleave',reset);reduced.addEventListener('change',reset);
  }
  // Paint an underline beneath the selected model view; no extra tab stop or synthetic click.
  const modes=document.querySelector('.modes');if(modes){const track=document.createElement('i');track.className='view-cursor';track.ariaHidden='true';modes.append(track);const move=()=>{const b=modes.querySelector('[aria-pressed="true"]');if(!b)return;track.style.width=(b.offsetWidth*.46)+'px';track.style.transform=`translateX(${b.offsetLeft+b.offsetWidth*.27}px)`};new MutationObserver(move).observe(modes,{subtree:true,attributes:true,attributeFilter:['aria-pressed']});new ResizeObserver(move).observe(modes);move()}
})();
