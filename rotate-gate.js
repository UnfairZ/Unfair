(() => {
  const gate = document.getElementById('rotate-gate');
  if (!gate) return;

  // Touch devices held upright. Mouse-driven portrait windows keep the normal responsive site.
  const upright = matchMedia('(orientation: portrait) and (hover: none), (orientation: portrait) and (pointer: coarse)');
  const regions = [...document.querySelectorAll('header, main, footer')];

  function sync() {
    const locked = upright.matches;
    document.documentElement.classList.toggle('rotate-locked', locked);
    document.body.classList.toggle('rotate-locked', locked);
    gate.setAttribute('aria-hidden', String(!locked));
    for (const region of regions) {
      if (locked) region.setAttribute('inert', '');
      else region.removeAttribute('inert');
    }
  }

  upright.addEventListener('change', sync);
  sync();
})();
