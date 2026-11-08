// Pieces of the map pages that every map shares (scripts/build-maps.mjs, scripts/build-density-map.mjs): the theme and dark-mode
// toggle scripts, the full-screen viewer (tap to open, pinch/scroll to zoom) and the favicon.
export const DARK_MODE_KEY = "countryFacts.darkMode".replace("countryFacts.", "countryFactsApp.");

export const THEME_SNIPPET = `try{var s=localStorage.getItem(${JSON.stringify(DARK_MODE_KEY)});var d=s===null?matchMedia("(prefers-color-scheme: dark)").matches:s==="true";document.documentElement.classList.toggle("dark",d)}catch(e){}`;
export const TOGGLE_SNIPPET = `(function(){var b=document.getElementById("dark-mode-toggle"),i=document.getElementById("dark-mode-icon"),r=document.documentElement;function sync(){var d=r.classList.contains("dark");b.setAttribute("aria-pressed",String(d));i.textContent=d?"\\u2600\\uFE0F":"\\uD83C\\uDF19"}sync();b.addEventListener("click",function(){var d=!r.classList.contains("dark");r.classList.toggle("dark",d);try{localStorage.setItem(${JSON.stringify(DARK_MODE_KEY)},String(d))}catch(e){}sync()})})();`;

// Phone viewer: a tap on the map opens it full screen; one finger drags, two fingers pinch, the buttons zoom.
export const VIEWER_SNIPPET = `(function(){
var open=document.getElementById("map-open"),viewer=document.getElementById("map-viewer"),stage=document.getElementById("map-stage");
if(!open||!viewer||!stage)return;
var narrow=window.matchMedia("(max-width: 700px)"),svg=null,s=1,tx=0,ty=0,base=1,w0=0,h0=0,MAX=10,minS=1,pts={},last=null,pushed=false,pinch=null;
function size(){var r=stage.getBoundingClientRect();return[r.width,r.height]}
function clamp(){var sz=size(),W=w0*s,H=h0*s;
 tx=W<=sz[0]?(sz[0]-W)/2:Math.min(0,Math.max(sz[0]-W,tx));ty=H<=sz[1]?(sz[1]-H)/2:Math.min(0,Math.max(sz[1]-H,ty))}
function apply(){clamp();svg.style.transform="translate("+tx+"px,"+ty+"px) scale("+s+")"}
function zoomAt(f,cx,cy){var n=Math.min(MAX,Math.max(minS,s*f));f=n/s;tx=cx-(cx-tx)*f;ty=cy-(cy-ty)*f;s=n;apply()}
function fit(){var sz=size(),ratio=svg.viewBox.baseVal.height/svg.viewBox.baseVal.width;w0=sz[0];h0=w0*ratio;
 svg.style.width=w0+"px";svg.style.height=h0+"px";
 if(narrow.matches){minS=1;s=Math.min(3,Math.max(1,sz[1]/h0))}else{minS=Math.min(1,sz[1]/h0);s=minS}tx=(sz[0]-w0*s)/2;ty=(sz[1]-h0*s)/2;apply()}
function show(){svg=open.querySelector("svg").cloneNode(true);svg.removeAttribute("class");svg.setAttribute("class","map-svg map-svg-big");
 svg.style.minWidth="0";stage.innerHTML="";stage.appendChild(svg);viewer.hidden=false;document.documentElement.classList.add("map-viewer-open");
 fit();document.getElementById("map-close").focus();try{history.pushState({mapViewer:1},"");pushed=true}catch(e){}}
function hide(fromPop){if(viewer.hidden)return;viewer.hidden=true;document.documentElement.classList.remove("map-viewer-open");stage.innerHTML="";svg=null;
 if(pushed&&!fromPop){pushed=false;try{history.back()}catch(e){}}pushed=false;open.focus()}
open.addEventListener("click",show);
window.addEventListener("popstate",function(){if(!viewer.hidden)hide(true)});
document.addEventListener("keydown",function(e){if(!viewer.hidden&&e.key==="Escape")hide()});
document.getElementById("map-close").addEventListener("click",function(){hide()});
function center(){var sz=size();return[sz[0]/2,sz[1]/2]}
document.getElementById("map-zoom-in").addEventListener("click",function(){var c=center();zoomAt(1.6,c[0],c[1])});
document.getElementById("map-zoom-out").addEventListener("click",function(){var c=center();zoomAt(1/1.6,c[0],c[1])});
document.getElementById("map-zoom-reset").addEventListener("click",function(){fit()});
window.addEventListener("resize",function(){if(!viewer.hidden)fit()});
function rel(e){var r=stage.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]}
stage.addEventListener("pointerdown",function(e){stage.setPointerCapture(e.pointerId);pts[e.pointerId]=rel(e);last=null;pinch=null});
stage.addEventListener("pointermove",function(e){if(!pts[e.pointerId])return;var p=rel(e),prev=pts[e.pointerId];pts[e.pointerId]=p;var ids=Object.keys(pts);
 if(ids.length===1){tx+=p[0]-prev[0];ty+=p[1]-prev[1];apply()}
 else if(ids.length===2){var a=pts[ids[0]],b=pts[ids[1]],d=Math.hypot(a[0]-b[0],a[1]-b[1]),m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  if(pinch){tx+=m[0]-pinch.m[0];ty+=m[1]-pinch.m[1];zoomAt(d/pinch.d,m[0],m[1])}pinch={d:d,m:m}}});
function up(e){delete pts[e.pointerId];pinch=null}
stage.addEventListener("pointerup",up);stage.addEventListener("pointercancel",up);
stage.addEventListener("wheel",function(e){e.preventDefault();var p=rel(e);zoomAt(Math.exp(-e.deltaY*0.0015),p[0],p[1])},{passive:false});
stage.addEventListener("dblclick",function(e){var p=rel(e);zoomAt(s>=MAX/2?minS/s:2,p[0],p[1])});
})();`;

export const FAVICON = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌍</text></svg>`;
