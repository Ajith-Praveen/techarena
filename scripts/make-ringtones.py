# Synthesises the two comic turn-alert ringtones (no samples, no licences):
#   next.wav       "You're next!": slide-whistle zoop up, two clown-horn honks, bell ding-ding
#   after-next.wav "You're up soon": bouncy xylophone tune, drum roll, ta-da
# Usage: python3 scripts/make-ringtones.py
import math, random, struct, wave

SR = 22050
OUT = '/Users/ajith/tech_arena/app/assets/sounds'


def silence(sec):
    return [0.0] * int(SR * sec)


def env(n, a=0.01, r=0.08):
    na, nr = int(SR * a), int(SR * r)
    return [min(1.0, i / max(1, na)) * min(1.0, (n - i) / max(1, nr)) for i in range(n)]


def slide_whistle(f0, f1, sec, vib=6.0):
    n = int(SR * sec); out = []; ph = 0.0
    for i, e in enumerate(env(n, 0.02, 0.05)):
        t = i / n
        f = f0 * (f1 / f0) ** (t ** 0.8) * (1 + 0.012 * math.sin(2 * math.pi * vib * i / SR))
        ph += 2 * math.pi * f / SR
        out.append(e * (0.85 * math.sin(ph) + 0.1 * math.sin(2 * ph)))
    return out


def honk(f, sec):
    # Clown horn: buzzy square-ish wave with a quick pitch dip and wobble.
    n = int(SR * sec); out = []; ph = 0.0
    for i, e in enumerate(env(n, 0.005, 0.06)):
        t = i / SR
        ff = f * (1 - 0.06 * math.exp(-t * 25)) * (1 + 0.02 * math.sin(2 * math.pi * 28 * t))
        ph += 2 * math.pi * ff / SR
        v = sum(math.sin(k * ph) / k for k in (1, 2, 3, 4, 5, 6))
        out.append(e * 0.55 * math.tanh(1.8 * v))
    return out


def bell(f, sec):
    n = int(SR * sec)
    parts = [(1, 1.0), (2.76, 0.5), (5.4, 0.25), (8.93, 0.12)]
    return [math.exp(-i / SR * 5) * sum(a * math.sin(2 * math.pi * f * m * i / SR) for m, a in parts) * 0.45 for i in range(n)]


def xylo(f, sec):
    n = int(SR * sec)
    return [math.exp(-i / SR * 14) * (math.sin(2 * math.pi * f * i / SR) + 0.35 * math.sin(2 * math.pi * f * 4 * i / SR) * math.exp(-i / SR * 40)) * 0.6 for i in range(n)]


def drum_roll(sec, rate=22):
    rnd = random.Random(7); n = int(SR * sec); out = [0.0] * n
    step = int(SR / rate)
    for s in range(0, n, step):
        for i in range(min(step, n - s)):
            out[s + i] += rnd.uniform(-1, 1) * math.exp(-i / SR * 60) * 0.35 * (0.6 + 0.4 * s / n)
    return out


def crash(sec):
    rnd = random.Random(3); n = int(SR * sec)
    return [rnd.uniform(-1, 1) * math.exp(-i / SR * 3.5) * 0.4 for i in range(n)]


def mix(*tracks):
    n = max(len(t) for t in tracks); out = [0.0] * n
    for t in tracks:
        for i, v in enumerate(t): out[i] += v
    return out


def save(name, samples):
    peak = max(abs(v) for v in samples) or 1
    data = b''.join(struct.pack('<h', int(max(-1, min(1, v / peak * 0.9)) * 32767)) for v in samples)
    with wave.open(f'{OUT}/{name}', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data)
    print(name, f'{len(samples) / SR:.1f}s')


# "You're next!": zoop up, HONK HONK, ding-ding, pause (it loops while ringing).
nxt = (slide_whistle(320, 1250, 0.55) + silence(0.05) + honk(233, 0.28) + silence(0.07) + honk(233, 0.42)
       + silence(0.08) + bell(1568, 0.35) + bell(2093, 0.9) + silence(0.35))
save('next.wav', nxt)

# "You're up soon": bouncy xylophone tune, drum roll, ta-da!
C5, D5, E5, G5, A5, C6 = 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5
notes = [(C5, .14), (E5, .14), (G5, .14), (E5, .14), (A5, .14), (G5, .28), (D5, .14), (G5, .14), (C6, .42)]
tune = []
for f, d in notes:
    tune += xylo(f, d)
tada = mix(xylo(C6, 0.9), xylo(G5, 0.9), crash(0.9))
after = tune + drum_roll(0.6) + tada + silence(0.4)
save('after-next.wav', after)
