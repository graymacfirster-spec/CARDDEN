# CARDDEN — how the table works

## Multiplayer latency

The old path for a single card play was:

```
player → broadcast → host device → Postgres UPDATE → WAL → replication
       → postgres_changes → every client
```

Two device hops plus a full database round trip. That is why a played card took
most of a second to appear on the other screen.

The path now (`src/net/useRoomSync.js`):

```
player applies locally (0 ms) → one broadcast hop → peers apply
```

- **The database is off the critical path.** The host still persists state, but
  debounced (400 ms) and fire-and-forget, purely so a refresh or a late joiner
  can recover.
- **`ack: false`** on the broadcast config — we don't wait for the server to
  confirm before returning.
- **`self: false`** — we never process the echo of our own message.
- **One channel** carries game state, presence and voice signalling, so there is
  a single socket to keep warm.

Correctness is protected by a monotonic `version` on the game state. Any message
that isn't strictly newer than what we already hold is dropped, so a slow
database echo can never roll the game backwards. Ties break on `origin` id so
every client converges on the same state.

`postgres_changes` is still subscribed, but only as a safety net for a client
that missed a broadcast entirely (backgrounded app, dropped socket).

Non-host clients never write to `rooms`, so the original RLS constraint that
forced the host-relay design is still respected — it just isn't in the way of
the player anymore.

## Voice chat

`src/voice/` — always-on mesh WebRTC, peer-to-peer. Audio never touches the
server; the Supabase realtime channel the game already holds open is reused for
signalling, so voice costs no extra connection.

Mesh rather than an SFU is right at this table size: with up to 7 seats each
client holds at most 6 peer connections of ~30 kbps Opus.

Muting disables the outgoing track rather than tearing the mesh down, so a muted
player still hears everyone and unmuting is instant.

| Platform | Status |
| --- | --- |
| Web (Vercel) | **Works now.** Browsers ship WebRTC natively. |
| iOS / Android standalone | Needs `react-native-webrtc` (below). |
| Expo Go | Not possible — native module. The UI degrades to a clear message. |

### Enabling voice on a standalone build

```sh
npx expo install react-native-webrtc
npx expo prebuild
eas build --profile development --platform ios   # or android
```

`src/voice/rtc.native.js` resolves the module optionally, so the app bundles and
runs fine without it and lights voice up the moment it's present.

### TURN

Plain STUN covers most players. Players behind symmetric NAT or strict mobile
carriers need a TURN relay — set `EXPO_PUBLIC_TURN_*` in `.env` (see
`.env.example`) and it is picked up automatically.

## The revolver hand

`src/components/CardFan.js`. Cards ride a circular arc whose pivot sits below
the fan, so the hand reads as a bridged spread. When the hand outgrows the
available width the fan **spins** instead of scrolling: drag or flick sideways
and the cylinder rotates, bringing new cards up to the focus point at
top-centre. A hard flick riffles the fan like a bridge shuffle.

Cards are never crushed together and there is never a scrollbar. Tapping a card
buried out at the edge spins it into reach rather than playing it by accident.

## Orientation

The table is landscape everywhere: `app.json` sets `"orientation": "landscape"`
for native, and `src/hooks/useLandscape.js` locks it at runtime. Browsers only
permit an orientation lock in fullscreen, so on web a portrait phone gets a
"turn your device sideways" screen instead.

## Visual system

`src/theme/casino.js` holds every colour, font and elevation. `FeltTable`
renders the mahogany rail, brass trim and green felt bed. `PlayingCard` draws
classic card faces — real pip layouts for 2–10, engraved court panels, a
lattice-and-medallion back — entirely with views, no image assets.

## Game rules

All state transitions live in `src/engine/GameEngine.js` (`applyPlay`,
`applyDraw`, `applyPass`, `playableIndices`). The online screen drives the game
exclusively through these, so the rules exist in one place.
