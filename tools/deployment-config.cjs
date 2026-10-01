'use strict';
function demoOrigin(value) {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'demo.audiotechlabs.com' || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw new Error('ATL_DEMO_ORIGIN must be https://demo.audiotechlabs.com');
  return url.origin;
}
async function verifyDemo(origin, fetcher = fetch) {
  const response = await fetcher(origin + '/api/health', { redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Demo health endpoint is unavailable');
  const health = await response.json();
  if (health.service !== 'audio-tech-labs-demo' || health.apiVersion !== 1 || health.authentication !== true) throw new Error('Demo API version or authentication is not ready');
  const anonymous = await fetcher(origin + '/api/auth/me', { redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (anonymous.status !== 401) throw new Error('Demo authentication check failed');
}
function deploymentMode(env = process.env) {
  const origin = demoOrigin(env.ATL_DEMO_ORIGIN), external = env.ATL_EXTERNAL_TUNNEL === '1';
  const config = env.ATL_TUNNEL_CONFIG, quick = env.ATL_ALLOW_QUICK_TUNNEL === '1';
  if (origin && quick) throw new Error('Quick Tunnel is not allowed for the production demo');
  if (external && config) throw new Error('Use either the existing tunnel service or a tunnel config');
  if (origin && !external && (!config || !require('node:fs').existsSync(config))) throw new Error('Set ATL_EXTERNAL_TUNNEL=1 for the installed service, or provide ATL_TUNNEL_CONFIG');
  if (!origin && (external || config)) throw new Error('Set ATL_DEMO_ORIGIN for the named tunnel');
  return { origin, config, quick, external };
}
module.exports = { demoOrigin, verifyDemo, deploymentMode };
