# NZP Touch Field Kit

Experimental, unofficial mobile touch interface for **Nazi Zombies: Portable**, by NZ:P Team. This repository is a fork of the official web host, not a new game and not an official release.

## Play

https://yohanbit.github.io/nzp-touch/

Open in Chrome on Android, preferably in landscape. The game loads automatically, without a landing page. Navigate the original menus using touch or the arrow buttons and **✓**. Initial loading downloads roughly 100 MB. The browser requires a real touch before sound can start.

## Controls

Analog left stick, right-side drag to look, hold-and-drag fire button, aim, reload, use/buy/repair, jump, stance, weapon switching, melee and hold/release grenade. Includes original-menu navigation and manual text entry. The existing game HUD remains authoritative; the interface does not fabricate perk, ammo or score values.

**v2:** minimal icon-only controls inspired by the supplied mobile-control reference; no separate sprint button. Push the joystick fully forward to request sprint, ease back or aim to stop. Sideways/backward motion does not activate sprint. Includes a short forward-input delay before the original sprint impulse, avoiding an input-order race.

Settings: look and aim sensitivity, button size and opacity, left-handed layout, optional button labels and haptics, and movable buttons. Settings are stored locally where supported. v2 uses its own layout storage key so v1 button coordinates do not distort the new default arrangement.

Fullscreen/windowed sizing is synchronized to the actual viewport and drawing buffer, including rotation and visual-viewport changes, rather than fitting to stale Android screen dimensions.

## Status

The v2 local client passed 41 automated Chromium checks, including automatic engine/map startup via the original menus, simultaneous touch inputs, sprint input conditions, action-command mapping, control configuration, fullscreen entry/exit and orientation resizing. These checks do not certify every gameplay outcome or actual sprint speed. POCO M5s performance and cooperative connectivity have not been verified for this modified client. Public deployment is tested separately.

## Attribution and licenses

Original game and assets: **NZ:P Team and credited contributors**. The engine, gameplay, maps and assets are not authored by the touch-interface developer.

- Official web host, with the precompiled engine and game packages: https://github.com/nzp-team/nzp-team.github.io
- Engine source: https://github.com/nzp-team/fteqw
- Gameplay source: https://github.com/nzp-team/quakec
- Asset source and licensing: https://github.com/nzp-team/assets
- Documentation: https://docs.nzp.gay/

See `licenses/attributions.txt`, `licenses/fteqw-gpl.txt`, `licenses/gpl-2.0.txt` and `licenses/cc-by-sa-4.0.txt` for included notices. Individual asset licenses remain applicable. Original notices inside the game packages are preserved.

The added HTML/CSS/JavaScript touch interface is licensed under GPL-2.0-or-later, without warranty. Sources are `index.html`, `touch.css` and `touch.js` in this repository.

Engine and gameplay binaries are inherited unmodified from the official web host; they were not rebuilt for this interface. Engine source consulted during development: `f68a2b547d2dc4bf6886b922baa1bff487cc5038`; gameplay source consulted: `8a77f1ce45f1a2b9aa0afb301446954fda40e696`. Those consulted revisions have not been certified as the exact corresponding sources of every upstream binary. This remains an upstream source-provenance limitation, not a claim of a reproducible build.

## Hosting

Static HTTPS hosting with WebAssembly support. Keep the engine and `nzp/` package paths intact. GitHub Pages serves the client; it does not provide a cooperative game server.
