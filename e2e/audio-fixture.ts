import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
export function audioFixture() {
  const sampleRate = 48000;
  const seconds = 6;
  const count = sampleRate * seconds;
  const wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(count * 2, 40);
  for (let index = 0; index < count; index++) {
    const time = index / sampleRate;
    wav.writeInt16LE(
      time > 1 && time < 4 ? Math.round(Math.sin(time * 2 * Math.PI * 440) * 0.3 * 32767) : 0,
      44 + index * 2,
    );
  }
  mkdirSync('.data', { recursive: true });
  const path = resolve('.data/test-audio.wav');
  writeFileSync(path, wav);
  return path;
}
