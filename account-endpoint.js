function accountEndpoint(path) {
  try {
    const origin = new URL(globalThis.UA_ACCOUNT_API);
    if (location.protocol !== 'https:' || origin.protocol !== 'https:' || origin.origin !== globalThis.UA_ACCOUNT_API) return null;
    return new URL(path, origin);
  } catch { return null; }
}
