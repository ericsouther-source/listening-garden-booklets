# Spatial listening companion

A static, reusable canvas renderer and bounded audio player live in `assets/spatial-player/`. Feral Current is the first data adapter. Wild Grafting keeps its existing implementation.

## Add a compatible album

1. Establish the released media's identity and timing against saved score/render records. Do not reconstruct original trajectories from a stereo mix. Keep the evidence and preparation scripts in the research workspace.
2. Supply a JSON configuration for the excerpts, roles and verified renderer law. Copy the accessible component markup from Feral Current's `section[data-spatial-player]`, retaining unique control IDs. One component per page is currently supported. Change the title, descriptive prose, passage buttons (`data-passage` keys), legend, direct recording fallbacks and metadata to match the album.
3. Link the three shared assets: `field.css`, `field-math.js`, `viewer.js`. Set `data-motion-url` to the album JSON. Audio is reused from the album URL; it is not copied into the component.
4. Verify the adapter law against saved render controls, check media start/seek/end timing, and test desktop, touch, keyboard, no-JavaScript links and reduced motion. Obtain publication approval. Compatible spatial evidence is required; the toolkit does not make an arbitrary album spatially reconstructable.

## Version 1 data contract

All times are absolute seconds in the released recording. Sample frames are integers at `sampleRate`; intervals are half-open. Angles are radians. Azimuth zero is front, positive is left; elevation is positive up.

```json
{
  "schemaVersion": 1,
  "adapter": "lg-native-directions-v1",
  "track": "Track title",
  "mediaUrl": "../audio/track.m4a",
  "sampleRate": 48000,
  "tickFrames": 32,
  "sourceDelayFrames": 24,
  "movingEventLabel": "active grain pairs",
  "anchor": {"geometry": [0, -0.04, 0.025], "roles": [0, 1], "label": "Pulse / bass"},
  "roles": [
    {"id": 0, "label": "Pulse", "color": "#c9ef69", "shape": "circle", "size": 8,
      "geometry": {"kind": "fixed", "value": [0, -0.04, 0.025]}}
  ],
  "windows": [
    {"key": "a", "title": "Passage title", "time": "0:30–0:38", "start": 30, "end": 38,
      "startFrame": 1440000, "endFrame": 1824000,
      "events": [[0, 1440000, 24000, null]]}
  ],
  "provenance": {"description": "What the controls represent and omit", "mediaSHA256": "verified digest"}
}
```

`mediaUrl` resolves relative to the JSON URL. Direct HTML recording links must resolve to the same media independently of JavaScript. The player loads media only after a user action, and fetches spatial data when its section approaches the viewport. Excerpt selection, restart and seeking update the same absolute media clock.

### The native direction adapter

Each event is `[roleId, startFrame, lengthFrames, motionOrNull]`. The active interval includes `sourceDelayFrames`. Roles use one of:

- `fixed`: `value` is `[azimuth, elevation, halfOpening]`.
- `control-curve`: `valuesKey` names an array of applied `[azimuth,elevation,halfOpening]` triples in each window; `startFrameKey` names its first tick frame. Include at least the tick before the window and the tick after its end. Controls must already reflect the verified native smoothing law. Direction components blend from the previous tick to the current tick, matching the native geometry lag.
- `event-smoothstep`: event motion is `[azStart,azEnd,elStart,elEnd,halfStart,halfEnd]`. Native smoothstep `u²(3−2u)` is evaluated at adjacent tick ages, clamped to `lengthFrames−1`. First-order direction components blend on the tick clock. Stereo points use azimuth offsets `±halfOpening`.

The display normalizes blended direction vectors. It shows active encoder directions and stereo-pair width, not a complete higher-order field, acoustic energy, effects, decoder output or perceived localization. A different renderer law needs a separate verified adapter; changing the version label is not sufficient.

Feral Current's control reconstruction was checked against its native logs and source hashes. Its JSON preserves renderer, record and media digests. The preparation work is not shipped as public page content.

## Interaction and accessibility

Pointer/touch drag, arrow keys and Home orbit/reset the camera; visible buttons offer the same actions. The camera changes the view only. Playback follows `audio.currentTime` and is bounded to the selected excerpt. There is no autoplay. Other page audio pauses when this player starts and vice versa. Reduced motion starts with sound motion held; explicit seeking can still inspect a moment. Human-readable descriptions and direct media links remain available without JavaScript.

## Homepage notes

`journal/assets/carousel.js` and `carousel.css` keep Notes to one row: three cards on desktop, two on tablet, one on phone. Add only published cards as `.note-slide` children, updating their accessible positions; keep the Explore all notes archive link. Additional notes must not create extra homepage rows. The archive itself remains browsable without paging.
