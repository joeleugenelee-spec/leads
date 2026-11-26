/*
 * The "Connect Discord" box for accepted cold callers and managers. Loaded after the main script in index.html
 * and uses its sb, user, ME, VA and esc. The person approves the link on Discord's own page and comes back
 * through /connect/, which leaves Discord's answer in sessionStorage for finish() below. Once linked, their
 * rank role in the Moonshot Sites Callers server follows the site by itself.
 * Connecting is required: route() in index.html calls discordGate() for an accepted person with no link, and
 * they see only the "Connect Discord" screen until they have linked. Admins are never asked.
 * Once linked, a small box shows who they are connected as. Nothing is shown while an admin views as someone.
 */
(() => {
  const APP = '1575324372179226624';
  const SERVER = 'https://discord.com/channels/1575314833522434128';
  const slot = document.createElement('div');
  slot.id = 'dsc';
  document.getElementById('ann').after(slot);
  let shownFor = null, busy = false, carry = '';

  const fn = async (body) => {
    const { data, error } = await sb.functions.invoke('discord-link', { body });
    if (error) {
      let msg = '';
      try { msg = (await error.context.json()).error || ''; } catch (e) {}
      throw new Error(msg || 'Discord did not finish connecting. Try again.');
    }
    return data;
  };

  function start() {
    const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    try { sessionStorage.setItem('moonshot.discord.state', state); } catch (e) { /* the return is refused without it */ }
    location.assign('https://discord.com/oauth2/authorize?' + new URLSearchParams({ client_id: APP, response_type: 'token', redirect_uri: location.origin + '/connect/', scope: 'identify guilds.join', state, prompt: 'consent' }));
  }

  /* Back from Discord: hand its answer to the server once. Returns a line to show, or ''. */
  async function finish() {
    let back = null, state = null;
    try {
      back = JSON.parse(sessionStorage.getItem('moonshot.discord') || 'null');
      state = sessionStorage.getItem('moonshot.discord.state');
      sessionStorage.removeItem('moonshot.discord');
      sessionStorage.removeItem('moonshot.discord.state');
    } catch (e) { return ''; }
    if (!back) return '';
    if (back.error) return back.error === 'access_denied' ? 'Discord was not connected.' : 'Discord did not finish connecting. Try again.';
    if (!back.token || !state || back.state !== state) return 'Discord did not finish connecting. Try again.';
    try {
      const out = await fn({ action: 'link', access_token: back.token });
      return out.in_server ? `Discord connected as ${out.name}. Your role is set.` : `Discord connected as ${out.name}. Join the server to get your role.`;
    } catch (cause) { return cause.message; }
  }

  function draw(name, note) {
    const said = note ? `<p class="mute small" role="status" style="margin:8px 0 0">${esc(note)}</p>` : '';
    slot.innerHTML = name
      ? `<div class="annc"><h3><span>Discord</span><span>Connected</span></h3><p>Connected as <b>${esc(name)}</b>. Your rank role in the Moonshot Sites Callers server updates by itself when your rank changes.</p>
         <div class="row top" style="margin-top:10px"><a href="${SERVER}" target="_blank" rel="noopener noreferrer">Open the Discord</a> <button class="link" id="dsc-off">Disconnect</button></div>${said}</div>`
      : `<div class="annc"><h3><span>Discord</span><span>Not connected</span></h3><p>Join the Moonshot Sites Callers Discord in one tap. You get your rank role straight away, and it updates by itself as you rank up.</p>
         <div class="row top" style="margin-top:10px"><button class="pri" id="dsc-on">Connect Discord</button></div>${said}</div>`;
    const on = document.getElementById('dsc-on'), off = document.getElementById('dsc-off');
    if (on) on.onclick = start;
    if (off) off.onclick = async () => {
      if (off.dataset.sure !== '1') { off.dataset.sure = '1'; off.textContent = 'Confirm: disconnect Discord'; return; }
      off.disabled = true;
      try { await fn({ action: 'unlink' }); shownFor = null; slot.innerHTML = ''; route(); }
      catch (cause) { draw(name, cause.message); }
    };
  }

  /* Decide whether the box belongs on the page right now. Called whenever the main view is redrawn. */
  async function check() {
    const who = user && ME && !ME.is_admin && ME.status === 'accepted' && !VA ? user.id : null;
    if (!who) { shownFor = null; slot.innerHTML = ''; return; }
    if (shownFor === who || busy) return;
    busy = true;
    try {
      const { data, error } = await sb.rpc('my_discord');
      if (!user || user.id !== who || error) return;
      shownFor = who;
      // Not linked while linking is required: the gate screen is showing, so no box as well.
      if (data && data.required && !data.name) { slot.innerHTML = ''; return; }
      draw(data && data.name, carry); carry = '';
    } finally { busy = false; }
  }
  /*
   * The required step. Called by route() for an accepted person who has not linked Discord. If they are just back
   * from Discord, the link is finished first; once it is saved they go straight on to the site.
   */
  window.discordGate = async () => {
    const who = user && user.id;
    const note = await finish();
    const { data } = await sb.rpc('my_discord');
    if (!user || user.id !== who) return;
    if (data && data.name) { carry = note; shownFor = null; return route(); }
    slot.innerHTML = '';
    view.innerHTML = `<div class="card"><h2>Connect Discord to continue</h2>
      <p class="mute small">Everyone on the team has to be in the Moonshot Sites Callers Discord before using this site. It is where announcements, your team's channel and wins are posted.</p>
      <p class="mute small">One tap joins you to the server and gives you your rank and team roles.</p>
      <div class="row top"><button class="pri" id="gate-on">Connect Discord</button></div>
      <p class="note ${note ? 'bad' : ''}" role="status" style="margin-top:12px">${esc(note)}</p></div>`;
    document.getElementById('gate-on').onclick = start;
  };
  new MutationObserver(check).observe(document.getElementById('view'), { childList: true });
  check();
})();
