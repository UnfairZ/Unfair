const notices = new Map([
  ['expired', 'Your sign-in link expired. Please try again.'],
  ['cancelled', 'Discord sign-in was cancelled.'],
  ['failed', 'Discord sign-in didn’t finish. Please try again.'],
  ['unavailable', 'Sign-in is temporarily unavailable. Please try again later.'],
  ['busy', 'Too many sign-in attempts. Wait a minute and try again.'],
  ['signed-out', 'You’re signed out.'],
]);
const notice = notices.get(new URLSearchParams(location.search).get('status'));
if (notice) {
  const element = document.getElementById('login-notice');
  element.textContent = notice;
  element.hidden = false;
  history.replaceState(null, '', location.pathname);
}
