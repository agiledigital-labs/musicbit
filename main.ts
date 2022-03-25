import * as os from "os";
import * as fs from "fs";
import * as midiManager from "midi-file";

type Preset = {
  readonly file: string;
  readonly track: number;
  readonly tempoMultiplier: number;
};

type MusicBitEvent = {
  readonly freq: number;
  readonly noteStart: number;
  readonly noteLength: number;
};

type MusicBitNoteCommand = {
  readonly freq: number;
  readonly type: "note";
  readonly duration: number;
};

type MusicBitPauseCommand = {
  readonly type: "pause";
  readonly duration: number;
};

type MusicBitCommand = MusicBitNoteCommand | MusicBitPauseCommand;

const presets: Record<string, Preset> = {
  rick: {
    file: "rick.mid",
    track: 11,
    tempoMultiplier: 5,
  },
  mario: {
    file: "mario.mid",
    track: 0,
    tempoMultiplier: 3,
  },
} as const;

const currentPreset = presets["rick"];

// Read MIDI file into a buffer
const input = fs.readFileSync(currentPreset.file);

// Convert buffer to midi object
const parsed = midiManager.parseMidi(input);

const midiEventStream = parsed.tracks[currentPreset.track]!;
const startOffset = 0;

const noteNumberToFreq = (noteNumber: number): number =>
  2 * Math.pow(2, (noteNumber - 69) / 12) * 440;

let currentTime: number = -startOffset;
const events: Array<MusicBitEvent> = [];
let lastOnEvent:
  | { readonly midiEvent: midiManager.MidiNoteOnEvent; readonly time: number }
  | undefined = undefined;

for (const note of midiEventStream) {
  currentTime += note.deltaTime;
  if (note.type === "noteOn") {
    if (lastOnEvent !== undefined) {
      continue;
    }
    lastOnEvent = {
      midiEvent: note,
      time: currentTime,
    };
  }
  if (note.type === "noteOff") {
    if (lastOnEvent === undefined) {
      console.warn("Note off event found with no corresponding note on event");
      continue;
    }

    const lastNoteNumber = lastOnEvent.midiEvent.noteNumber;
    if (lastNoteNumber === note.noteNumber) {
      const noteLength = currentTime - lastOnEvent.time;

      events.push({
        freq: noteNumberToFreq(note.noteNumber),
        noteStart: lastOnEvent.time,
        noteLength: noteLength,
      });
      lastOnEvent = undefined;
    }
  }
}

console.log("events", events.slice(0, 10));

// TODO: Overlapping notes

const { commands } = events.reduce<{
  readonly lastEventTime: number;
  readonly commands: ReadonlyArray<MusicBitCommand>;
}>(
  ({ lastEventTime, commands }, event) => {
    let pauseEvents: ReadonlyArray<MusicBitPauseCommand> = [];
    if (event.noteStart > lastEventTime) {
      pauseEvents = [
        {
          type: "pause",
          duration: event.noteStart - lastEventTime,
        },
      ];
    }
    return {
      commands: [
        ...commands,
        ...pauseEvents,
        {
          type: "note",
          duration: event.noteLength,
          freq: event.freq,
        },
      ],
      lastEventTime: event.noteStart + event.noteLength,
    };
  },
  {
    lastEventTime: 0,
    commands: [],
  }
);

console.log("commands", commands.slice(0, 20));

const codeGenOutput = commands
  .map((c) =>
    c.type === "note"
      ? `music.playTone(${c.freq}, ${c.duration});`
      : `music.playTone(0, ${c.duration * currentPreset.tempoMultiplier});`
  )
  .join(os.EOL);

fs.writeFileSync(
  "./codegen.js",
  "basic.forever(function () {" + codeGenOutput + "})"
);
