async function loadAccount() {
  const status = document.getElementById('profile-status');
  const details = document.getElementById('profile-details');
  details.hidden = true;
  status.hidden = false;
  status.textContent = 'Loading your account…';
  const endpoint = accountEndpoint('/api/account');
  if (!endpoint) {
    status.textContent = 'Sign-in is currently unavailable.';
    return;
  }
  try {
    const response = await fetch(endpoint, { cache: 'no-store', credentials: 'include', redirect: 'error' });
    if (response.status === 401) return location.replace('login.html');
    if (!response.ok) throw new Error('Account unavailable');
    const { account } = await response.json();
    const joined = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(account.joinedAt);
    document.getElementById('profile-name').textContent = account.displayName;
    document.getElementById('profile-user').textContent = `@${account.username}`;
    document.getElementById('profile-joined').textContent = joined;
    details.hidden = false;
    status.hidden = true;
    const form = document.getElementById('sign-out');
    form.action = accountEndpoint('/auth/logout').href;
    form.querySelector('button').disabled = false;
    form.hidden = false;
  } catch {
    status.textContent = 'Your profile couldn’t be loaded. Refresh to try again.';
  }
}

addEventListener('pageshow', loadAccount);
addEventListener('pagehide', () => {
  document.getElementById('profile-details').hidden = true;
});
