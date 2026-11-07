# Bytefight

Real-time multiplayer quiz battles and learning games for programming (C#, SQL, EF Core, ASP.NET, HTML, CSS, JS). Built for IT Academy STEP students, open to everyone.

## What is here

| Path | What it is |
| --- | --- |
| `CLAUDE.md` | Rules for Claude Code in this repo (stack, architecture, how to work) |
| `docs/PLAN.md` | Full product and build plan: rules, scoring, data model, realtime protocol, visual system, phases |
| `prototypes/duel.html` | First prototype: two-player C# duel (questions, bug hunt, code tasks) |
| `prototypes/arena.html` | Bytefight Arena: knight vs wizard battle, 4 heroes, attack / heal / shield / critical cards, boss mode, medals |
| `prototypes/net.js` | Two-player rooms for static hosting (PeerJS), same API as the claude.ai `room` capability |
| `prototypes/academy.html` | Bytefight Academy: four learning worlds (LINQ + JSON detective, OOP robot factory, CRUD shop, logic maze) |

## Prototypes

The prototypes are single HTML files made as claude.ai artifacts. They are the reference for game feel, rules and design while the real platform is built.

- `academy.html` works in any browser (open the file directly).
- `arena.html` and `duel.html`: bot and solo modes work in any browser. Two-player rooms work on GitHub Pages through `prototypes/net.js`: PeerJS (WebRTC) connects the two browsers directly, the room creator's browser runs the game. On claude.ai the same pages use the artifact `room` capability instead.
- Play online: https://learn-easily.github.io/bytefight/ (enable Pages: Settings → Pages → Deploy from branch → `main` / root).

## Status

Planning done, build not started. Start with Phase 0 in `docs/PLAN.md` §13.
