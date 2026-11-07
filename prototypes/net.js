/* Bytefight net.js: two-player rooms on any static host (GitHub Pages).
 *
 * Implements the same small API the games use from claude.ai's `room` capability:
 *   const r = await room.join(name)
 *   r.presence(partial)      -> merges into my presence and shares it
 *   r.onPeers(cb, onError)   -> cb({peers:[{peer, sameTab, presence}]}) on every change
 *   r.leave()
 *
 * Transport: Trystero (WebRTC data channels). Browsers find each other through several public
 * Nostr relays at once, so one relay going down does not break rooms, and there is no server of ours.
 * After that, game data flows browser-to-browser. Every member sends its full presence to everyone.
 */
(function () {
  const LIBS = ['https://cdn.jsdelivr.net/npm/@trystero-p2p/nostr@0.26.0/+esm', 'https://esm.sh/@trystero-p2p/nostr@0.26.0'];   // second CDN as fallback
  const APP_ID = 'learn-easily-bytefight';
  let libP = null;
  async function importFirst(urls) { let last; for (const u of urls) { try { return await import(u); } catch (e) { last = e; } } throw last; }
  const loadLib = () => libP || (libP = importFirst(window.bytefightNetLib ? [window.bytefightNetLib] : LIBS).catch(e => { libP = null; throw e; }));
  const err = code => Object.assign(new Error(code), {code});

  async function join(name) {
    const lib = await loadLib().catch(() => { throw err('network'); });
    let mine = {}, peersCb = null, errCb = null, left = false, queued = false;
    const others = new Map();                       // peer id -> latest presence

    const cfg = Object.assign({appId: APP_ID}, window.bytefightNetConfig || {});   // override only for local tests
    const room = lib.joinRoom(cfg, String(name).toLowerCase(), {
      onJoinError: d => { if (!left && errCb) errCb(err('join_' + (d && d.error || 'failed'))); },
    });
    const pres = room.makeAction('pres');

    const emit = () => {                            // async and coalesced, like the claude.ai room
      if (queued) return; queued = true;
      setTimeout(() => {
        queued = false;
        if (peersCb && !left) peersCb({peers: [...others].map(([id, p]) => ({peer: id, sameTab: false, presence: p}))});
      }, 0);
    };
    const share = target => pres.send(mine, target ? {target} : undefined).catch(() => {});

    pres.onMessage = (data, ctx) => { others.set(ctx.peerId, data && typeof data === 'object' ? data : {}); emit(); };
    room.onPeerJoin = id => share(id);              // a newcomer gets my current presence at once
    room.onPeerLeave = id => { if (others.delete(id)) emit(); };

    return {
      async presence(partial) {
        if (left) throw err('left');
        mine = Object.assign({}, mine, partial || {});
        share();
      },
      onPeers(cb, onError) { peersCb = cb; errCb = onError; emit(); },
      async leave() { left = true; others.clear(); try { await room.leave(); } catch {} },
    };
  }

  window.bytefightRoom = {join};
})();
