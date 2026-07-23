"use client";

import { useEffect, useRef, useState } from "react";
import { MUSIC_TRACKS } from "./music/playlist";

export function Jukebox() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [powered, setPowered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [volume, setVolume] = useState(.65);
  const current = MUSIC_TRACKS[trackIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    if (!powered || !current) {
      audio.pause();
      return;
    }
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [current, powered, trackIndex, volume]);

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) void audio.play().then(() => setPlaying(true));
    else { audio.pause(); setPlaying(false); }
  }

  function nextTrack() {
    if (!MUSIC_TRACKS.length) return;
    setTrackIndex((index) => (index + 1) % MUSIC_TRACKS.length);
  }

  return (
    <aside className={`jukebox ${powered ? "powered" : ""}`} aria-label="Music jukebox">
      <audio ref={audioRef} src={current?.src} onEnded={nextTrack} />
      <div className="jukebox-antenna" aria-hidden="true"><i /><i /></div>
      <header>
        <span className="jukebox-logo"><i>♫</i><b>AERO</b><small>JUKEBOX</small></span>
        <button className="jukebox-power" type="button" aria-pressed={powered} onClick={() => { setPowered((value) => !value); if (powered) setPlaying(false); }}>
          <i /> {powered ? "ON" : "OFF"}
        </button>
      </header>

      <div className="jukebox-screen" aria-live="polite">
        <div>
          <small>{powered ? "NOW PLAYING:" : "SYSTEM STANDBY"}</small>
          <strong>{powered ? current?.title ?? "MUSIC BAY EMPTY" : "PRESS POWER"}</strong>
          <span>{powered ? current?.artist ?? (current ? "UNKNOWN ARTIST" : "ADD TRACKS TO BEGIN") : "AERO SOUND SYSTEM · 2004"}</span>
        </div>
        <div className={`jukebox-eq ${playing ? "dancing" : ""}`} aria-hidden="true">
          <i /><i /><i /><i /><i /><i /><i />
        </div>
      </div>

      <div className="jukebox-controls">
        <button type="button" onClick={togglePlayback} disabled={!powered || !current} aria-label={playing ? "Pause music" : "Play music"}>
          {playing ? "Ⅱ" : "▶"}
        </button>
        <button type="button" onClick={nextTrack} disabled={!powered || MUSIC_TRACKS.length < 2} aria-label="Next song">▶|</button>
        <label>
          <span>VOL</span>
          <input type="range" min="0" max="1" step=".05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Music volume" />
        </label>
        <div className="jukebox-disc" aria-hidden="true"><i /></div>
      </div>
      <div className="jukebox-status"><span><i /> AQUA-FI</span><b>{String(trackIndex + 1).padStart(2, "0")} / {String(MUSIC_TRACKS.length).padStart(2, "0")}</b></div>
    </aside>
  );
}
