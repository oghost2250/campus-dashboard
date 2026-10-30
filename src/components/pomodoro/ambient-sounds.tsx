"use client";

import { useEffect, useRef, useState } from "react";
import { CloudRain, Square, Volume2, Waves, Wind, Radio } from "lucide-react";

import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Sound = "rain" | "ocean" | "brown" | "white";

const SOUNDS: {
  id: Sound;
  icon: typeof CloudRain;
  key: "ambientRain" | "ambientOcean" | "ambientBrown" | "ambientWhite";
}[] = [
  { id: "rain", icon: CloudRain, key: "ambientRain" },
  { id: "ocean", icon: Waves, key: "ambientOcean" },
  { id: "brown", icon: Wind, key: "ambientBrown" },
  { id: "white", icon: Radio, key: "ambientWhite" },
];

function fillNoise(context: AudioContext, kind: Sound): AudioBuffer {
  const length = context.sampleRate * 8;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);

  if (kind === "brown" || kind === "ocean") {
    // Leaky integrator over white noise gives the deeper brown-noise rumble.
    let last = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[index] = last * 3.5;
    }
  } else if (kind === "rain") {
    // Pink-ish noise base: less harsh than white, closer to distant rainfall.
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.98974 * b2 + white * 0.153852;
      b3 = 0.969 * b3 + white * 0.5367677;
      b4 = 0.94 * b4 + white * 0.5596878;
      b5 = 0.9 * b5 + white * 0.5290486;
      b6 = 0.84 * b6 + white * 0.5053703;
      data[index] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.07;
    }

    // Layer in distinct droplet impulses so it reads as rain, not static.
    const droplets = Math.floor(length / context.sampleRate) * 18;
    for (let d = 0; d < droplets; d += 1) {
      const pos = Math.floor(Math.random() * (length - 200));
      const amp = 0.25 + Math.random() * 0.5;
      const decay = 8 + Math.floor(Math.random() * 12);
      for (let k = 0; k < decay; k += 1) {
        data[pos + k] += (Math.random() * 2 - 1) * amp * (1 - k / decay);
      }
    }
  } else {
    for (let index = 0; index < length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
  }

  return buffer;
}

export function AmbientSounds() {
  const { t } = useI18n();

  const [active, setActive] = useState<Sound | null>(null);
  const [volume, setVolume] = useState(0.35);

  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const extraRef = useRef<AudioBufferSourceNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const crestRef = useRef<OscillatorNode | null>(null);
  const masterRef = useRef<GainNode | null>(null);

  function stop() {
    try {
      sourceRef.current?.stop();
    } catch {
      // Already stopped.
    }
    try {
      extraRef.current?.stop();
    } catch {
      // Already stopped.
    }
    sourceRef.current?.disconnect();
    extraRef.current?.disconnect();
    lfoRef.current?.stop();
    lfoRef.current?.disconnect();
    crestRef.current?.stop();
    crestRef.current?.disconnect();
    sourceRef.current = null;
    extraRef.current = null;
    lfoRef.current = null;
    crestRef.current = null;
    setActive(null);
  }

  async function play(kind: Sound) {
    if (active === kind) {
      stop();
      return;
    }

    stop();

    try {
      const context = contextRef.current ?? new window.AudioContext();
      contextRef.current = context;
      if (context.state === "suspended") await context.resume();

      const source = context.createBufferSource();
      source.buffer = fillNoise(context, kind);
      source.loop = true;

      const master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      masterRef.current = master;

      // Fade in to avoid a click on start.
      master.gain.linearRampToValueAtTime(volume, context.currentTime + 0.5);

      let node: AudioNode = source;

      if (kind === "rain") {
        const band = context.createBiquadFilter();
        band.type = "bandpass";
        band.frequency.value = 2600;
        band.Q.value = 0.6;
        node.connect(band);
        node = band;

        // Distant rumble layer underneath the droplets.
        const rumble = context.createBufferSource();
        rumble.buffer = fillNoise(context, "brown");
        rumble.loop = true;
        const rumbleFilter = context.createBiquadFilter();
        rumbleFilter.type = "lowpass";
        rumbleFilter.frequency.value = 260;
        const rumbleGain = context.createGain();
        rumbleGain.gain.value = 0.12;
        rumble.connect(rumbleFilter);
        rumbleFilter.connect(rumbleGain);
        rumbleGain.connect(master);
        rumble.start();
        extraRef.current = rumble;

        // Slow gust modulation so the rain breathes instead of hissing.
        const gust = context.createOscillator();
        const gustGain = context.createGain();
        gust.type = "sine";
        gust.frequency.value = 0.18;
        gustGain.gain.value = 0.12;
        gust.connect(gustGain);

        const texture = context.createGain();
        texture.gain.value = 0.32;
        gustGain.connect(texture.gain);
        node.connect(texture);
        texture.connect(master);
        gust.start();
        lfoRef.current = gust;
      } else if (kind === "ocean") {
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 380;
        filter.Q.value = 0.7;
        node.connect(filter);
        node = filter;

        const texture = context.createGain();
        texture.gain.value = 0.45;
        node.connect(texture);

        // Slow swell in and out, like waves reaching the shore.
        const swell = context.createOscillator();
        const swellGain = context.createGain();
        swell.type = "sine";
        swell.frequency.value = 0.06;
        swellGain.gain.value = 0.32;
        swell.connect(swellGain);
        swellGain.connect(texture.gain);

        // Faster texture for the breaking-crest hiss.
        const crest = context.createOscillator();
        const crestGain = context.createGain();
        crest.type = "sine";
        crest.frequency.value = 0.22;
        crestGain.gain.value = 0.06;
        crest.connect(crestGain);
        crestGain.connect(texture.gain);

        texture.connect(master);
        swell.start();
        crest.start();
        crestRef.current = crest;
        lfoRef.current = swell;
      } else if (kind === "brown") {
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 620;
        filter.Q.value = 0.7;
        node.connect(filter);
        node = filter;

        const texture = context.createGain();
        texture.gain.value = 0.45;
        node.connect(texture);
        texture.connect(master);
      } else {
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 3600;
        filter.Q.value = 0.5;
        node.connect(filter);
        node = filter;

        const texture = context.createGain();
        texture.gain.value = 0.18;
        node.connect(texture);
        texture.connect(master);
      }

      source.start();
      sourceRef.current = source;
      setActive(kind);
    } catch {
      stop();
    }
  }

  // For rain, the gust LFO was connected to a texture gain created inside the
  // branch; keep volume sync working on master for all kinds.
  useEffect(() => {
    if (masterRef.current) masterRef.current.gain.value = volume;
  }, [volume]);

  useEffect(() => {
    return () => {
      try {
        sourceRef.current?.stop();
        extraRef.current?.stop();
        lfoRef.current?.stop();
        crestRef.current?.stop();
      } catch {
        // Nodes may already be stopped.
      }
      void contextRef.current?.close();
    };
  }, []);

  return (
    <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-tight">
            {t.pomodoro.ambientTitle}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {t.pomodoro.ambientSubtitle}
          </p>
        </div>
        {active ? (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Square className="size-2.5 fill-current" />
            {t.pomodoro.ambientStop}
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {SOUNDS.map((sound) => {
          const Icon = sound.icon;
          const isActive = active === sound.id;

          return (
            <button
              key={sound.id}
              type="button"
              onClick={() => void play(sound.id)}
              aria-pressed={isActive}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[11px] font-medium transition-colors",
                isActive
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/25 hover:text-foreground",
              )}
            >
              <Icon className={cn("size-3.5", isActive && "text-primary")} />
              {t.pomodoro[sound.key]}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Volume2 className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          aria-label={t.pomodoro.ambientVolume}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        />
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        {t.pomodoro.ambientHint}
      </p>
    </section>
  );
}
