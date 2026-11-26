/* Call voice: practice cold calls against an AI business. Loaded only when someone opens the tab.
   The caller picks the business and the difficulty; who picks up, their mood and their pushback are drawn by the
   call-voice function and shown only in the report afterwards. Listening and speaking happen in this browser; only text
   goes to the function, which holds the Claude key and enforces every limit (20-call lock, calls per day, call length,
   monthly ceiling). No transcript is stored. */
(() => {
const BUSINESS = [['auto', 'Auto repair', 'wrench', 'an auto repair shop'], ['salon', 'Salon', 'scissors', 'a salon'], ['barber', 'Barber shop', 'pole', 'a barber shop'], ['restaurant', 'Restaurant', 'plate', 'a restaurant'], ['home', 'Home services', 'house', 'a home services business'], ['retail', 'Retail shop', 'bag', 'a retail shop']];
const callee = id => (BUSINESS.find(b => b[0] === id) || BUSINESS[0])[3];
const LEVEL = [['easy', 'Easy', 'One objection, fairly open'], ['normal', 'Normal', 'Two objections, realistic'], ['hard', 'Hard', 'Three objections, hangs up on pushy callers']];
const PITCHES = [
  'Hey, I don’t want to waste your time. I saw you didn’t have a website, so my team went ahead and built you one already. It’s completely free to look at. Are you free Tuesday at 3? The demo only takes 15 minutes.',
  'Hi, quick one. My team already built a website for your shop, no charge to look at it. Could I grab 15 minutes Thursday at 10 or 2 to show it to you?',
  'I’ll be quick. We noticed you’re not online yet, so we built you a site. Free to see, no strings. Does tomorrow at 11 work for a 15-minute look?'];
const ICON = {
  mic: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  micoff: '<path d="M3 3l18 18M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.5 5.3M19 11a7 7 0 0 1-.6 2.8M12 18v3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  end: '<path d="M3 15.5c5-4.5 13-4.5 18 0l-2.5 2.5-3.5-1.5v-3a12 12 0 0 0-6 0v3L5.5 18z"/>',
  keys: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/>',
  pole: '<rect x="8" y="3" width="8" height="18" rx="4"/><path d="M8 8l8-3M8 13l8-3M8 18l8-3"/>',
  plate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M2 4v6M4 4v6M3 10v10M22 4c-2 2-2 6 0 8v8"/>',
  house: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  bag: '<path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
  check: '<path d="M5 12l5 5 9-10"/>', cross: '<path d="M6 6l12 12M18 6L6 18"/>' };
const svg = (k, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
const E = s => (typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem('cv.' + k)) ?? d } catch { return d } }, set(k, v) { try { localStorage.setItem('cv.' + k, JSON.stringify(v)) } catch {} } };
const caps = () => {
  const mob = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
  const weak = mob || (navigator.deviceMemory || 8) < 4 || (navigator.hardwareConcurrency || 4) < 4;
  return { mob, weak, sr: !!(window.SpeechRecognition || window.webkitSpeechRecognition), gpu: !!navigator.gpu && !mob,
    mic: !!navigator.mediaDevices?.getUserMedia, synth: 'speechSynthesis' in window };
};
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const initials = s => String(s).replace(/['’]s\b/g, '').split(/[\s&.]+/).filter(w => /^[A-Za-z]/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('');

/* ---------- styles, scoped to .cv ----------
   The call itself happens on "the line": a navy panel that stays dark in both themes, so it reads as a phone, not a page.
   You are violet (the site accent), the business is amber: the same two colours on the trace, the subtitles and the report. */
const CSS = `.cv{--you:#a78bfa;--them:#f2b84b;--line-bg:#0f1830;--line-ink:#e8ecf8;--line-mute:#8d97b5;--line-rule:#26324f;--go:#1f9d63;--stop:#d9473b;max-width:780px}
.cv h2{font-size:clamp(24px,3.6vw,32px);letter-spacing:-.03em;line-height:1.1;margin:0}
.cv .lede{color:var(--mute);margin:8px 0 0;max-width:58ch;font-size:15px;line-height:1.45}
.cv .panel{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:22px}
.cv .k{font-size:13px;color:var(--mute);margin:0 0 8px;font-weight:500}
/* locked */
.cv .lockhero{display:grid;grid-template-columns:auto 1fr;gap:22px;align-items:center}
.cv .lring{position:relative;width:124px;height:124px}.cv .lring svg{transform:rotate(-90deg)}.cv .lring circle{fill:none;stroke-width:9}
.cv .lring .trk{stroke:var(--line)}.cv .lring .arc{stroke:var(--accent);stroke-linecap:round;transition:stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)}
.cv .lring .ctr{position:absolute;inset:0;display:grid;place-content:center;text-align:center}.cv .lring b{font-size:34px;font-weight:750;letter-spacing:-.04em;font-variant-numeric:tabular-nums}.cv .lring span{font-size:12px;color:var(--mute)}
.cv .lockline{display:flex;gap:6px;align-items:center;color:var(--mute);font-size:13px;margin:0 0 6px}
.cv .peek{margin-top:18px;border-radius:14px;background:var(--line-bg);color:var(--line-ink);padding:16px 18px;display:grid;gap:6px;position:relative;overflow:hidden}
.cv .peek p{margin:0;font-size:15px}.cv .peek .t{color:var(--them)}.cv .peek .y{color:var(--you)}.cv .peek::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 40%,var(--line-bg) 92%)}
/* setup */
.cv .setup{display:grid;gap:22px}
.cv .mission{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start;background:var(--panel);border-radius:14px;padding:16px 18px}
.cv .mission .ic{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--accent);color:var(--accent-ink)}
.cv .mission b{display:block;margin-bottom:4px}.cv .mission q{display:block;font-style:italic;color:var(--ink);line-height:1.45;quotes:"\\201C" "\\201D"}
.cv .mission .alt{margin-top:6px;font-size:13px}
.cv .biz{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.cv .biz button{height:auto;white-space:normal;min-height:64px;display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-size:15px;font-weight:600;text-align:left;justify-content:flex-start}
.cv .biz button svg{flex:none;color:var(--mute)}.cv .biz button[aria-pressed=true]{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent);background:color-mix(in oklab,var(--accent) 9%,var(--surface))}.cv .biz button[aria-pressed=true] svg{color:var(--accent)}
.cv .lvl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--line);border-radius:14px;overflow:hidden}
.cv .lvl button{height:auto;white-space:normal;line-height:1.3;border:0;border-radius:0;border-left:1px solid var(--line);background:var(--surface);color:var(--ink);padding:10px 12px;text-align:left;display:grid;gap:2px;font-weight:600}
.cv .lvl button:first-child{border-left:0}.cv .lvl button span{font-weight:400;font-size:12.5px;color:var(--mute)}.cv .lvl button[aria-pressed=true]{background:color-mix(in oklab,var(--accent) 12%,var(--surface));box-shadow:inset 0 -3px 0 var(--accent)}
.cv .unknowns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.cv .mys{border-radius:12px;padding:12px 14px;min-height:76px;display:grid;align-content:space-between;background:repeating-linear-gradient(135deg,var(--panel) 0 8px,color-mix(in oklab,var(--panel) 70%,var(--surface)) 8px 16px);border:1px dashed var(--line)}
.cv .mys span{font-size:13px;color:var(--mute)}.cv .mys b{font-size:22px;letter-spacing:-.02em;color:var(--mute)}
.cv .dial{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.cv .dialbtn{width:68px;height:68px;border-radius:50%;border:0;background:var(--go);color:#fff;display:grid;place-items:center;box-shadow:0 10px 26px -10px var(--go);flex:none;padding:0}
.cv .dialbtn:hover:not(:disabled){filter:brightness(1.08)}.cv .dialbtn:disabled{opacity:.45;box-shadow:none}
.cv .dial .to b{display:block;font-size:17px}.cv .dial .to span{color:var(--mute);font-size:13px}
.cv .hear{display:flex;gap:8px;align-items:center;margin:-8px 0 0;font-size:14px;color:var(--mute)}.cv .hear svg{flex:none;color:var(--go)}.cv .hear:has(.link) svg{color:var(--mute)}
.cv details{font-size:14px}.cv details summary{cursor:pointer;color:var(--mute)}.cv details label{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}.cv details select{height:36px}
.cv .admin{font-size:13px;color:var(--mute);margin:0}
/* admin: who gets it */
.cv .cvadm{margin-bottom:8px}.cv .cvadmh{display:flex;gap:16px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;margin-bottom:16px}.cv .cvadmh input{height:40px;max-width:240px}
.cv .cvtable{display:grid;border:1px solid var(--line);border-radius:14px;overflow:hidden}
.cv .cvrow{display:grid;grid-template-columns:minmax(0,1.6fr) 90px 170px 150px 90px;gap:12px;align-items:center;padding:10px 14px;border-top:1px solid var(--line)}
.cv .cvrow:first-child{border-top:0}.cv .cvrow[hidden]{display:none}.cv .cvhead{font-size:12.5px;color:var(--mute);font-weight:500;background:var(--panel)}
.cv .cvrow span{min-width:0}.cv .cvrow b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cv .cvrow small{display:block;font-size:12px;color:var(--mute)}
.cv .cvrow .num{font-variant-numeric:tabular-nums}.cv .cvrow select,.cv .cvrow input{height:38px;width:100%}.cv .cvsaved{min-height:16px}.cv .cvsaved.bad{color:var(--bad)}
@media (max-width:720px){.cv .cvhead{display:none}.cv .cvrow{grid-template-columns:1fr 1fr;row-gap:8px}.cv .cvrow span:first-child{grid-column:1/-1}}
/* setup steps: the page's own .ob onboarding, plus these */
.cv .cvob{margin-top:3vh}.cv .cvob .ob-q{max-width:16ch}
.cv .cvbiz{grid-template-columns:1fr 1fr}.cv .cvbiz .ob-opt{justify-content:flex-start;gap:14px;height:72px}
.cv .cvic{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--panel);color:var(--accent);flex:none;transition:background .2s,color .2s}
.cv .ob-opt[aria-checked=true] .cvic{background:color-mix(in oklab,var(--accent-ink) 22%,transparent);color:var(--accent-ink)}
.cv .cvl2{display:grid;gap:2px}.cv .cvl2 small{font-size:13px;font-weight:450;color:var(--mute);line-height:1.3}.cv .ob-opt[aria-checked=true] .cvl2 small{color:inherit;opacity:.8}
.cv .ob-opt{height:auto;min-height:64px;padding-top:12px;padding-bottom:12px;white-space:normal}.cv .ob-opt:disabled{opacity:.45}
.cv .cvgl{font-size:13px;color:var(--mute);margin:26px 0 -18px;font-weight:500}
.cv .cvdeck{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:28px;perspective:900px}
.cv .cvcard{min-height:188px;border-radius:16px;padding:16px;display:grid;align-content:end;gap:4px;position:relative;overflow:hidden;color:var(--line-ink);
  background:radial-gradient(120% 80% at 100% 0%,color-mix(in oklab,var(--them) 22%,transparent),transparent 60%),repeating-linear-gradient(135deg,#142041 0 10px,#111b37 10px 20px);
  animation:cvdeal .6s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--n)*90ms);box-shadow:0 18px 40px -24px rgba(10,16,40,.7)}
.cv .cvcard b{font-size:16px}.cv .cvcard small{font-size:12.5px;color:var(--line-mute);line-height:1.35}
.cv .cvq{position:absolute;top:10px;left:14px;font-size:64px;font-weight:750;line-height:1;color:var(--them);opacity:.9;letter-spacing:-.04em}
@keyframes cvdeal{from{opacity:0;transform:translateY(22px) rotateX(18deg)}}
.cv .cvob .mission{margin-top:26px}
.cv .cvdial{display:flex;align-items:center;gap:18px;margin-top:26px}.cv .cvdial .dialbtn{width:76px;height:76px}.cv .cvdial .to b{display:block;font-size:18px}.cv .cvdial .to span{color:var(--mute);font-size:13px}
.cv .cvob .hear{margin:14px 0 0}.cv .cvob .admin{margin-top:12px}
@media (max-width:640px){.cv .cvbiz{grid-template-columns:1fr}.cv .cvdeck{grid-template-columns:1fr}.cv .cvcard{min-height:110px}}
/* the line */
.cv .phone{background:var(--line-bg);color:var(--line-ink);border-radius:22px;padding:20px 20px 16px;display:grid;gap:14px;box-shadow:0 30px 60px -30px rgba(10,16,40,.55)}
.cv .status{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--line-mute);font-variant-numeric:tabular-nums}
.cv .status .on{display:inline-flex;gap:8px;align-items:center}.cv .status .dot{width:8px;height:8px;border-radius:50%;background:var(--line-mute)}
.cv .phone[data-s=live] .status .dot{background:var(--go);box-shadow:0 0 0 4px color-mix(in oklab,var(--go) 25%,transparent)}
.cv .left.low{color:#ff8f86}
.cv .cid{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center}
.cv .av{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:19px;letter-spacing:.02em;color:var(--line-bg);background:var(--them)}
.cv .phone[data-s=dialing] .av{animation:cvring 1.2s ease-in-out infinite}
@keyframes cvring{0%,100%{box-shadow:0 0 0 0 color-mix(in oklab,var(--them) 55%,transparent)}70%{box-shadow:0 0 0 16px transparent}}
.cv .cid b{display:block;font-size:20px;letter-spacing:-.02em}.cv .cid span{color:var(--line-mute);font-size:14px}
.cv .trace{width:100%;height:112px;display:block;border-top:1px solid var(--line-rule);border-bottom:1px solid var(--line-rule)}
.cv .legend{display:flex;justify-content:space-between;font-size:12px;color:var(--line-mute);margin-top:-8px}.cv .legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;vertical-align:middle}
.cv .sub{min-height:78px;display:grid;align-content:center;gap:4px;text-align:center;padding:0 8px}
.cv .sub small{font-size:12px;color:var(--line-mute)}.cv .sub p{margin:0;font-size:clamp(17px,2.4vw,20px);line-height:1.35;text-wrap:balance}
.cv .sub[data-w=them] p{color:var(--them)}.cv .sub[data-w=you] p{color:var(--you)}.cv .sub[data-w=sys] p{color:var(--line-mute);font-size:16px}
.cv .ctl{display:flex;justify-content:center;gap:18px;align-items:flex-start;padding-top:4px}
.cv .ctl button{width:54px;height:54px;border-radius:50%;border:0;background:#1d2945;color:var(--line-ink);display:grid;place-items:center;padding:0}
.cv .ctl button[aria-pressed=true]{background:var(--line-ink);color:var(--line-bg)}.cv .ctl button:hover:not(:disabled){background:#27365a}.cv .ctl button[aria-pressed=true]:hover{background:#fff}
.cv .ctl .hang{width:64px;height:64px;background:var(--stop);color:#fff}.cv .ctl .hang:hover:not(:disabled){background:#e4554a}
.cv .ctl figure{margin:0;display:grid;justify-items:center;gap:6px;font-size:12px;color:var(--line-mute)}
.cv .typebar{display:flex;gap:8px}.cv .typebar input{flex:1;height:44px;background:#18223d;border:1px solid var(--line-rule);color:var(--line-ink);border-radius:12px;padding:0 12px}.cv .typebar button{height:44px;background:var(--you);border:0;color:#160f2c;border-radius:12px;padding:0 16px;font-weight:600}
.cv .log{display:grid;gap:8px;max-height:240px;overflow:auto;border-top:1px solid var(--line-rule);padding-top:12px}.cv .log p{margin:0;font-size:14px;line-height:1.4}.cv .log .t{color:var(--them)}.cv .log .y{color:var(--you)}.cv .log b{font-weight:600;color:var(--line-mute);margin-right:6px}
.cv .note2{font-size:13px;color:var(--line-mute);text-align:center;margin:0}.cv .note2:empty{display:none}
/* report */
.cv .rep{display:grid;gap:20px}
.cv .verdict{display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:center}
.cv .score{position:relative;width:112px;height:112px}.cv .score svg{transform:rotate(-90deg)}.cv .score circle{fill:none;stroke-width:9}.cv .score .trk{stroke:var(--line)}.cv .score .arc{stroke:var(--accent);stroke-linecap:round;transition:stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)}
.cv .score .ctr{position:absolute;inset:0;display:grid;place-content:center;text-align:center}.cv .score b{font-size:38px;font-weight:750;letter-spacing:-.04em}.cv .score span{font-size:12px;color:var(--mute)}
.cv .stamp{display:inline-flex;align-items:center;gap:6px;font-weight:700;font-size:13px;padding:4px 10px;border-radius:999px;margin-bottom:8px}
.cv .stamp.yes{background:var(--okbg);color:var(--ok)}.cv .stamp.no{background:var(--panel);color:var(--mute)}
.cv .reveal{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.cv .reveal .mys{background:var(--line-bg);border:0;color:var(--line-ink)}.cv .reveal .mys span{color:var(--line-mute)}.cv .reveal .mys b{font-size:15px;color:var(--them);letter-spacing:0;line-height:1.35}
.cv .reveal .mys b small{display:block;font-weight:400;color:var(--line-ink);font-size:13px;margin-top:2px}
.cv .cols{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.cv .ticks{list-style:none;margin:0;padding:0;display:grid;gap:8px}.cv .ticks li{display:grid;grid-template-columns:22px 1fr;gap:8px;align-items:start;font-size:14.5px;line-height:1.35}
.cv .ticks .y svg{color:var(--ok)}.cv .ticks .no svg{color:var(--bad)}
.cv .notes ul{margin:0 0 12px;padding-left:18px;line-height:1.45}.cv .tryline{border-left:3px solid var(--accent);padding:6px 12px;margin:0;font-style:italic;line-height:1.45}
.cv .again{display:flex;gap:10px;flex-wrap:wrap}.cv .again button{height:46px;border-radius:12px;padding:0 18px;font-weight:600}.cv .again .go1{background:var(--go);border-color:var(--go);color:#fff;display:inline-flex;gap:8px;align-items:center}
.cv :focus-visible{outline:2px solid var(--accent);outline-offset:2px}.cv .phone :focus-visible{outline-color:var(--line-ink)}
@media (prefers-reduced-motion:reduce){.cv *{animation:none!important;transition:none!important}}
@media (max-width:640px){.cv .lockhero,.cv .verdict{grid-template-columns:1fr}.cv .biz,.cv .unknowns,.cv .reveal{grid-template-columns:1fr 1fr}.cv .cols{grid-template-columns:1fr}.cv .lvl{grid-template-columns:1fr}.cv .lvl button{border-left:0;border-top:1px solid var(--line)}.cv .lvl button:first-child{border-top:0}.cv .phone{padding:16px 14px 14px;border-radius:18px}.cv .ctl{gap:12px}}`;
const addCss = () => { let s = document.getElementById('cvcss'); if (!s) { s = document.createElement('style'); s.id = 'cvcss'; document.head.appendChild(s) } s.textContent = CSS };

/* ---------- the speech worker: Whisper (listening) and Kokoro (studio voice), off the main thread ---------- */
const WORKER = `const T='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/+esm',K='https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';let asr=null,tts=null;
const prog=id=>p=>{if(p&&p.status==='progress')self.postMessage({id,progress:{file:p.file,loaded:p.loaded,total:p.total}})};
self.onmessage=async e=>{const m=e.data;try{
if(m.op==='asr-load'){if(!asr){const{pipeline}=await import(T);const W='onnx-community/whisper-tiny.en';
 if(m.gpu){try{asr=await pipeline('automatic-speech-recognition',W,{device:'webgpu',dtype:{encoder_model:'fp32',decoder_model_merged:'q4'},progress_callback:prog(m.id)});asr.gpu=true}catch(e){asr=null}}
 if(!asr)asr=await pipeline('automatic-speech-recognition',W,{device:'wasm',dtype:{encoder_model:'q8',decoder_model_merged:'q8'},progress_callback:prog(m.id)})}
 self.postMessage({id:m.id,ok:true,gpu:!!asr.gpu})}
else if(m.op==='asr'){const r=await asr(m.audio);self.postMessage({id:m.id,ok:true,text:r.text})}
else if(m.op==='tts-load'){if(!tts){const{KokoroTTS}=await import(K);tts=await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX',{dtype:'fp32',device:'webgpu',progress_callback:prog(m.id)})}self.postMessage({id:m.id,ok:true})}
else if(m.op==='tts'){const a=await tts.generate(m.text,{voice:m.voice});self.postMessage({id:m.id,ok:true,audio:a.audio,rate:a.sampling_rate},[a.audio.buffer])}
}catch(err){self.postMessage({id:m.id,ok:false,err:String(err&&err.message||err)})}};`;
let W = null, wid = 0; const waits = new Map();
const worker = () => { if (!W) { W = new Worker(URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' })), { type: 'module' });
  W.onmessage = e => { const m = e.data, w = waits.get(m.id); if (!w) return; if (m.progress) { w.seen = Date.now(); return w.onp?.(m.progress) } waits.delete(m.id); m.ok ? w.res(m) : w.rej(new Error(m.err)) };
  W.onerror = e => { for (const [k, w] of waits) { waits.delete(k); w.rej(new Error(e.message || 'The speech engine stopped.')) } W = null } } return W };
const ask = (op, data = {}, onp, transfer, quietMs = 0) => new Promise((res, rej) => { const id = ++wid, w = { res, rej, onp, seen: Date.now() }; waits.set(id, w); worker().postMessage({ id, op, ...data }, transfer || []);
  if (quietMs) { const t = setInterval(() => { if (!waits.has(id)) return clearInterval(t); if (Date.now() - w.seen > quietMs) { clearInterval(t); waits.delete(id); rej(new Error('The download stalled.')) } }, 1000) } });
const progressOf = () => { const files = {}; return p => { files[p.file] = p; const v = Object.values(files), l = v.reduce((a, f) => a + (f.loaded || 0), 0), t = v.reduce((a, f) => a + (f.total || 0), 0); return t ? Math.min(99, Math.round(l / t * 100)) : 0 } };

/* ---------- speaking ---------- */
/* Only professional, business-sounding voices. Studio (Kokoro) voices are the clear, neutral ones; breathy and
   character voices (af_nicole, af_bella, am_puck, am_fenrir ...) are left out on purpose. */
const VOICES = { m: ['am_michael', 'am_eric', 'bm_george'], f: ['af_heart', 'af_sarah', 'bf_emma'] };
// Browser voices: an allowlist by name, best first. Novelty and robotic voices (Fred, Ralph, Albert, Junior, Kathy,
// Eddy, Flo, Grandma, Grandpa, Reed, Rocko, Sandy, Shelley, Bells, Bubbles ...) never qualify.
const PRO = {
  m: ['Microsoft Andrew', 'Microsoft Guy', 'Microsoft Davis', 'Microsoft Brian', 'Microsoft Christopher', 'Microsoft Eric', 'Microsoft Roger', 'Microsoft Ryan', 'Microsoft Thomas', 'Google UK English Male',
      'Evan', 'Nathan', 'Tom', 'Alex', 'Aaron', 'Daniel', 'Oliver', 'Arthur', 'Lee', 'Rishi', 'Microsoft David', 'Microsoft Mark'],
  f: ['Microsoft Ava', 'Microsoft Jenny', 'Microsoft Aria', 'Microsoft Michelle', 'Microsoft Emma', 'Microsoft Sonia', 'Microsoft Libby', 'Google US English', 'Google UK English Female',
      'Ava', 'Allison', 'Samantha', 'Susan', 'Zoe', 'Serena', 'Kate', 'Karen', 'Moira', 'Tessa', 'Microsoft Zira'] };
const NOVELTY = /\b(Fred|Ralph|Albert|Junior|Kathy|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Bad News|Good News|Bahh|Bells|Boing|Bubbles|Cellos|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Hysterical|Deranged|Pipe Organ)\b/i;
function pickVoice(g) {
  const vs = speechSynthesis.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang) && !NOVELTY.test(v.name));
  const rank = (v, list) => { const i = list.findIndex(n => v.name === n || v.name.startsWith(n + ' ') || v.name.startsWith(n + '(')); return i < 0 ? 999 : i };
  const list = PRO[g === 'f' ? 'f' : 'm'];
  const best = vs.map(v => [v, rank(v, list) - (/(Premium|Enhanced|Natural|Neural)/i.test(v.name) ? 0.5 : 0) - (/en[-_]US/i.test(v.lang) ? 0.25 : 0)]).filter(x => x[1] < 900).sort((a, b) => a[1] - b[1])[0];
  return best ? best[0] : null;   // null: the device has no professional voice of that gender; the caller falls back
}
let AC = null; const audioCtx = () => (AC ??= new AudioContext());
/* The business's side of the line. level() feeds the amber trace. */
/* Kokoro pads every chunk with ~0.4 s of silence at the start and ~0.5 s at the end. Between two chunks that is a
   second of dead air, so each chunk is trimmed to a natural pause and chunks are queued back to back on the audio clock. */
function trimEdges(a, rate) {
  const thr = 0.012; let i = 0, j = a.length - 1;
  while (i < a.length && Math.abs(a[i]) < thr) i++;
  while (j > i && Math.abs(a[j]) < thr) j--;
  const from = Math.max(0, i - Math.round(rate * 0.03)), to = Math.min(a.length, j + Math.round(rate * 0.14));
  return a.subarray(from, to);
}
function makeSpeaker(kind, gender, seed) {
  let chain = Promise.resolve(), cut = false, talking = false, bump = 0, an = null, data = null, nextT = 0, live = 0, ending = Promise.resolve();
  const srcs = new Set();
  const kv = VOICES[gender === 'f' ? 'f' : 'm'][seed % 3];
  const sv = kind === 'standard' ? pickVoice(gender) : null;
  const playStd = text => new Promise(res => { const u = new SpeechSynthesisUtterance(text); if (sv) u.voice = sv; u.lang = sv?.lang || 'en-US'; u.rate = 1.02; u.pitch = sv ? 1 : gender === 'f' ? 1.08 : 0.85;
    u.onstart = () => { talking = true }; u.onboundary = () => { bump = 1 }; u.onend = u.onerror = () => { talking = false; res() }; speechSynthesis.speak(u) });
  // Queue a buffer right after the previous one; resolves when it is scheduled, not when it finishes.
  const queueBuf = (audio, rate, onStart) => { const ac = audioCtx(), pcm = trimEdges(audio, rate); if (!pcm.length) return;
    const b = ac.createBuffer(1, pcm.length, rate); b.copyToChannel(pcm, 0);
    const src = ac.createBufferSource(); src.buffer = b; an ??= ac.createAnalyser(); an.fftSize = 512; data ??= new Float32Array(an.fftSize);
    src.connect(an); an.connect(ac.destination);
    const at = Math.max(ac.currentTime + 0.02, nextT); nextT = at + b.duration; live++; srcs.add(src);
    ending = new Promise(res => { src.onended = () => { srcs.delete(src); if (--live <= 0) { live = 0; talking = false } res() } });
    src.start(at); setTimeout(() => { if (!cut) { talking = true; onStart?.() } }, Math.max(0, (at - ac.currentTime) * 1000)) };
  return {
    say(text, onStart, after) {   // after: a promise to wait for first, such as the phone being picked up
      if (kind === 'studio') { const gen = ask('tts', { text, voice: kv }).catch(() => null); chain = chain.then(async () => { await after; const g = await gen; if (cut || !g) return; queueBuf(g.audio, g.rate, onStart) }) }
      else chain = chain.then(async () => { await after; if (cut) return; onStart?.(); await playStd(text) });
      return chain;
    },
    level() {
      if (!talking) return 0;
      if (an) { an.getFloatTimeDomainData(data); let s = 0; for (const v of data) s += v * v; return Math.min(1, Math.sqrt(s / data.length) * 5) }
      bump *= 0.86; return Math.min(1, 0.22 + Math.random() * 0.28 + bump * 0.45);   // the browser voice has no audio tap; words drive the trace
    },
    idle: () => chain.then(() => ending),
    stop() { cut = true; talking = false; try { speechSynthesis.cancel() } catch {} for (const x of srcs) { try { x.stop() } catch {} } srcs.clear() },
    unlock() { if (kind === 'standard') { try { speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(' '), { volume: 0 })) } catch {} } audioCtx().resume() }
  };
}
/* US ringback (440 + 480 Hz, two seconds on, four off) and the click of someone picking up. */
function ringback() {
  const ac = audioCtx(), g = ac.createGain(); g.gain.value = 0; g.connect(ac.destination);
  const o = [440, 480].map(f => { const x = ac.createOscillator(); x.frequency.value = f; x.connect(g); x.start(); return x });
  const t0 = ac.currentTime + 0.15; for (let i = 0; i < 10; i++) { const t = t0 + i * 6; g.gain.setValueAtTime(0.05, t); g.gain.setValueAtTime(0, t + 2) }
  return { stop() { try { g.gain.cancelScheduledValues(0); g.gain.value = 0; o.forEach(x => x.stop()); g.disconnect() } catch {} } };
}
function pickupClick() {
  try { const ac = audioCtx(), n = Math.floor(ac.sampleRate * 0.035), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3) * 0.35;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; s.buffer = b; s.connect(f); f.connect(ac.destination); s.start() } catch {}
}

/* ---------- listening ---------- */
const resample = (x, from, to) => { if (from === to) return x; const n = Math.round(x.length * to / from), o = new Float32Array(n); for (let i = 0; i < n; i++) { const p = i * from / to, j = Math.floor(p), f = p - j; o[i] = (x[j] || 0) * (1 - f) + (x[j + 1] || 0) * f } return o };
const JUNK = /^\s*(\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|you\.?|thank you\.?|thanks for watching!?|bye\.?|\.+)\s*$/i;
const clean = t => { t = String(t || '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim(); return !t || JUNK.test(t) ? '' : t };
async function openMic(h) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  const ac = new AudioContext(); ac.resume().catch(() => {}); /* never block on resume: it waits for a user gesture */ const src = ac.createMediaStreamSource(stream), proc = ac.createScriptProcessor(2048, 1, 1);
  src.connect(proc); proc.connect(ac.destination);
  let floor = 0.004, talking = false, buf = [], pre = [], quiet = 0, voiced = 0, total = 0;
  proc.onaudioprocess = e => {
    const x = e.inputBuffer.getChannelData(0); e.outputBuffer.getChannelData(0).fill(0);
    let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; const rms = Math.sqrt(s / x.length), ms = x.length / ac.sampleRate * 1000;
    h.level?.(Math.min(1, rms * 12));
    if (!h.on()) { talking = false; buf = []; pre = []; return }
    const thr = Math.max(0.012, floor * 3.2), c = new Float32Array(x);
    if (!talking) { if (rms < thr) floor = floor * 0.97 + rms * 0.03; pre.push(c); if (pre.length * ms > 320) pre.shift();
      if (rms > thr) { talking = true; buf = pre.slice(); pre = []; quiet = 0; voiced = 0; total = 0; h.start?.() } return }
    buf.push(c); total += ms; if (rms > thr * 0.55) { quiet = 0; voiced += ms } else quiet += ms;
    // 0.5 s of quiet closes a segment, not the turn: the turn logic waits longer unless the sentence is clearly finished.
    if (quiet > 500 || total > 20000) { talking = false; const n = buf.reduce((a, b) => a + b.length, 0), all = new Float32Array(n); let o = 0; for (const b of buf) { all.set(b, o); o += b.length } buf = [];
      if (voiced > 320) h.utter(resample(all, ac.sampleRate, 16000), performance.now() - quiet); else h.cancel?.() }
  };
  return { stop() { try { proc.disconnect(); src.disconnect(); stream.getTracks().forEach(t => t.stop()); ac.close() } catch {} } };
}
function openBrowserEar(h) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition; let r = null, alive = true;
  const run = () => { if (!alive) return; r = new R(); r.lang = 'en-US'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    r.onresult = e => { const res = e.results[e.results.length - 1]; if (!h.on()) return; h.start?.(); if (res.isFinal) h.text(res[0].transcript) };
    r.onerror = () => {}; r.onend = () => { if (alive) setTimeout(run, 120) }; try { r.start() } catch {} };
  run(); return { stop() { alive = false; try { r?.abort() } catch {} } };
}

/* ---------- talking to the function ---------- */
const FN = () => (window.LEADS_CONFIG?.url || '') + '/functions/v1/call-voice';
async function post(body) {
  const { data } = await sb.auth.getSession(); const tok = data?.session?.access_token;
  return fetch(FN(), { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok, apikey: window.LEADS_CONFIG?.key || '' }, body: JSON.stringify(body) });
}
async function postJson(body) { const r = await post(body); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.'); return j }
const sentences = buf => { const out = []; let m; while ((m = buf.match(/^([\s\S]*?[.!?…]+["'”)\]]*)(\s+)/)) && m[1].trim().length >= 2) { out.push(m[1].trim()); buf = buf.slice(m[0].length) } return [out, buf] };

/* ---------- the tab ---------- */
let el = null, CALL = null, VIEW = null, MY = null;
const choiceDefault = () => ({ business: 'auto', level: 'normal', ...store.get('choice', {}) });
const bizLabel = id => (BUSINESS.find(b => b[0] === id) || BUSINESS[0])[1];
const mmss = s => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
function stop() { const c = CALL; CALL = null; if (!c) return; c.dead = true; clearInterval(c.tick); cancelAnimationFrame(c.raf); c.ring?.stop(); c.ear?.stop(); c.speaker?.stop(); c.abort?.abort(); if (c.id && !c.done) post({ action: 'hangup', call_id: c.id }).catch(() => {}) }
const mounted = () => el && document.body.contains(el);

async function mount(target, opts = {}) {
  addCss(); stop(); el = target; VIEW = opts;
  el.innerHTML = '<div class="cv"><div class="skel" aria-label="Loading"><i></i><i></i><i></i></div></div>';
  const r = await (opts.api ? opts.api('my_voice') : sb.rpc('my_voice'));
  if (!mounted() || el !== target) return;
  if (r.error || !r.data) return el.innerHTML = `<div class="cv"><div class="panel"><h2>Sales Simulator is almost ready</h2><p class="lede">Live practice calls with an AI business are being set up. Check back soon.</p></div></div>`;
  MY = r.data;
  if (opts.admin) {   // the admin manages who gets it, above their own practice line
    target.innerHTML = '<div class="cv"><section class="panel cvadm" id="cvadm"></section></div><div class="cvself"></div>';
    el = target.querySelector('.cvself'); adminPanel(target.querySelector('#cvadm'));
  }
  return MY.unlocked ? setupView(MY) : lockedView(MY);
}

/* Admin: who gets the Sales Simulator and how many practice calls a day each person gets. Saves as soon as it changes. */
async function adminPanel(box) {
  box.innerHTML = '<h2>Who gets the Sales Simulator</h2><p class="lede">Loading the team\u2026</p>';
  const r = await sb.rpc('admin_voice_people');
  if (!document.body.contains(box)) return;
  if (r.error) { box.innerHTML = `<h2>Who gets the Sales Simulator</h2><p class="lede">${/admin_voice_people|function/i.test(r.error.message) ? 'One database step is missing: run <b>backend/v11.sql</b> in the Supabase SQL editor, then reload this page.' : E(r.error.message)}</p>`; return }
  const people = r.data || [], def = +MY.daily || 5, need = +MY.needed || 20;
  box.innerHTML = `<div class="cvadmh"><div><h2>Who gets the Sales Simulator</h2><p class="lede">By default it unlocks after ${need} completed calls, with ${def} practice calls a day. Change anyone here; it saves right away.</p></div>
    <input type="search" id="cvfind" placeholder="Find a person" aria-label="Find a person"></div>
    <div class="cvtable" role="table" aria-label="Sales Simulator access">
     <div class="cvrow cvhead" role="row"><span role="columnheader">Person</span><span role="columnheader">Calls done</span><span role="columnheader">Access</span><span role="columnheader">Practice calls a day</span><span role="columnheader">This month</span></div>
     ${people.map(p => `<div class="cvrow" role="row" data-id="${E(p.id)}" data-name="${E(String(p.full_name || '').toLowerCase())}">
       <span role="cell"><b>${E(p.full_name || 'Unnamed')}</b><small>${p.role === 'manager' ? 'Manager' : 'Cold caller'}</small></span>
       <span role="cell" class="num">${+p.done}${p.access === 'auto' ? `<small>${+p.done >= need ? 'Unlocked' : `${need - p.done} to go`}</small>` : ''}</span>
       <span role="cell"><select data-k="access" aria-label="Access for ${E(p.full_name)}"><option value="auto"${p.access === 'auto' ? ' selected' : ''}>After ${need} calls</option><option value="on"${p.access === 'on' ? ' selected' : ''}>Always on</option><option value="off"${p.access === 'off' ? ' selected' : ''}>Off</option></select></span>
       <span role="cell"><input data-k="daily" type="number" min="0" max="100" inputmode="numeric" value="${p.daily ?? ''}" placeholder="${def}" aria-label="Practice calls a day for ${E(p.full_name)}"><small class="cvsaved" aria-live="polite"></small></span>
       <span role="cell" class="num">${+p.month_calls}<small>${+p.today} today</small></span></div>`).join('') || '<p class="lede">Nobody has been accepted yet.</p>'}
    </div>`;
  box.querySelector('#cvfind').oninput = e => { const q = e.target.value.trim().toLowerCase(); box.querySelectorAll('.cvrow[data-id]').forEach(r => { r.hidden = !!q && !r.dataset.name.includes(q) }) };
  box.querySelectorAll('.cvrow[data-id]').forEach(row => {
    const sel = row.querySelector('[data-k=access]'), num = row.querySelector('[data-k=daily]'), out = row.querySelector('.cvsaved'); let t = 0;
    const save = async () => {
      const d = num.value.trim() === '' ? null : Math.max(0, Math.min(100, parseInt(num.value, 10) || 0)); if (d != null) num.value = d;
      out.textContent = 'Saving\u2026'; const res = await sb.rpc('admin_set_voice', { p_person: row.dataset.id, p_access: sel.value, p_daily: d });
      out.textContent = res.error ? res.error.message : 'Saved'; out.classList.toggle('bad', !!res.error); if (!res.error) setTimeout(() => { if (out.textContent === 'Saved') out.textContent = '' }, 1800) };
    sel.onchange = save; num.oninput = () => { clearTimeout(t); t = setTimeout(save, 600) };
  });
}

function lockedView(v) {
  const need = +v.needed || 20, done = Math.min(+v.done || 0, need), left = Math.max(0, need - (+v.done || 0)), C = 2 * Math.PI * 54;
  el.innerHTML = `<div class="cv"><div class="panel"><div class="lockhero">
   <div class="lring" role="img" aria-label="${done} of ${need} calls done"><svg viewBox="0 0 124 124" width="124" height="124"><circle class="trk" cx="62" cy="62" r="54"/><circle class="arc" cx="62" cy="62" r="54" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"/></svg><div class="ctr"><b>${done}</b><span>of ${need} calls</span></div></div>
   <div><p class="lockline">${svg('lock', 14)} Sales Simulator</p><h2>${v.off ? 'Not turned on for you' : `${left} more call${left === 1 ? '' : 's'} to unlock`}</h2>
   <p class="lede">${v.off ? 'Your admin has the Sales Simulator turned off for your account. Ask them if you think that\u2019s a mistake.' : `Every lead you finish with a result counts, booked or not. At ${need} you unlock the Sales Simulator: call an AI business that picks up, pushes back and decides whether to book your demo.`}</p></div></div>
   <div class="peek" aria-hidden="true"><p class="t">Mike’s Auto, this is Kevin.</p><p class="y">Hey Kevin, I’ll be quick. My team already built a website for the shop, free to look at…</p><p class="t">Okay… what’s the catch?</p></div></div></div>`;
  requestAnimationFrame(() => { const fg = el.querySelector('.arc'); if (fg) fg.style.strokeDashoffset = (C * (1 - done / need)).toFixed(1) });
}

/* Setup, one question per screen, in the same style as the caller application (.ob classes from the page):
   who you are calling, how hard, what stays hidden, microphone and voice, then the dial screen. */
const STEPS = ['business', 'level', 'hidden', 'gear', 'dial'];
function setupView(v, msgText = '', at = 0) {
  const ch = choiceDefault(), cp = caps(), pref = store.get('engines', {});
  const eng = { ear: pref.ear && (pref.ear !== 'browser' || cp.sr) && (pref.ear !== 'whisper' || cp.mic) ? pref.ear : !cp.mic ? 'type' : cp.weak && cp.sr ? 'browser' : 'whisper',
    voice: pref.voice === 'studio' && cp.gpu ? 'studio' : 'standard' };
  const left = v.admin ? null : Math.max(0, (+v.daily || 0) - (+v.today || 0));
  const blocked = !v.enabled ? 'The Sales Simulator is switched off right now.' : v.paused ? 'Practice calls are paused for the rest of the month.' : left === 0 ? 'That’s all your practice calls for today. Come back tomorrow.' : VIEW.viewAs ? 'Preview only. Sign in as this person to make a practice call.' : '';
  let i = Math.max(0, Math.min(STEPS.length - 1, at)), dir = 1, pi = store.get('pitch', 0) % PITCHES.length;
  el.innerHTML = `<div class="cv"><div class="ob cvob"><div class="ob-top"><button type="button" class="ob-back" id="obback" aria-label="Back"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <div class="ob-prog" role="progressbar" aria-label="Setup progress" aria-valuemin="1" aria-valuemax="${STEPS.length}"><i id="obbar"></i></div><span class="ob-count" id="obcount"></span></div><div id="obstage"></div></div></div>`;
  const opt = (id, on, label, extra = '', n = 0, dis = false) => `<button type="button" class="ob-opt" role="radio" aria-checked="${on}" data-v="${id}" style="--n:${n}"${dis ? ' disabled' : ''}>${label}${extra}</button>`;
  const pips = k => `<span class="ob-pips" aria-hidden="true">${[1, 2, 3].map(x => `<i class="${x <= k ? 'on' : ''}"></i>`).join('')}</span>`;
  const hearLine = () => eng.ear === 'type' ? `${svg('keys', 16)}<span>You’ll type your side of the call.</span>` : `${svg('mic', 16)}<span>${eng.ear === 'whisper' ? 'Mic on. Your voice becomes text on this device.' : 'Mic on. Your browser’s speech service turns your voice into text.'}</span>`;
  const SCREENS = {
    business: () => `<h2 class="ob-q">Who are you calling?</h2><p class="ob-sub">Pick the kind of business. The name, the town and who picks up are made up fresh every call.</p>
      <div class="ob-opts cvbiz" role="radiogroup" aria-label="Business">${BUSINESS.map(([id, l, ic], n) => opt(id, ch.business === id, `<span class="cvic">${svg(ic, 22)}</span><span class="cvl">${E(l)}</span>`, '', n)).join('')}</div>`,
    level: () => `<h2 class="ob-q">How hard should it be?</h2><p class="ob-sub">Harder calls bring more pushback and less patience.</p>
      <div class="ob-opts" role="radiogroup" aria-label="Difficulty">${LEVEL.map(([id, l, d], n) => opt(id, ch.level === id, `<span class="cvl2"><b>${E(l)}</b><small>${E(d)}</small></span>`, pips(n + 1), n)).join('')}</div>`,
    hidden: () => `<h2 class="ob-q">Some things you only find out on the call</h2><p class="ob-sub">Like a real cold call, you won’t know these until someone picks up. Your report shows all three afterwards.</p>
      <div class="cvdeck">${[['Who picks up', 'The owner, or an employee who may or may not put you through'], ['Their mood', 'Busy, friendly, skeptical, grumpy, quiet or chatty'], ['Their pushback', 'Price, “send me the link”, “we have Facebook” and more']].map(([t, d], n) => `<div class="cvcard" style="--n:${n}"><span class="cvq">?</span><b>${t}</b><small>${d}</small></div>`).join('')}</div>
      <div class="ob-go"><button class="pri" type="submit">Next</button><span class="ob-hint">or press Enter</span></div>`,
    gear: () => `<h2 class="ob-q">How should the call sound?</h2><p class="ob-sub">Your choice is remembered on this device.</p>
      <p class="cvgl">How they hear you</p><div class="ob-opts" role="radiogroup" aria-label="How they hear you" data-k="ear">
        ${opt('whisper', eng.ear === 'whisper', `<span class="cvl2"><b>Microphone</b><small>${cp.mic ? `Your voice becomes text on this device. ${cp.gpu ? '120' : '41'} MB, first call only.` : 'This browser has no microphone access.'}</small></span>`, '', 0, !cp.mic)}
        ${opt('browser', eng.ear === 'browser', `<span class="cvl2"><b>Microphone, browser service</b><small>${cp.sr ? 'No download. Sends your audio to Google or Apple.' : 'Not available in this browser.'}</small></span>`, '', 1, !cp.sr)}
        ${opt('type', eng.ear === 'type', `<span class="cvl2"><b>Typing</b><small>Type what you would say.</small></span>`, '', 2)}</div>
      <p class="cvgl">Their voice</p><div class="ob-opts" role="radiogroup" aria-label="Their voice" data-k="voice">
        ${opt('studio', eng.voice === 'studio', `<span class="cvl2"><b>Studio</b><small>${cp.gpu ? 'Natural and smooth. 325 MB, first call only.' : 'Needs a laptop or desktop with a graphics chip.'}</small></span>`, '', 3, !cp.gpu)}
        ${opt('standard', eng.voice === 'standard', `<span class="cvl2"><b>Standard</b><small>Starts instantly. Sounds more like a computer.</small></span>`, '', 4)}</div>
      <p class="note bad" id="cvperm" hidden></p>
      <div class="ob-go"><button class="pri" type="submit">Next</button><span class="ob-hint">or press Enter</span></div>`,
    dial: () => `<h2 class="ob-q">Ready when you are</h2><p class="ob-sub">Your one job is to book the 15-minute demo with the team. Don’t sell and don’t quote prices.</p>
      <div class="mission"><span class="ic">${svg('phone', 18)}</span><div><b>Something like</b><q id="cvq">${E(PITCHES[pi])}</q><p class="alt mute">Say it your own way. <button type="button" class="link" id="cvpitch">Another way to say it</button></p></div></div>
      <div class="cvdial"><button type="button" class="dialbtn" id="cvgo" ${blocked ? 'disabled' : ''} aria-label="Call ${E(callee(ch.business))}">${svg('phone', 30)}</button>
       <div class="to"><b>Call ${E(callee(ch.business))}</b><span>${E(LEVEL.find(l => l[0] === ch.level)[1])}, ${left == null ? 'no daily limit for the admin' : `${left} of ${+v.daily} calls left today`}, up to ${+v.max_minutes || 8} minutes</span></div></div>
      <p class="hear" id="cvhear">${hearLine()}</p>
      <p class="note bad" id="cvmsg" role="status">${E(blocked || msgText)}</p>
      ${v.admin ? `<p class="admin">This month: $${(+v.month_usd || 0).toFixed(2)} of $${(+v.month_cap || 0).toFixed(2)} spent on ${+v.month_calls || 0} practice call${+v.month_calls === 1 ? '' : 's'}</p>` : ''}` };
  const draw = () => {
    const id = STEPS[i];
    el.querySelector('#obbar').style.width = `${((i + 1) / STEPS.length) * 100}%`;
    el.querySelector('#obcount').textContent = `${i + 1}/${STEPS.length}`;
    el.querySelector('.ob-prog').setAttribute('aria-valuenow', i + 1);
    el.querySelector('#obback').style.visibility = i ? 'visible' : 'hidden';
    el.querySelector('#obstage').innerHTML = `<form class="ob-step" id="obf" novalidate style="--d:${dir}">${SCREENS[id]()}</form>`;
    const f = el.querySelector('#obf');
    f.onsubmit = e => { e.preventDefault(); if (id !== 'dial') go(1) };
    // single choices move on by themselves, like the application
    if (id === 'business' || id === 'level') f.querySelectorAll('.ob-opt').forEach(b => b.onclick = () => {
      ch[id] = b.dataset.v; store.set('choice', ch); f.querySelectorAll('.ob-opt').forEach(x => x.setAttribute('aria-checked', x === b)); setTimeout(() => go(1), 260) });
    if (id === 'gear') {
      f.querySelectorAll('[data-k]').forEach(g => g.querySelectorAll('.ob-opt').forEach(b => b.onclick = () => {
        eng[g.dataset.k] = b.dataset.v; store.set('engines', eng); g.querySelectorAll('.ob-opt').forEach(x => x.setAttribute('aria-checked', x === b)) }));
      navigator.permissions?.query({ name: 'microphone' }).then(s => { const p = el.querySelector('#cvperm'); if (p && s.state === 'denied') { p.hidden = false; p.textContent = micWhy({ name: 'NotAllowedError' }) } }).catch(() => {});
    }
    if (id === 'dial') {
      el.querySelector('#cvpitch').onclick = () => { pi = (pi + 1) % PITCHES.length; store.set('pitch', pi); el.querySelector('#cvq').textContent = PITCHES[pi] };
      el.querySelector('#cvgo').onclick = () => startCall({ business: ch.business, level: ch.level }, { ...eng });
    }
    const first = f.querySelector('[aria-checked=true]') || f.querySelector('.pri,#cvgo'); if (first && document.activeElement?.closest?.('.cvob')) first.focus({ preventScroll: true });
  };
  const go = d => { const n = i + d; if (n < 0 || n >= STEPS.length) return; dir = d; i = n; draw(); scrollTo({ top: 0 }) };
  el.querySelector('#obback').onclick = () => go(-1);
  draw();
}

async function startCall(choice, eng) {
  const go = el.querySelector('#cvgo'), msg = el.querySelector('#cvmsg'); if (go) go.disabled = true;
  const say = t => { if (msg) { msg.className = 'note'; msg.textContent = t } };
  const c = CALL = { choice, eng, hist: [], state: 'loading', dead: false, ended: false, done: false, lvYou: 0, muted: false };
  makeSpeaker(eng.voice, 'm', 0).unlock();   // must happen on the tap
  const notes = [];
  try {   // downloads first, so they never use the call's minutes or one of the day's calls
    const load = [];
    if (eng.ear === 'whisper') { const pr = progressOf(); say('Getting the line ready…'); const gpu = caps().gpu; load.push(ask('asr-load', { gpu }, p => say(`Getting the line ready… ${pr(p)}% (${gpu ? '120' : '41'} MB, only the first time)`), null, 60000)) }
    if (eng.voice === 'studio') { const pr = progressOf(); load.push(ask('tts-load', {}, p => say(`Loading the studio voice… ${pr(p)}% (325 MB, only the first time)`), null, 60000).catch(e => { eng.voice = 'standard'; notes.push(['The studio voice did not load, so the standard voice is on.', e]) })) }
    await Promise.all(load);
  } catch (e) { eng.ear = caps().sr ? 'browser' : 'type'; notes.push([eng.ear === 'browser' ? 'The on-device microphone model did not load, so the browser’s speech service is listening.' : 'The microphone model did not load. Type your side below.', e]) }
  if (c.dead || CALL !== c) return;
  let s;
  try { s = await postJson({ action: 'start', setup: choice }) } catch (e) { if (CALL === c) CALL = null; if (go) go.disabled = false; if (msg) { msg.className = 'note bad'; msg.textContent = e.message } return }
  if (c.dead) return;
  Object.assign(c, { id: s.call_id, p: s.prospect, deadline: Date.now() + s.max_minutes * 60e3, dialedAt: Date.now() });
  liveView(c); notes.forEach(([t, e]) => note(c, t, e));
  if (eng.voice === 'standard' && !speechSynthesis.getVoices().length) await new Promise(r => { speechSynthesis.addEventListener('voiceschanged', r, { once: true }); setTimeout(r, 1500) });   // Chrome fills the voice list late
  c.g = c.p.voice; c.speaker = makeSpeaker(eng.voice, c.g, c.id);
  c.ring = ringback();
  const on = () => !c.muted && (c.state === 'listening' || c.state === 'hearing' || (c.state === 'thinking' && !c.spokeThisTurn));
  c.turn = { text: '', endedAt: 0, timer: 0, pending: 0 };
  try {
    if (eng.ear === 'whisper') c.ear = await openMic({ on, level: lv => { c.lvYou = lv }, start: () => voiceStarted(c), cancel: () => scheduleTurn(c),
      utter: async (a, endedAt) => { if (c.dead || c.state !== 'hearing') return; c.turn.pending++; let t = ''; try { t = clean((await ask('asr', { audio: a }, null, [a.buffer])).text) } catch {} c.turn.pending--; if (c.dead) return; heard(c, t, endedAt) } });
    else if (eng.ear === 'browser') c.ear = openBrowserEar({ on, start: () => { c.lvYou = 0.5; voiceStarted(c) }, text: t => { c.lvYou = 0; if (!c.dead) heard(c, clean(t), performance.now()) } });
  } catch (e) { eng.ear = 'type'; note(c, micWhy(e), e); toggleType(c, true) }
  if (eng.ear === 'type' && !c.ear && !c.noteSet) note(c, 'Typing only, as set in Microphone and voice. Switch the microphone on there for your next call.');
  c.tick = setInterval(() => tick(c), 500); traceLoop(c);
  prospectTurn(c);
}

function liveView(c) {
  const b = bizLabel(c.choice.business);
  el.innerHTML = `<div class="cv"><div class="phone" data-s="dialing">
   <div class="status"><span class="on"><i class="dot"></i><span id="cvst">Calling…</span></span><span class="left" id="cvleft"></span></div>
   <div class="cid"><div class="av" aria-hidden="true">${E(initials(c.p.shop) || '?')}</div><div><b>${E(c.p.shop)}</b><span>${E(b)} in ${E(c.p.town)}</span></div></div>
   <div><canvas class="trace" id="cvtrace" aria-hidden="true"></canvas><div class="legend" aria-hidden="true"><span><i style="background:var(--you)"></i>You</span><span><i style="background:var(--them)"></i>Them</span></div></div>
   <div class="sub" id="cvsub" data-w="sys" aria-live="polite"><small id="cvwho"></small><p id="cvsay">Ringing…</p></div>
   <p class="note2" id="cvnote"></p>
   <form class="typebar" id="cvtype" hidden><input id="cvin" autocomplete="off" placeholder="Type what you would say" aria-label="Type what you would say"><button>Say it</button></form>
   <div class="log" id="cvlog" hidden aria-label="Transcript"></div>
   <div class="ctl"><figure><button type="button" id="cvmute" aria-pressed="false" aria-label="Mute">${svg('mic', 22)}</button><figcaption>Mute</figcaption></figure>
    <figure><button type="button" class="hang" id="cvhang" aria-label="End call">${svg('end', 26)}</button><figcaption>End call</figcaption></figure>
    <figure><button type="button" id="cvkeys" aria-pressed="false" aria-label="Type instead">${svg('keys', 22)}</button><figcaption>Type</figcaption></figure>
    <figure><button type="button" id="cvlogbtn" aria-pressed="false" aria-label="Show transcript">${svg('list', 22)}</button><figcaption>Transcript</figcaption></figure></div>
  </div></div>`;
  el.querySelector('#cvmute').onclick = e => { c.muted = !c.muted; const bt = e.currentTarget; bt.setAttribute('aria-pressed', c.muted); bt.innerHTML = svg(c.muted ? 'micoff' : 'mic', 22); if (c.state === 'listening' || c.state === 'hearing') setState(c, 'listening') };
  el.querySelector('#cvkeys').onclick = () => toggleType(c);
  el.querySelector('#cvlogbtn').onclick = e => { const lg = el.querySelector('#cvlog'); lg.hidden = !lg.hidden; e.currentTarget.setAttribute('aria-pressed', !lg.hidden) };
  el.querySelector('#cvtype').onsubmit = e => { e.preventDefault(); const i = el.querySelector('#cvin'), t = i.value.trim(); if (!t || c.streaming || !['listening', 'hearing'].includes(c.state)) return; i.value = ''; c.typedAt = Date.now(); repSaid(c, t.slice(0, 600)) };
  el.querySelector('#cvhang').onclick = () => finish(c, 'hangup');
  // Tapping the business's subtitle while they talk cuts them off, like talking over someone.
  el.querySelector('#cvsub').onclick = () => { if (c.state === 'speaking') { c.skip = true; c.speaker?.stop(); c.speaker = makeSpeaker(c.eng.voice, c.g, c.id) } };
}
function toggleType(c, force) { const f = el?.querySelector('#cvtype'), k = el?.querySelector('#cvkeys'); if (!f) return; f.hidden = force === true ? false : !f.hidden; k?.setAttribute('aria-pressed', !f.hidden); if (!f.hidden) el.querySelector('#cvin').focus() }

/* The trace: a strip chart of the line. You above the centre rule in violet, them below it in amber. */
function traceLoop(c) {
  const cv = el.querySelector('#cvtrace'); if (!cv) return; const ctx = cv.getContext('2d'), N = 120, you = new Array(N).fill(0), them = new Array(N).fill(0); let last = 0;
  const draw = t => {
    if (c.dead || !document.body.contains(cv)) return;
    c.raf = requestAnimationFrame(draw); if (t - last < 45) return; last = t;
    const dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr) }
    const typed = Date.now() - (c.typedAt || 0) < 1400, yl = typed ? 0.25 + Math.random() * 0.35 : (c.state === 'listening' || c.state === 'hearing') && !c.muted ? c.lvYou : 0, tl = c.state === 'speaking' ? (c.speaker?.level() || 0) : 0;
    you.push(Math.min(1, yl * 1.4)); you.shift(); them.push(tl); them.shift();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const mid = h / 2, step = w / N, bw = Math.max(1.5, step * 0.55), css = getComputedStyle(cv);
    ctx.fillStyle = css.getPropertyValue('--line-rule').trim() || '#26324f'; ctx.fillRect(0, mid - 0.5, w, 1);
    ctx.fillStyle = css.getPropertyValue('--you').trim(); you.forEach((v, i) => { if (v > 0.02) { const hh = Math.max(1, v * (mid - 6)); ctx.fillRect(i * step, mid - 2 - hh, bw, hh) } });
    ctx.fillStyle = css.getPropertyValue('--them').trim(); them.forEach((v, i) => { if (v > 0.02) { const hh = Math.max(1, v * (mid - 6)); ctx.fillRect(i * step, mid + 2, bw, hh) } });
  };
  c.raf = requestAnimationFrame(draw);
}

function setState(c, s) {
  if (c.dead) return; c.state = s; const ph = el.querySelector('.phone'); if (!ph) return;
  if (s !== 'dialing' && s !== 'loading') ph.dataset.s = 'live';
  if (s === 'listening' || s === 'hearing') sub(c, 'sys', c.muted ? 'You’re muted' : s === 'hearing' ? 'Listening…' : c.eng.ear === 'type' || !c.ear ? 'Your turn. Type what you’d say.' : 'Your turn. Go ahead.', '');
  if (s === 'thinking') sub(c, 'sys', '…', '');
}
function sub(c, w, text, who) { const s = el?.querySelector('#cvsub'); if (!s || c.dead) return; s.dataset.w = w; el.querySelector('#cvsay').textContent = text; el.querySelector('#cvwho').textContent = who ?? '' }
function micWhy(e) {
  const n = e?.name || '';
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Chrome isn\u2019t allowed to use your microphone. Click the icon just left of the web address, set Microphone to Allow, and call again. If it already says Allow, open System Settings \u2192 Privacy & Security \u2192 Microphone and turn on Google Chrome.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No microphone was found. Plug one in or connect headphones with a mic, then call again. You can type for now.';
  if (n === 'NotReadableError' || n === 'AbortError') return 'Another app is using the microphone (Zoom, FaceTime, a recorder). Close it and call again. You can type for now.';
  return 'The microphone didn\u2019t start, so type your side of the call for now.';
}
const note = (c, t, e) => { if (c) c.noteSet = true; if (e) console.warn('[call voice]', e); const h = el?.querySelector('#cvnote'); if (h && !c.dead) h.textContent = t };
function logLine(c, who, text) { const lg = el?.querySelector('#cvlog'); if (!lg) return null; const p = document.createElement('p'); p.className = who === 'rep' ? 'y' : 't'; p.innerHTML = `<b>${who === 'rep' ? 'You' : 'Them'}</b><span></span>`; p.lastChild.textContent = text; lg.appendChild(p); lg.scrollTop = lg.scrollHeight; return p.lastChild }
function tick(c) {
  const left = Math.max(0, Math.round((c.deadline - Date.now()) / 1000)), l = el?.querySelector('#cvleft'), st = el?.querySelector('#cvst');
  if (l) { l.textContent = `${mmss(left)} left`; l.classList.toggle('low', left < 60) }
  if (st && c.pickedAt) st.textContent = `On the line ${mmss(Math.round((Date.now() - c.pickedAt) / 1000))}`;
  if (!left && !c.ended) { c.ended = true; if (c.state === 'listening' || c.state === 'hearing') finish(c, 'time') }
}
/* When is the caller done talking? A clear question goes after 0.7 s of quiet, a finished sentence after 1.5 s, anything
   that trails off ("and", "so", "um", a comma) waits 2 s. Talking again before that, or before the business starts
   answering, joins the same turn. */
const TRAIL = /\b(and|but|so|or|because|cause|um+|uh+|er+|like|the|a|an|to|of|with|for|if|that|which|my|our|your|their|is|are|was|were|we|i|you|just|then|also|um)$/i;
function turnWait(text) {
  const s = text.trim(); if (!s) return 2000;
  if (/\?["'”]?$/.test(s)) return 700;   // a question is a handover, whatever its last word
  const last = s.replace(/[.!?,…"'”]+$/, '').split(/\s+/).pop() || '';
  if (TRAIL.test(last) || /[,…;:-]$/.test(s)) return 2000;
  if (/[.!]["'”]?$/.test(s) && s.split(/\s+/).length >= 3) return 1500;   // Whisper adds full stops to half sentences, so statements wait longer than questions
  return 2000;
}
function voiceStarted(c) {
  clearTimeout(c.turn.timer);
  if (c.state === 'thinking' && !c.spokeThisTurn && c.streaming) return retract(c);   // he kept talking: take the turn back
  if (c.state === 'listening') setState(c, 'hearing');
}
function heard(c, t, endedAt) {
  if (t) { c.turn.text = (c.turn.text + ' ' + t).trim(); c.turn.endedAt = endedAt; sub(c, 'you', c.turn.text, 'You') }
  scheduleTurn(c);
}
function scheduleTurn(c) {
  clearTimeout(c.turn.timer); if (c.dead || c.turn.pending) return;
  if (!c.turn.text) { if (c.state === 'hearing') setState(c, 'listening'); return }
  const wait = turnWait(c.turn.text) - (performance.now() - c.turn.endedAt);
  c.turn.timer = setTimeout(() => { const t = c.turn.text; c.turn.text = ''; if (t && !c.dead && ['listening', 'hearing'].includes(c.state)) repSaid(c, t) }, Math.max(0, wait));
}
function retract(c) {   // the reply has not started playing yet: cancel it and keep listening to the same turn
  c.retracting = true; c.skip = true; c.abort?.abort(); c.speaker?.stop(); c.speaker = makeSpeaker(c.eng.voice, c.g, c.id);
}
/* The studio voice makes speech about 2.6x faster than it plays (≈0.3 s + 0.023 s per character to make, 0.06 s per
   character to play). A piece is ready in time only if it is at most ~2.4x the previous one, so long replies are cut at
   sentence or comma breaks into growing pieces: 15, 35, 85 ... characters. */
function pieces(text, prev) {
  const out = []; let rest = text.trim();
  while (rest) {
    const cap = prev ? Math.max(40, Math.round(prev * 2.4)) : rest.length;
    if (rest.length <= cap) { out.push(rest); break }
    const win = rest.slice(0, Math.round(cap * 1.2) + 1), min = Math.round(cap * 0.45);   // a natural break may run 20% long
    const best = re => { let k = -1, m; const r = new RegExp(re, 'g'); while ((m = r.exec(win))) { const e = m.index + m[0].length; if (e >= min) k = e } return k };
    let cut = best('[.!?…]["\'”)]*\\s'); if (cut < 0) cut = best('[,;:]\\s'); if (cut < 0) { const sp = rest.lastIndexOf(' ', cap); cut = sp > min ? sp + 1 : cap }
    out.push(rest.slice(0, cut).trim()); prev = cut; rest = rest.slice(cut).trim();
  }
  return out.filter(Boolean);
}
function repSaid(c, text) { if (c.dead || c.ended || c.streaming) return; c.hist.push({ who: 'rep', text }); sub(c, 'you', text, 'You'); logLine(c, 'rep', text); prospectTurn(c) }

async function pickUp(c) {   // at least one full ring before anyone answers, like a real call
  const wait = 2300 - (Date.now() - c.dialedAt); if (wait > 0) await new Promise(r => setTimeout(r, wait));
  if (c.dead || c.pickedAt) return; c.ring?.stop(); c.ring = null; pickupClick(); c.pickedAt = Date.now();
  const st = el?.querySelector('#cvst'); if (st) st.textContent = 'On the line 0:00'; el?.querySelector('.phone')?.setAttribute('data-s', 'live');
}
async function prospectTurn(c) {
  const first = !c.pickedAt; if (!first) setState(c, 'thinking'); c.skip = false; c.streaming = true; c.spokeThisTurn = false; c.retracting = false;
  const t0 = performance.now(); let firstMs = 0, text = '', pend = '', span = null, ended = false, err = '', gate = first ? null : Promise.resolve();
  try {
    c.abort = new AbortController();
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN(), { method: 'POST', signal: c.abort.signal, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + data?.session?.access_token, apikey: window.LEADS_CONFIG?.key || '' }, body: JSON.stringify({ action: 'turn', call_id: c.id, history: c.hist }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'The line dropped.') }
    const rd = r.body.getReader(), dec = new TextDecoder(); let raw = '';
    let after = null;   // set when the voice switches mid-reply, so the owner waits for the employee to finish
    // Fewer, longer pieces sound like one person talking: the first piece starts once there is a full sentence of 15+
    // characters (or at a comma after 30), everything after it goes as one piece (or every ~140 characters on a long reply).
    let chunk = '', spoke = false, lastLen = 0;
    const flush = force => {
      if (!spoke && !chunk) { const k = pend.lastIndexOf(', '); if (k >= 30) { chunk = pend.slice(0, k + 1); pend = pend.slice(k + 2) } }   // a long first sentence starts at a comma
      const n = chunk.replace(/\[\[\w+\]\]/g, '').trim().length; if (!n) return;
      if (force || (!spoke && n >= 15) || (spoke && n >= 140)) { for (const p of c.eng.voice === 'studio' ? pieces(chunk, lastLen) : [chunk]) { speak(p); lastLen = p.length } chunk = ''; spoke = true } };
    const say1 = t => { t = t.trim(); if (!t || c.skip) return; if (!gate) { gate = pickUp(c); showText() }   // studio audio renders while the phone still rings
      c.speaker.say(t, () => { if (!c.skip && !c.dead) { c.spokeThisTurn = true; setState(c, 'speaking') } }, after || gate) };
    const speak = s => { s = s.replace(/\[\[END\]\]/g, ''); const k = s.indexOf('[[OWNER]]');
      if (k < 0 || c.handed) return say1(s);
      say1(s.slice(0, k)); c.handed = true;   // the employee hands the phone to the owner: the owner's own voice from here on
      const prev = c.speaker; after = Promise.all([gate, prev.idle()]); c.g = c.p.owner_voice || c.g; c.speaker = makeSpeaker(c.eng.voice, c.g, c.id + 1);
      say1(s.slice(k + 9)) };
    const showText = () => { if (!gate) return; /* nothing shows until they pick up */ gate.then(() => { const t = text.replace(/\[\[(END|OWNER)\]\]/g, ' ').replace(/\s+/g, ' ').trim(); if (c.dead) return; sub(c, 'them', t, 'Them'); span ??= logLine(c, 'prospect', ''); if (span) span.textContent = t }) };
    for (;;) {
      const { value, done } = await rd.read(); if (done) break; raw += dec.decode(value, { stream: true });
      let nl; while ((nl = raw.indexOf('\n')) >= 0) { const line = raw.slice(0, nl); raw = raw.slice(nl + 1); if (!line) continue; const m = JSON.parse(line);
        if (m.t === 'd') { if (!firstMs) firstMs = performance.now() - t0; text += m.text; pend += m.text; const [ss, rest] = sentences(pend); pend = rest; ss.forEach(x => { chunk += (chunk ? ' ' : '') + x }); flush(false); showText() }
        else if (m.t === 'end') ended = !!m.ended; else if (m.t === 'err') err = m.msg }
    }
    chunk += (chunk ? ' ' : '') + pend; pend = ''; flush(true); showText();
  } catch (e) { if (c.dead) return; if (e.name !== 'AbortError') console.warn('[call voice]', e); err = e.name === 'AbortError' ? '' : e.message }
  c.streaming = false;
  if (c.dead) return;
  if (c.retracting) {   // he was still talking: put his words back and keep listening
    c.retracting = false; const last = c.hist.pop(); if (last?.who !== 'rep') { if (last) c.hist.push(last) } else { c.turn.text = (last.text + ' ' + c.turn.text).trim(); c.turn.endedAt = performance.now() }
    span?.parentElement?.remove(); const lg = el.querySelector('#cvlog'); lg?.lastChild?.classList.contains('y') && lg.lastChild.remove();
    setState(c, 'hearing'); sub(c, 'you', c.turn.text, 'You'); return;
  }
  window.callVoice._last = { firstTextMs: Math.round(firstMs) };
  const said = text.replace(/\[\[(END|OWNER)\]\]/g, ' ').replace(/\s+/g, ' ').trim();
  if (said) c.hist.push({ who: 'prospect', text: said.slice(0, 600) });
  else if (!err) err = 'No one answered.';
  if (err && !said) { c.ring?.stop(); note(c, err); return finish(c, 'error', err) }
  await gate; await c.speaker.idle(); if (c.dead) return;
  if (ended) { sub(c, 'sys', 'They hung up.', ''); await new Promise(r => setTimeout(r, 900)) }
  if (ended || c.ended || err) return finish(c, ended ? 'prospect' : 'time');
  setState(c, 'listening');
}

async function finish(c, why, err) {
  if (c.done || c.dead) return; c.done = true; c.ended = true; clearInterval(c.tick); c.ring?.stop(); c.ear?.stop(); c.abort?.abort(); c.speaker?.stop();
  const secs = c.pickedAt ? Math.round((Date.now() - c.pickedAt) / 1000) : 0, reps = c.hist.filter(h => h.who === 'rep').length;
  if (reps < 1) { cancelAnimationFrame(c.raf); post({ action: 'hangup', call_id: c.id }).catch(() => {}); CALL = null; return setupView(MY, err || '', 4) }
  c.state = 'scoring'; const ph = el.querySelector('.phone'); if (ph) ph.dataset.s = 'ended';
  sub(c, 'sys', 'Call ended. Writing up your call…', ''); const st = el.querySelector('#cvst'); if (st) st.textContent = `Call ended ${mmss(secs)}`;
  let fb = null, fe = '';
  try { fb = await postJson({ action: 'feedback', call_id: c.id, history: c.hist }) } catch (e) { fe = e.message }
  if (CALL !== c) return; CALL = null; cancelAnimationFrame(c.raf);
  report(c, fb, fe, secs, reps);
}

function report(c, fb, fe, secs, reps) {
  const again = `Call ${callee(c.choice.business).replace(/^an? /, 'another ')}`;
  const li = a => (a || []).slice(0, 2).map(x => `<li>${E(x)}</li>`).join('');
  const tick = (ok, text) => `<li class="${ok ? 'y' : 'no'}">${svg(ok ? 'check' : 'cross', 18)}<span>${E(text)}</span></li>`;
  const ck = fb?.checks || {}, rv = fb?.reveal, score = Math.max(0, Math.min(10, +fb?.score || 0)), C = 2 * Math.PI * 48;
  el.innerHTML = `<div class="cv"><div class="panel rep">${fb ? `
   <div class="verdict"><div class="score" role="img" aria-label="Score ${score} out of 10"><svg viewBox="0 0 112 112" width="112" height="112"><circle class="trk" cx="56" cy="56" r="48"/><circle class="arc" cx="56" cy="56" r="48" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"/></svg><div class="ctr"><b>${score}</b><span>out of 10</span></div></div>
    <div><span class="stamp ${fb.booked ? 'yes' : 'no'}">${svg(fb.booked ? 'check' : 'cross', 14)} ${fb.booked ? 'Demo booked' : 'No demo booked'}</span><h2>${E(fb.summary || (fb.booked ? 'You booked it.' : 'Not this time.'))}</h2>
    <p class="lede">${E(c.p.shop)}, ${mmss(secs)} on the line, ${reps} thing${reps === 1 ? '' : 's'} you said</p></div></div>
   ${rv ? `<div><p class="k">Who you got</p><div class="reveal">
    <div class="mys"><span>Picked up</span><b>${E(rv.answer)}<small>${rv.staff ? `${E(rv.staff)} answered. The owner is ${E(rv.owner)}.` : `${E(rv.owner)}, the owner`}</small></b></div>
    <div class="mys"><span>Their mood</span><b>${E(rv.personality)}</b></div>
    <div class="mys"><span>Their pushback</span><b>${(rv.objections || []).map(o => E(o)).join('<br>')}</b></div></div></div>` : ''}
   <div class="cols"><div><p class="k">How the call went</p><ul class="ticks">${tick(ck.short_opener, 'Short opener that respected their time')}${tick(ck.said_already_built, 'Said the site is already built and free to look at')}${tick(ck.no_selling, 'Didn’t sell or talk prices')}${tick(ck.asked_specific_time, 'Offered a specific day and time')}${tick(ck.confirmed_details, 'Locked in the time, or got a name and callback time')}</ul></div>
    <div><p class="k">Pushback you heard</p><ul class="ticks">${(fb.objections || []).length ? fb.objections.slice(0, 4).map(o => tick(o.handled, o.said)).join('') : '<li class="mute">None came up.</li>'}</ul></div></div>
   <div class="cols notes">${li(fb.went_well) ? `<div><p class="k">Went well</p><ul>${li(fb.went_well)}</ul></div>` : ''}${li(fb.work_on) ? `<div><p class="k">Work on</p><ul>${li(fb.work_on)}</ul></div>` : ''}</div>
   ${fb.next_try ? `<div><p class="k">Try saying</p><p class="tryline">${E(fb.next_try)}</p></div>` : ''}`
  : `<h2>Call ended</h2><p class="lede">${E(fe || 'No write-up this time.')}</p>`}
   <div class="again"><button class="go1" id="cvagain">${svg('phone', 18)} ${E(again)}</button><button id="cvchange">Change business</button></div></div></div>`;
  requestAnimationFrame(() => { const fg = el.querySelector('.score .arc'); if (fg) fg.style.strokeDashoffset = (C * (1 - score / 10)).toFixed(1) });
  el.querySelector('#cvagain').onclick = async () => { MY.today = (+MY.today || 0) + 1; setupView(MY, '', 4); el.querySelector('#cvgo')?.click() };
  el.querySelector('#cvchange').onclick = () => { MY.today = (+MY.today || 0) + 1; setupView(MY, '', 0) };
}

window.callVoice = { mount, stop, _test: { pieces, turnWait, clean, sentences, resample, pickVoice, caps, ask, initials, call: () => CALL && { g: CALL.g, first: CALL.p?.voice, owner: CALL.p?.owner_voice, handed: !!CALL.handed } } };
})();
