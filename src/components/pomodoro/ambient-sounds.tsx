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
  const length = context.sampleRate * 3;
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
  const [volume, setVolume] = useState(0.5);

  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const masterRef = useRef<GainNode | null>(null);

  function stop() {
    try {
      sourceRef.current?.stop();
    } catch {
      // Already stopped.
    }
    sourceRef.current?.disconnect();
    lfoRef.current?.stop();
    lfoRef.current?.disconnect();
    sourceRef.current = null;
    lfoRef.current = null;
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

      let node: AudioNode = source;

      if (kind === "rain") {
        const filter = context.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 700;
        node.connect(filter);
        node = filter;
      } else if (kind === "ocean") {
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 520;
        node.connect(filter);
        node = filter;
      } else if (kind === "brown") {
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1200;
        node.connect(filter);
        node = filter;
      }

      const texture = context.createGain();
      texture.gain.value = kind === "ocean" ? 0.6 : 0.45;
      node.connect(texture);

      if (kind === "ocean") {
        // Slow swell in and out, like waves reaching the shore.
        const lfo = context.createOscillator();
        const lfoGain = context.createGain();
        lfo.type = "sine";
        lfo.frequency.value = 0.08;
        lfoGain.gain.value = 0.3;
        lfo.connect(lfoGain);
        lfoGain.connect(texture.gain);
        lfo.start();
        lfoRef.current = lfo;
      }

      const master = context.createGain();
      master.gain.value = volume;
      texture.connect(master);
      master.connect(context.destination);

      source.start();
      sourceRef.current = source;
      masterRef.current = master;
      setActive(kind);
    } catch {
      stop();
    }
  }

  useEffect(() => {
    if (masterRef.current) masterRef.current.gain.value = volume;
  }, [volume]);

  useEffect(() => {
    return () => {
      try {
        sourceRef.current?.stop();
        lfoRef.current?.stop();
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
