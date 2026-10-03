export async function onRequest(context) {
  const url = new URL(context.request.url);
  const method = context.request.method.toUpperCase();
  const isDemoRoot = url.hostname.toLowerCase() === 'demo.audiotechlabs.com' && url.pathname === '/';

  if ((method === 'GET' || method === 'HEAD') && isDemoRoot) {
    url.pathname = '/demo/';
    return Response.redirect(url.toString(), 302);
  }

  return context.next();
}
