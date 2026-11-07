/* Bytefight net.js: two-player rooms on any static host (GitHub Pages).
 *
 * Implements the same small API the games use from claude.ai's `room` capability:
 *   const r = await room.join(name)
 *   r.presence(partial)      -> merges into my presence and shares it
 *   r.onPeers(cb, onError)   -> cb({peers:[{peer, sameTab, presence}]}) on every change
 *   r.leave()
 *
 * Transport: PeerJS (WebRTC data channels). PeerJS's free public server only introduces the
 * two browsers; game data then flows browser-to-browser.
 * The first browser to join a room name claims the peer id "bytefight-<name>" and becomes the hub.
 * Everyone else connects to the hub. The hub relays every presence to every member.
 */
(function () {
  const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js';
  let libP = null;
  function loadLib() {
    if (window.Peer) return Promise.resolve(window.Peer);
    if (!libP) libP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = PEERJS_URL; s.async = true;
      s.onload = () => window.Peer ? res(window.Peer) : rej(new Error('peerjs'));
      s.onerror = () => { libP = null; rej(new Error('peerjs')); };
      document.head.appendChild(s);
    });
    return libP;
  }

  const err = code => Object.assign(new Error(code), {code});

  function openPeer(Peer, id) {
    return new Promise((res, rej) => {
      const opts = Object.assign({debug: 0}, window.bytefightPeerOptions || {});   // override only for local tests
      const p = id ? new Peer(id, opts) : new Peer(opts);
      const fail = e => { p.off('open', ok); p.destroy(); rej(e); };
      const ok = () => { p.off('error', fail); res(p); };
      p.once('open', ok);
      p.once('error', fail);
    });
  }

  function waitOpen(conn, ms) {
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(err('timeout')), ms);
      conn.once('open', () => { clearTimeout(t); res(); });
      conn.once('error', () => { clearTimeout(t); rej(err('connect_failed')); });
    });
  }

  async function join(name) {
    const Peer = await loadLib().catch(() => { throw err('network'); });
    const hubId = 'bytefight-' + String(name).toLowerCase().replace(/[^a-z0-9-]/g, '');
    let peer, isHub = true;
    try { peer = await openPeer(Peer, hubId); }
    catch (e) {
      if (e && e.type !== 'unavailable-id') throw err(e && e.type || 'network');
      isHub = false;
      peer = await openPeer(Peer, null).catch(e2 => { throw err(e2 && e2.type || 'network'); });
    }

    const me = peer.id;
    let mine = {};
    let peersCb = null, errCb = null, left = false;
    let others = new Map();                 // peer id -> presence (what this client shows)
    const conns = new Map();                // hub: peer id -> DataConnection
    let hubConn = null;

    let queued = false;               // callbacks run async and coalesced, like the claude.ai room
    const emit = () => {
      if (queued) return; queued = true;
      setTimeout(() => { queued = false; if (peersCb && !left) peersCb({peers: [...others].map(([id, p]) => ({peer: id, sameTab: false, presence: p}))}); }, 0);
    };
    const fail = code => { if (left) return; left = true; try { peer.destroy(); } catch {} if (errCb) errCb(err(code)); };

    // ---- hub ----
    const all = new Map();                  // hub: every member's presence, including the hub itself
    function broadcast(membersChanged) {
      all.set(me, mine);
      const list = [...all];
      for (const c of conns.values()) if (c.open) c.send({t: 'peers', list});
      if (membersChanged) { others = new Map(list.filter(([id]) => id !== me)); emit(); }
    }
    if (isHub) {
      peer.on('connection', c => {
        c.on('open', () => { conns.set(c.peer, c); all.set(c.peer, {}); broadcast(true); });
        c.on('data', m => { if (m && m.t === 'p') { all.set(c.peer, m.p || {}); broadcast(true); } });
        const drop = () => { conns.delete(c.peer); all.delete(c.peer); broadcast(true); };
        c.on('close', drop);
        c.on('error', drop);
      });
    }

    // ---- client ----
    if (!isHub) {
      hubConn = peer.connect(hubId, {reliable: true, serialization: 'json'});
      try { await waitOpen(hubConn, 8000); }
      catch (e) { peer.destroy(); throw e; }
      hubConn.on('data', m => {
        if (m && m.t === 'peers') { others = new Map(m.list.filter(([id]) => id !== me)); emit(); }
      });
      hubConn.on('close', () => { others = new Map(); emit(); fail('host_left'); });
    }

    // keep the signalling link alive; data channels survive a brief broker disconnect
    peer.on('disconnected', () => { if (!left) { try { peer.reconnect(); } catch {} } });
    peer.on('error', e => { if (e && (e.type === 'network' || e.type === 'server-error') && !peer.open && conns.size === 0 && !hubConn) fail(e.type); });

    return {
      async presence(partial) {
        if (left) throw err('left');
        mine = Object.assign({}, mine, partial || {});
        if (isHub) broadcast(false);
        else if (hubConn && hubConn.open) hubConn.send({t: 'p', p: mine});
        else throw err('not_connected');
      },
      onPeers(cb, onError) { peersCb = cb; errCb = onError; emit(); },
      async leave() { left = true; try { peer.destroy(); } catch {} },
    };
  }

  window.bytefightRoom = {join};
})();
