"""Two original, offline-generated ambient miniatures. Python stdlib + build-time ffmpeg."""
import array, math, wave, subprocess
from pathlib import Path

OUT = Path(__file__).parent
SR, DURATION = 22050, 48
TAU = math.tau

def compose(which):
    audio = array.array('f', [0]) * (SR * DURATION)
    def voice(midi, at, duration, volume, pad=False):
        frequency = 440 * 2 ** ((midi - 69) / 12)
        start = int(at * SR)
        count = min(int(duration * SR), len(audio) - start)
        for i in range(count):
            t = i / SR
            if pad:
                env = min(1, t / 2.2) * min(1, (duration - t) / 3.3) * .58
                sample = (math.sin(TAU * frequency * t) + .26 * math.sin(TAU * frequency * 2.001 * t))
            else:
                env = (1 - math.exp(-t * 65)) * math.exp(-t / 1.85) * min(1, (duration-t)/.6)
                sample = math.sin(TAU * frequency * t) + .24 * math.sin(TAU * frequency * 2 * t) * math.exp(-t*1.4)
                sample += .085 * math.sin(TAU * frequency * 3.003 * t) * math.exp(-t*2.6)
            audio[start+i] += sample * env * volume
    chords = ([[50,57,62,66], [47,54,59,62], [43,50,55,59], [45,52,57,62]] if which == 0 else
              [[45,52,57,60], [41,48,53,57], [48,55,60,64], [43,50,55,62]])
    melody = ([74,78,81,78,76,71,74,78,74,69,71,74,73,69,66,62] if which == 0 else
              [76,72,69,67,69,65,69,72,76,79,76,72,74,71,67,62])
    for j, chord in enumerate(chords):
        for n in chord:
            voice(n-12, j*10.5, 13, .027, True)
        for k in range(7):
            voice(chord[k % 4]+12, j*10.5 + k*1.4+.15, 5, .065 if k%3 else .083)
    for j, n in enumerate(melody):
        voice(n, .65 + j*2.62, 5, .087)
    # A short, dark stereo-free room, baked into the asset for file:// portability.
    for delay, decay in [(0.173,.19),(.347,.13),(.719,.08)]:
        d = int(delay*SR)
        for i in range(d, len(audio)):
            audio[i] += audio[i-d] * decay
    pcm = array.array('h')
    for i, v in enumerate(audio):
        envelope = min(1, i/SR/2.0) * min(1,(DURATION-i/SR)/4.8)
        pcm.append(int(max(-1,min(1,v*envelope*.95))*32767))
    wav = OUT / f'music-{which+1}.wav'
    with wave.open(str(wav),'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(wav),'-codec:a','libmp3lame','-b:a','64k','-ar','22050',str(OUT/f'music-{which+1}.mp3')],check=True)
    print(f'Composed {which+1}: {DURATION}s', flush=True)

if __name__ == '__main__':
    compose(0); compose(1)
