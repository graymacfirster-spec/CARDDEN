import wave, math, struct

def generate_tone(freq, duration_sec, filename, volume=0.5):
    sample_rate = 44100
    n_samples = int(sample_rate * duration_sec)
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        for i in range(n_samples):
            # Apply a simple envelope so it doesn't click
            env = 1.0
            if i < 1000: env = i / 1000.0
            if i > n_samples - 1000: env = (n_samples - i) / 1000.0
            
            val = math.sin(2.0 * math.pi * freq * i / sample_rate) * volume * env
            data = struct.pack('<h', int(val * 32767.0))
            wav_file.writeframesraw(data)

def generate_chime(filename):
    sample_rate = 44100
    n_samples = int(sample_rate * 1.5)
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        for i in range(n_samples):
            t = i / sample_rate
            # Arpeggio C E G C
            f = 523.25 # C5
            if t > 0.15: f = 659.25 # E5
            if t > 0.30: f = 783.99 # G5
            if t > 0.45: f = 1046.50 # C6
            
            env = math.exp(-t * 2) # exponential decay
            val = math.sin(2.0 * math.pi * f * i / sample_rate) * 0.5 * env
            data = struct.pack('<h', int(val * 32767.0))
            wav_file.writeframesraw(data)

generate_chime('assets/win.wav')
generate_tone(440, 0.2, 'assets/check.wav') # A4 short beep

