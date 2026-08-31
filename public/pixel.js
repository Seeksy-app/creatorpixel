// CreatorPixel v2.0 — 3-Layer Identity Resolution
// https://creatorpixel.app
(function(w,d){
'use strict';
var E=(typeof __CPX_ENDPOINT__!=='undefined'?__CPX_ENDPOINT__:'https://creatorpixel.app')+'/api/collect',
SK='_cpx_vid',SSK='_cpx_sid',pid=null,q=[],rb2bId=null;

function gid(){var c='abcdefghijklmnopqrstuvwxyz0123456789',s='';for(var i=0;i<16;i++)s+=c[Math.floor(Math.random()*c.length)];return Date.now().toString(36)+'_'+s}

function gvid(){
var id=null;
try{id=localStorage.getItem(SK)}catch(e){}
if(!id){var m=d.cookie.match(new RegExp('(?:^|; )'+SK+'=([^;]+)'));if(m)id=m[1]}
if(!id)id='v_'+gid();
try{localStorage.setItem(SK,id)}catch(e){}
try{var x=new Date();x.setFullYear(x.getFullYear()+2);d.cookie=SK+'='+id+';expires='+x.toUTCString()+';path=/;SameSite=Lax'}catch(e){}
return id}

function gsid(){
var s=null;
try{s=sessionStorage.getItem(SSK)}catch(e){}
if(!s){s='s_'+gid();try{sessionStorage.setItem(SSK,s)}catch(e){}}
return s}

function gutm(){
var p={};
try{var sp=new URL(w.location.href).searchParams;
['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(k){var v=sp.get(k);if(v)p[k]=v})}catch(e){}
return p}

// Canvas fingerprint
function cfp(){
try{
var c=d.createElement('canvas'),x=c.getContext('2d');
if(!x)return'';
c.width=200;c.height=50;
x.textBaseline='top';
x.font='14px Arial';x.fillStyle='#f60';x.fillRect(0,0,200,50);
x.fillStyle='#069';x.fillText('CPx:fp:2.0',2,15);
x.fillStyle='rgba(102,204,0,0.7)';x.fillText('CPx:fp:2.0',4,17);
x.beginPath();x.arc(50,30,10,0,Math.PI*2);x.fill();
var dt=c.toDataURL();
var h=0;for(var i=0;i<dt.length;i++){h=((h<<5)-h)+dt.charCodeAt(i);h=h&h}
return Math.abs(h).toString(36)
}catch(e){return''}}

// WebGL fingerprint
function wfp(){
try{
var c=d.createElement('canvas'),g=c.getContext('webgl')||c.getContext('experimental-webgl');
if(!g)return'';
var r=g.getExtension('WEBGL_debug_renderer_info');
var vendor=r?g.getParameter(r.UNMASKED_VENDOR_WEBGL):'';
var renderer=r?g.getParameter(r.UNMASKED_RENDERER_WEBGL):'';
var s=vendor+'~'+renderer+'~'+g.getParameter(g.VERSION)+'~'+g.getParameter(g.SHADING_LANGUAGE_VERSION);
var h=0;for(var i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h=h&h}
return Math.abs(h).toString(36)
}catch(e){return''}}

// Combined fingerprint
function gfp(){
var c=cfp(),wg=wfp();
var raw=c+'|'+wg+'|'+screen.width+'x'+screen.height+'|'+(navigator.hardwareConcurrency||0)+'|'+navigator.language+'|'+(new Date().getTimezoneOffset());
var h=0;for(var i=0;i<raw.length;i++){h=((h<<5)-h)+raw.charCodeAt(i);h=h&h}
return'fp_'+Math.abs(h).toString(36)}

function gdt(){
var u=navigator.userAgent||'';
if(/tablet|ipad|playbook|silk/i.test(u))return'tablet';
if(/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(u))return'mobile';
return'desktop'}

function gbr(){
var u=navigator.userAgent||'';
if(u.indexOf('Firefox')>-1)return'Firefox';
if(u.indexOf('Edg')>-1)return'Edge';
if(u.indexOf('Chrome')>-1)return'Chrome';
if(u.indexOf('Safari')>-1)return'Safari';
if(u.indexOf('Opera')>-1||u.indexOf('OPR')>-1)return'Opera';
return'Other'}

function gos(){
var u=navigator.userAgent||'';
if(u.indexOf('Win')>-1)return'Windows';
if(u.indexOf('Mac')>-1)return'macOS';
if(/Android/i.test(u))return'Android';
if(/iPhone|iPad|iPod/i.test(u))return'iOS';
if(u.indexOf('Linux')>-1)return'Linux';
return'Other'}

// Inject RB2B pixel (Layer 1) if configured
function injectRB2B(rbId){
if(!rbId||w.reb2b||d.getElementById('cpx-rb2b'))return;
try{
w.reb2b={loaded:true};
var s=d.createElement('script');
s.id='cpx-rb2b';s.type='text/javascript';s.async=true;
s.src='https://ddwl4m2hdecbv.cloudfront.net/b/'+rbId+'/'+rbId+'.js.gz';
var x=d.getElementsByTagName('script')[0];
x.parentNode.insertBefore(s,x);
}catch(e){}}

function send(evType,extra){
if(!pid)return;
// Pageview dedup — only one pageview per page load, no matter how many call paths
if(evType==='pageview'){
if(w._cpx_tracked){console.log('[CPX] pageview BLOCKED (already tracked)');return}
w._cpx_tracked=true;
console.log('[CPX] pageview ALLOWED (first fire)')}
var u=gutm(),p={
pixel_id:pid,
visitor_id:gvid(),
session_id:gsid(),
fingerprint:gfp(),
event_type:evType,
page_url:w.location.href,
page_title:d.title||'',
referrer:d.referrer||'',
screen_width:screen.width,
screen_height:screen.height,
timezone:(function(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone}catch(e){return''}})(),
language:navigator.language||'',
device_type:gdt(),
browser:gbr(),
os:gos(),
timestamp:new Date().toISOString()
};
for(var k in u)if(u.hasOwnProperty(k))p[k]=u[k];
if(extra&&typeof extra==='object')for(var j in extra)if(extra.hasOwnProperty(j))p[j]=extra[j];

// fetch (keepalive) → image fallback
// No sendBeacon — it always sends credentials, which breaks wildcard CORS
try{fetch(E,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(p),keepalive:true,mode:'cors',credentials:'omit'}).catch(function(){})}catch(e){
try{var img=new Image();img.src=E+'?d='+encodeURIComponent(JSON.stringify(p))}catch(e2){}}}

function cpx(){
var args=arguments,cmd=args[0],a1=args[1],a2=args[2];
switch(cmd){
case'init':
console.log('[CPX init] arguments:',args[0],args[1],args[2]);
pid=a1;
var opts=a2||{};
if(opts.rb2b){rb2bId=opts.rb2b;console.log('[CPX] RB2B id found:',rb2bId)}
while(q.length){var c=q.shift();cpx(c[0],c[1],c[2])}
if(rb2bId)injectRB2B(rb2bId);
break;
case'track':
if(!pid){q.push([cmd,a1,a2]);return}
send(a1||'pageview',a2);
break;
case'identify':
if(!pid){q.push([cmd,a1,a2]);return}
send('identify',{email:a1});
break;
default:break}}

var eq=w.cpx&&w.cpx.q?w.cpx.q:[];
w.cpx=cpx;
for(var i=0;i<eq.length;i++){var a=Array.prototype.slice.call(eq[i]);cpx(a[0],a[1],a[2])}
})(window,document);
