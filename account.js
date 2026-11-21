async function loadAccount() {
  const status = document.getElementById('profile-status');
  const details = document.getElementById('profile-details');
  details.hidden = true;
  status.hidden = false;
  status.textContent = 'Loading your account…';
  try {
    const response = await fetch('/api/account', { cache: 'no-store' });
    if (response.status === 401) return location.replace('/login');
    if (!response.ok) throw new Error('Account unavailable');
    const { account } = await response.json();
    const joined = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(account.joinedAt);
    document.getElementById('profile-name').textContent = account.displayName;
    document.getElementById('profile-user').textContent = `@${account.username}`;
    document.getElementById('profile-joined').textContent = joined;
    details.hidden = false;
    status.hidden = true;
  } catch {
    status.textContent = 'Your profile couldn’t be loaded. Refresh to try again.';
  }
}

addEventListener('pageshow', loadAccount);
addEventListener('pagehide', () => {
  document.getElementById('profile-details').hidden = true;
});
