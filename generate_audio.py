"""Generate a simple alert beep WAV file."""
import struct
import wave
import math

filename = 'static/audio/alert.mp3'  # Actually a WAV but named .mp3 for simplicity
# We'll create a proper WAV but the <audio> tag handles it fine

f = wave.open(filename, 'w')
f.setnchannels(1)
f.setsampwidth(2)
f.setframerate(44100)

samples = []
# Two short beeps
for beep in range(2):
    # 0.15s beep at 880 Hz
    for t in range(int(44100 * 0.15)):
        val = int(32767 * 0.4 * math.sin(2 * math.pi * 880 * t / 44100))
        # Fade in/out
        env = min(t / 500, 1.0) * min((44100 * 0.15 - t) / 500, 1.0)
        samples.append(int(val * env))
    # 0.1s silence
    for t in range(int(44100 * 0.1)):
        samples.append(0)

f.writeframes(struct.pack('<%dh' % len(samples), *samples))
f.close()
print(f'Alert sound created: {filename} ({len(samples)} samples)')
