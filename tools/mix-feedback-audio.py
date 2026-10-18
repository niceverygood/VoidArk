"""Reproducible user-directed mix of the original ElevenLabs and Physical V2 samples."""
from pathlib import Path
import json, subprocess
import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/audio/elevenlabs'
OUT = SOURCE / 'feedback-v3'
OUT.mkdir(exist_ok=True)
FF = imageio_ffmpeg.get_ffmpeg_exe()

def duration(path):
    pcm = subprocess.check_output([FF, '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '1', '-ar', '48000', '-'])
    return len(pcm) / 4 / 48000

def mix(name, inputs, graph):
    args = [FF, '-v', 'error', '-y']
    for source in inputs:
        args += ['-i', str(SOURCE / source)]
    args += ['-filter_complex', graph, '-map', '[out]', '-ar', '48000', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '192k', str(OUT / (name + '.mp3'))]
    subprocess.run(args, check=True)
    pcm = subprocess.check_output([FF, '-v', 'error', '-i', str(OUT / (name + '.mp3')), '-f', 'f32le', '-ac', '1', '-ar', '48000', '-'])
    samples = np.frombuffer(pcm, dtype='<f4')
    return {'id': name, 'duration': round(len(samples)/48000, 3), 'peak': round(float(np.max(np.abs(samples))), 4), 'sources': inputs, 'filter': graph}

records = []
records.append(mix('missile', ['missile.mp3', 'physical-v2/missile.mp3'],
    '[0:a]volume=0.5[a];[1:a]volume=0.5[b];[a][b]amix=inputs=2:normalize=0,highpass=f=30,atrim=duration=1.25,afade=t=out:st=1:d=0.25,alimiter=limit=0.85:level=false,volume=0.65[out]'))
records.append(mix('hit', ['hit.mp3', 'physical-v2/explosion.mp3'],
    '[0:a]volume=0.9[a];[1:a]lowpass=f=2200,volume=0.12[b];[a][b]amix=inputs=2:normalize=0,atrim=duration=0.45,afade=t=out:st=0.30:d=0.15,alimiter=limit=0.85:level=false,volume=0.65[out]'))
records.append(mix('explosion', ['physical-v2/explosion.mp3'],
    '[0:a]highpass=f=28,bass=g=7:f=90:w=0.7,atrim=duration=2.2,afade=t=out:st=1.85:d=0.35,alimiter=limit=0.85:level=false,volume=0.65[out]'))
# Extend the existing barrage rather than introducing an unrelated synthesized tone.
tempo = max(0.5, min(2.0, (duration(SOURCE / 'barrage.mp3') - 0.06) / 3))
records.append(mix('barrage', ['barrage.mp3'],
    f'[0:a]atrim=start=0.06,asetpts=PTS-STARTPTS,atempo={tempo:.6f},highpass=f=28,lowpass=f=4800,treble=g=-4:f=3000,bass=g=8:f=100:w=0.7,apad,atrim=duration=3,afade=t=in:st=0:d=0.12,afade=t=out:st=2.6:d=0.4,alimiter=limit=0.85:level=false,volume=0.65[out]'))
(OUT / 'mix.json').write_text(json.dumps({'revision': 'feedback-v3', 'assets': records}, indent=2), encoding='utf-8')
print(json.dumps([{k:v for k,v in r.items() if k in ['id','duration','peak']} for r in records]))
