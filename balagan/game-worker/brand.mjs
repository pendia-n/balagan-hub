export const iconTag = '<link rel="icon" href="/favicon.ico?v=brand-1" type="image/x-icon">';
export const brandCSS = 'body{font-size:16px!important;line-height:1.65!important}main{padding-bottom:64px!important}button,.button{border-radius:8px!important;min-height:44px;transition:transform .15s}button:hover,.button:hover{transform:translateY(-2px)}input,textarea,select{border:1px solid #7778;border-radius:7px;background:#fff;color:#241c29}h1,h2,h3{letter-spacing:-.035em!important}.panel{border-radius:12px!important}nav{align-items:center;flex-wrap:wrap}a{ text-underline-offset:3px }@media(prefers-reduced-motion:reduce){button,.button{transition:none}}.site-brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none}.site-brand img{display:block;object-fit:contain}';
export const brandLink = name => '<a class="site-brand" href="/"><img src="/brand.svg" alt="" width="44" height="44"><strong>'+name+'</strong></a>';

export async function brandAsset(request,env,game) {
 const path = new URL(request.url).pathname;
 const suffix = path === '/favicon.ico' ? '-favicon.ico' : path === '/brand.svg' ? '-logo.svg' : null;
 if (!suffix) return null;
 if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405});
 const etag = request.headers.get('If-None-Match');
 return env.BALAGAN.fetch(new Request('https://balagan.live/media/'+game+suffix,{
  method:request.method,
  headers:etag ? {'If-None-Match':etag} : {}
 }));
}
