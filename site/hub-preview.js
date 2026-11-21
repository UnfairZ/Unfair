(() => {
  'use strict';
  const pages = [
    ['Combat', [
      ['silent', 'Silent Aim', 'Mouse (Sticky) · 400 studs', 'V', true],
      ['aim', 'Aimblock', 'Distance · hold F', 'F', true],
      ['block', 'Autoblock', 'Counter · M1 back', 'None'],
      ['face-lock', 'Face Lock', 'Hold E', 'E'],
      ['auto-dash', 'Auto-dash', 'Tap G', 'G'],
      ['perfect', 'Perfect Dash', 'Tap T', 'T'],
    ]],
    ['Instant techs', [['lethal', 'Instant Lethal', 'Tap Z', 'Z'], ['twisted', 'Instant Twisted', 'Tap X', 'X']]],
    ['Dash Lab', [['dash-lab', 'Dash curve', 'Open the interactive lab']]],
    ['Blatant', [
      ['cooldown', 'No Dash Cooldown', 'Toggle only'], ['noclip', 'Noclip', 'Toggle only'],
      ['godmode', 'Godmode', 'Keybind available', 'H'], ['afk', 'Anti Afk', 'Toggle only'],
      ['lethal-dash', 'Lethal Dash', 'Toggle only'], ['reach', 'M1 Reach', 'Toggle only'],
      ['reset', 'M1 Reset', 'Keybind available', 'R'], ['halloween', 'Halloween Auto Collect', 'Seasonal'],
    ]],
    ['Theme', [['preview-theme', 'Appearance', 'Browser theme']]],
    ['Settings', [['preview-settings', 'Interface', 'Browser settings']]],
  ];
  const byId = new Map(pages.flatMap(([page, cards], pageIndex) => cards.map(([id, name, summary, key, on]) =>
    [id, { id, name, summary, key, on: Boolean(on), page, pageIndex }])));
  const isDisplayOnly = id => id === 'dash-lab' || id.startsWith('preview-');
  const $ = id => document.getElementById(id);
  const stage = $('interface');
  const nav = $('hub-nav');
  const content = $('hub-content');
  const hub = $('hub-window');
  const pill = $('hub-restore');
  const find = $('hub-find');
  const query = $('find-query');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const indicator = document.createElement('span');
  indicator.className = 'hub-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  nav.append(indicator);
  let pageIndex = 0;
  let screen = 'hub';
  let transition;
  let sizeTransition;
  let noMotion = false;

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    if (tag === 'button') element.type = 'button';
    return element;
  }

  function animate(element, keyframes, duration = 360) {
    transition?.cancel();
    if (!motion.matches && !noMotion) {
      transition = element.animate(keyframes, { duration, easing: 'cubic-bezier(.23,1,.32,1)' });
    }
  }

  function swapContent(...nodes) {
    const first = content.getBoundingClientRect().height;
    sizeTransition?.cancel();
    content.replaceChildren(...nodes);
    if (motion.matches || noMotion || !first) return;
    const last = content.getBoundingClientRect().height;
    if (Math.abs(first - last) > 1) {
      sizeTransition = content.animate([{ height: `${first}px` }, { height: `${last}px` }],
        { duration: 430, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
  }

  function alignNav() {
    const selected = navButtons[pageIndex];
    if (!selected.offsetWidth) return;
    indicator.style.width = `${selected.offsetWidth}px`;
    indicator.style.transform = `translateX(${selected.offsetLeft}px)`;
    const left = selected.offsetLeft;
    const right = left + selected.offsetWidth;
    if (left < nav.scrollLeft) nav.scrollLeft = Math.max(0, left - 3);
    if (right > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = right - nav.clientWidth + 3;
  }

  function setPage(index) {
    pageIndex = index;
    navButtons.forEach((button, position) => button.setAttribute('aria-pressed', String(index === position)));
    alignNav();
  }

  function setHint(message) { $('stage-hint').textContent = message; }
  function count() { $('hub-count').textContent = [...byId.values()].filter(feature => feature.on).length; }

  function toggle(label, active, update) {
    const button = make('button', 'hub-switch');
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-checked', String(active));
    button.addEventListener('click', () => {
      const next = button.getAttribute('aria-checked') !== 'true';
      button.setAttribute('aria-checked', String(next));
      update(next);
    });
    return button;
  }

  function featureToggle(feature, card) {
    return toggle(feature.name, feature.on, next => {
      feature.on = next;
      if (card) card.dataset.on = String(next);
      count();
    });
  }

  function switchScreen(view, focus = false) {
    if (find.open) find.close();
    screen = view;
    sizeTransition?.cancel();
    hub.hidden = view !== 'hub';
    pill.hidden = view !== 'pill';
    if (view === 'hub') alignNav();
    const element = view === 'hub' ? hub : pill;
    animate(element, [
      { opacity: 0, transform: 'translateY(14px) scale(.96)' },
      { opacity: 1, transform: 'translateY(-2px) scale(1.003)', offset: .62 },
      { opacity: 1, transform: 'none' },
    ], 430);
    setHint(view === 'pill' ? 'Click the pill to reopen the window.' : 'Click a card, toggle a switch, or try Quick find.');
    if (focus) (view === 'pill' ? pill : navButtons[pageIndex]).focus({ preventScroll: true });
  }

  function showPage(index, withMotion = true) {
    setPage(index);
    const grid = make('div', 'hub-grid');
    for (const [position, [id]] of pages[index][1].entries()) {
      const feature = byId.get(id);
      const card = make('div', 'hub-card');
      card.style.setProperty('--card-order', position);
      card.dataset.on = String(feature.on);
      const open = make('button', 'hub-card-open');
      open.append(make('strong', '', feature.name), make('small', '', feature.summary));
      open.addEventListener('click', () => openFeature(feature));
      card.append(open);
      if (feature.key) card.append(make('span', 'hub-chip', feature.key));
      if (!isDisplayOnly(id)) card.append(featureToggle(feature, card));
      const arrow = make('button', 'hub-chevron', '›');
      arrow.setAttribute('aria-label', `Open ${feature.name}`);
      arrow.tabIndex = -1;
      arrow.addEventListener('click', () => openFeature(feature));
      card.append(arrow);
      grid.append(card);
    }
    swapContent(grid);
    if (withMotion && !motion.matches && !noMotion) grid.classList.add('hub-grid-enter');
  }

  function openFeature(feature, focus = true) {
    if (screen !== 'hub') switchScreen('hub');
    setPage(feature.pageIndex);
    const top = make('div', 'hub-detail-top');
    const back = make('button', 'hub-icon', '‹');
    back.setAttribute('aria-label', `Back to ${feature.page}`);
    back.addEventListener('click', () => {
      showPage(feature.pageIndex);
      content.querySelectorAll('.hub-card-open')[pages[feature.pageIndex][1].findIndex(([id]) => id === feature.id)]?.focus({ preventScroll: true });
    });
    const title = make('h2');
    title.append(make('span', '', `${feature.page} › `), feature.name);
    top.append(back, title);
    if (feature.key) top.append(make('span', 'hub-chip', feature.key));
    if (!isDisplayOnly(feature.id)) top.append(featureToggle(feature));
    const group = make('div', 'hub-group');
    group.append(make('h3', '', 'Controls'));
    if (['dash-lab', 'lethal', 'twisted'].includes(feature.id)) {
      const open = make('a', 'hub-row', 'Open Dash Lab ↗');
      open.href = '#preview';
      open.addEventListener('click', () => {
        $('tab-dash').click();
        if (feature.id !== 'dash-lab') document.querySelector(`[data-pattern="${feature.id}"]`).click();
      });
      group.append(open);
    } else if (feature.id === 'preview-theme') {
      const row = make('div', 'hub-row', 'High-contrast borders');
      row.append(toggle('High-contrast borders', hub.classList.contains('high-contrast'), next => hub.classList.toggle('high-contrast', next)));
      group.append(row);
    } else if (feature.id === 'preview-settings') {
      const row = make('div', 'hub-row', 'Reduce motion');
      row.append(toggle('Reduce menu motion', noMotion, next => {
        noMotion = next;
        stage.classList.toggle('no-menu-motion', next);
        transition?.cancel();
        sizeTransition?.cancel();
      }));
      group.append(row);
    } else {
      const row = make('div', 'hub-row');
      const state = make('output', '', feature.on ? 'On' : 'Off');
      row.append(make('span', '', 'State'), state);
      top.querySelector('.hub-switch').addEventListener('click', () => { state.value = feature.on ? 'On' : 'Off'; });
      group.append(row);
    }
    const note = make('p', 'hub-detail-note', 'Changes apply here, not in Roblox.');
    swapContent(top, group, note);
    animate(group, [{ opacity: .2, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }]);
    if (focus) back.focus({ preventScroll: true });
  }

  const navButtons = pages.map(([title], index) => {
    const button = make('button', '', title);
    button.addEventListener('click', () => showPage(index));
    nav.append(button);
    return button;
  });
  new ResizeObserver(alignNav).observe(nav);
  document.fonts.ready.then(alignNav);

  function searchFeatures() {
    const text = query.value.trim().toLowerCase();
    const matches = [...byId.values()].filter(feature => `${feature.name} ${feature.page}`.toLowerCase().includes(text));
    const results = $('find-results');
    results.replaceChildren();
    if (!matches.length) results.append(make('p', 'find-empty', 'No matching features.'));
    for (const feature of matches.slice(0, text ? 20 : 6)) {
      const button = make('button', '', feature.name);
      button.append(make('small', '', feature.page));
      button.addEventListener('click', () => { find.close(); openFeature(feature); });
      results.append(button);
    }
  }

  function quickFind() {
    if (screen !== 'hub') return;
    if (find.open) { find.close(); return; }
    query.value = '';
    searchFeatures();
    find.show();
    query.focus();
  }

  $('find-open').addEventListener('click', quickFind);
  $('find-close').addEventListener('click', () => { find.close(); $('find-open').focus(); });
  query.addEventListener('input', searchFeatures);
  query.addEventListener('keydown', event => {
    if (event.key === 'Enter') $('find-results').querySelector('button')?.click();
    if (event.key === 'ArrowDown') { event.preventDefault(); $('find-results').querySelector('button')?.focus(); }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && find.open) { find.close(); $('find-open').focus(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && stage.contains(document.activeElement) && screen === 'hub') {
      event.preventDefault();
      quickFind();
    }
  });

  $('hub-minimize').addEventListener('click', () => switchScreen('pill', true));
  pill.addEventListener('click', () => switchScreen('hub', true));
  document.querySelectorAll('[data-feature]').forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    openFeature(byId.get(link.dataset.feature));
  }));

  motion.addEventListener('change', () => {
    if (!motion.matches) return;
    transition?.cancel();
    sizeTransition?.cancel();
  });

  count();
  showPage(0, false);
})();
