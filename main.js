"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const midiManager = __importStar(require("midi-file"));
// Read MIDI file into a buffer
const input = fs.readFileSync("mario.mid");
// Convert buffer to midi object
const parsed = midiManager.parseMidi(input);
// Rick = 11
// Mario = 0
const ricksVocals = parsed.tracks[0];
const startOffset = 0;
const noteNumberToFreq = (noteNumber) => 2 * Math.pow(2, (noteNumber - 69) / 12) * 440;
let currentTime = -startOffset;
const events = [];
let lastOnEvent = undefined;
for (const note of ricksVocals) {
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
const { commands } = events.reduce(({ lastEventTime, commands }, event) => {
    let pauseEvents = [];
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
}, {
    lastEventTime: 0,
    commands: [],
});
console.log("commands", commands.slice(0, 20));
const codeGenOutput = commands
    .map((c) => c.type === "note"
    ? `music.playTone(${c.freq}, ${c.duration});`
    : `music.playTone(0, ${c.duration * 3});`)
    .join(os.EOL);
fs.writeFileSync("./codegen.js", "basic.forever(function () {" + codeGenOutput + "})");
