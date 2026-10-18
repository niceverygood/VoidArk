"""New physical launch edits from existing ElevenLabs samples; no API generation."""
from pathlib import Path
import json, subprocess
import imageio_ffmpeg
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'public/audio/elevenlabs'
OUT=SOURCE/'feedback-v5';OUT.mkdir(exist_ok=True)
FF=imageio_ffmpeg.get_ffmpeg_exe()

def render(name,inputs,graph):
    args=[FF,'-v','error','-y']
    for path in inputs: args+=['-i',str(path)]
    subprocess.run(args+['-filter_complex',graph,'-map','[out]','-t','3' if name=='barrage' else '0.78','-ar','48000','-ac','2','-codec:a','libmp3lame','-b:a','192k',str(OUT/(name+'.mp3'))],check=True,timeout=20)
    raw=subprocess.check_output([FF,'-v','error','-i',str(OUT/(name+'.mp3')),'-f','f32le','-ac','1','-ar','48000','-'])
    pcm=np.frombuffer(raw,dtype='<f4')
    return {'id':name,'duration':round(len(pcm)/48000,3),'peak':round(float(np.max(np.abs(pcm))),4),'rms':round(float(np.sqrt(np.mean(pcm**2))),4),'sources':[str(p.relative_to(SOURCE)) for p in inputs],'filter':graph}

records=[render('missile',[SOURCE/'physical-v2/missile.mp3',SOURCE/'physical-v2/cannon.mp3'],
    '[0:a]atrim=duration=0.66,asetpts=PTS-STARTPTS,asetrate=37485,aresample=48000,highpass=f=45,lowpass=f=1400,treble=g=-7:f=1000,bass=g=3:f=110,afade=t=in:d=0.012,afade=t=out:st=0.4:d=0.34,volume=0.75[rocket];'
    '[1:a]atrim=duration=0.16,asetpts=PTS-STARTPTS,highpass=f=50,lowpass=f=420,afade=t=in:d=0.008,afade=t=out:st=0.04:d=0.12,volume=0.18[clamp];'
    '[rocket][clamp]amix=inputs=2:normalize=0,apad,atrim=duration=0.78,alimiter=limit=0.78:level=false,volume=0.65[out]')]
delays=[0,240,520,860,1280,1780,2220]
parts=['[0:a]asplit=7'+''.join(f'[s{i}]' for i in range(7))+';']
for i,delay in enumerate(delays):
    parts.append(f'[s{i}]adelay={delay}|{delay},volume={1-i*.065:.3f}[d{i}];')
parts.append(''.join(f'[d{i}]' for i in range(7))+'amix=inputs=7:normalize=0,apad,atrim=duration=3,afade=t=out:st=2.65:d=0.35,alimiter=limit=0.8:level=false,volume=0.65[out]')
records.append(render('barrage',[OUT/'missile.mp3'],''.join(parts)))
(OUT/'mix.json').write_text(json.dumps({'revision':'feedback-v5-mechanical-launch','method':'physical sample edit, not a new AI generation','assets':records},indent=2),encoding='utf-8')
print(json.dumps([{k:v for k,v in r.items() if k in ['id','duration','peak','rms']} for r in records]))

