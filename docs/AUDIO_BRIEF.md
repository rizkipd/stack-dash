# Stack Dash — Audio Brief

Owner: UI/UX (`docs/RACI.md` row 18).

Everything in `assets/audio/` today is **procedurally synthesised placeholder
audio** generated during M8. It is wired, mixed and playable, but it is not
finished audio. This document is how you replace it.

**Drop-in replacement:** keep the filename and folder, and the game picks it up
with no code change. Paths are listed in §4.

---

## 1. What Suno is and isn't good for

| Need | Use Suno? | Why |
| --- | --- | --- |
| BGM loops (4 themes) | **Yes** | Suno is strong at 1-3 minute instrumental beds |
| One-shot SFX (hits, clicks, collects) | **No** | Suno generates songs, not 80 ms transients. It cannot reliably produce a dry, punchy one-shot |
| Seamless looping | **Partly** | Suno does not export true loop points. Expect to trim and crossfade — see §3 |

For SFX use a dedicated source: ElevenLabs Sound Effects (text-to-SFX),
Freesound (CC0), Zapsplat, or a synth like Vital/Plogue chipsounds.

---

## 2. Suno prompts — the four BGM themes

Set **Instrumental: ON** in Suno. Put the *Style* text in the style box. The
"Exclude" line goes in Suno's exclude-styles field if your plan has one.

Shared context — the game is a fast, one-finger arcade runner with a neon
night-city look, so every theme should sit in that world.

### Easy — "Bright & Chill"

> **Style:** Upbeat chillwave synthwave instrumental, bright major key, warm
> analog pads, soft plucky arpeggio, gentle four-on-the-floor kick, light
> shaker, mellow sub bass, 104 BPM, relaxed but forward-moving, neon city at
> dusk, clean mix, loopable arcade background music, no vocals
>
> **Exclude:** vocals, lyrics, drops, breakdowns, sound effects, risers

### Medium — "Upbeat & Fun"

> **Style:** Energetic retro arcade synthwave instrumental, catchy major-key
> arpeggio lead, punchy analog bass, crisp electronic drums, hand claps on the
> backbeat, 126 BPM, playful and confident, 80s neon city, bright and bouncy,
> loopable video game background music, no vocals
>
> **Exclude:** vocals, lyrics, long intro, ambient sections, silence

### Hard — "Intense & Fast"

> **Style:** Driving darksynth instrumental, minor key, aggressive saw-wave
> bassline, fast 16th-note arpeggios, hard-hitting electronic drums, tight
> hi-hats, 148 BPM, tense and relentless, neon city chase, high energy,
> loopable video game background music, no vocals
>
> **Exclude:** vocals, lyrics, ambient intro, tempo changes, fadeout

### Insane — "Extreme Energy"

> **Style:** Aggressive high-tempo cyberpunk darksynth instrumental, phrygian
> minor, distorted reese bass, frantic 16th-note arpeggios, hard industrial
> drums, rapid hi-hat rolls, 172 BPM, overwhelming adrenaline, neon city
> overload, loopable video game background music, no vocals
>
> **Exclude:** vocals, lyrics, breakdown, half-time section, fadeout, silence

---

## 3. Turning a Suno track into a game loop

Suno gives you a song, not a loop. Four steps in Audacity or any DAW:

1. **Pick a clean 30-60 s section** with no intro swell and no fadeout. The
   game loops this indefinitely, so choose a stretch that is texturally
   consistent.
2. **Trim to a whole number of bars.** Bar length in seconds is
   `240 / BPM` for 4/4. At 126 BPM, 8 bars is 15.24 s.
3. **Crossfade the seam.** Copy the last ~250 ms, overlay it onto the start,
   and fade across. Without this you get an audible click every loop, which is
   far more noticeable in a game than in a playlist.
4. **Export** as `.wav` for the repo, or `.mp3` at 128-160 kbps to save space
   (a 60 s stereo WAV is ~10 MB; the same as MP3 is ~1 MB). The player accepts
   both — if you switch to `.mp3`, update the extension in
   `src/feedback/index.ts`.

**Loudness:** target around −16 LUFS integrated. The mix in §5 assumes BGM sits
well under the SFX; a mastered-loud Suno export will drown out the hit cues.

---

## 4. File paths — keep these exact

```
assets/audio/
├── bgm/
│   ├── easy_theme.wav        ← Suno
│   ├── medium_theme.wav      ← Suno
│   ├── hard_theme.wav        ← Suno
│   └── insane_theme.wav      ← Suno
├── gameplay/
│   ├── hit_small.wav         1 block lost
│   ├── hit_medium.wav        2-3 blocks
│   ├── hit_large.wav         4+ blocks
│   ├── wall_impact.wav       heavy wall strike
│   ├── block_destroyed.wav   debris falling
│   ├── collect_block.wav     +1 pickup
│   ├── stack_grow.wav        block joins the stack
│   ├── speed_up.wav          difficulty ramp crossed
│   ├── warning_low.wav       stack down to 2 blocks
│   └── game_over.wav         run ends
└── ui/
    ├── button_click.wav      ├── level_select.wav
    ├── button_hover.wav      ├── level_confirm.wav
    ├── menu_transition.wav   ├── lock_level.wav
    ├── popup_open.wav        └── pause.wav
    └── back_cancel.wav
```

---

## 5. Volume mix

From the sound design sheet, implemented in `src/feedback/index.ts`:

| Bus | Level |
| --- | --- |
| Master | 100% |
| SFX | 90% |
| UI | 80% |
| BGM | 70% |

Sound and music are **independent toggles** in Settings, and haptics is a third
— an accessibility requirement from `docs/ART_DIRECTION.md` §7. A player who
turns off music must still hear the low-blocks warning.

---

## 6. SFX direction

Style keywords from the sheet: *fun, bright, punchy, satisfying, dynamic.*

Two rules that matter more than the timbre:

- **Short, with a strong attack.** Every gameplay cue fires during a collision,
  which is the moment the player is reading the screen hardest. A cue with a
  slow attack arrives after the event it is describing.
- **Pitch tracks weight.** `hit_small` → `hit_medium` → `hit_large` should drop
  in pitch and lengthen. This is already how the placeholders are generated, so
  replacements should preserve the relationship even if the timbre changes.

Never let an SFX exceed ~300 ms except `game_over`. A long cue still ringing
when the next obstacle arrives muddies the next hit.
