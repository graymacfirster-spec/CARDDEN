import wave, math, struct
import os

def generate_bg_music(filename):
    sample_rate = 44100
    # 4 bars of walking bass in C minor at 120 BPM
    notes = [
        (65.41, 0.5), (77.78, 0.5), (98.00, 0.5), (77.78, 0.5),
        (65.41, 0.5), (103.83, 0.5), (98.00, 0.5), (77.78, 0.5),
        (87.31, 0.5), (103.83, 0.5), (130.81, 0.5), (103.83, 0.5),
        (65.41, 0.5), (77.78, 0.5), (98.00, 0.5), (77.78, 0.5)
    ]
    
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        for freq, dur in notes:
            samples = int(sample_rate * dur)
            for i in range(samples):
                t = i / sample_rate
                f1 = math.sin(2.0 * math.pi * freq * t)
                f2 = math.sin(2.0 * math.pi * (freq * 2) * t) * 0.3
                env = math.exp(-t * 3)
                val = (f1 + f2) * 0.4 * env
                data = struct.pack('<h', int(val * 32767.0))
                wav_file.writeframesraw(data)

generate_bg_music('assets/bg.wav')
