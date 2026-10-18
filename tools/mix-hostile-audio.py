"""Edit licensed ElevenLabs samples into short hostile launch/warning sounds."""
from pathlib import Path
import subprocess, json, array, math
import imageio_ffmpeg
ROOT=Path(__file__).resolve().parents[1]; S=ROOT/'public/audio/elevenlabs'; O=S/'hostile-v6';O.mkdir(exist_ok=True); F=imageio_ffmpeg.get_ffmpeg_exe()
def render(name,inputs,graph,duration):
 args=[F,'-v','error','-y']
 for p in inputs:args+=['-i',str(p)]
 subprocess.run(args+['-filter_complex',graph,'-map','[out]','-t',str(duration),'-ar','48000','-ac','2','-codec:a','libmp3lame','-b:a','192k',str(O/(name+'.mp3'))],check=True)
 raw=subprocess.check_output([F,'-v','error','-i',str(O/(name+'.mp3')),'-f','f32le','-ac','1','-ar','48000','-']);pcm=array.array('f');pcm.frombytes(raw)
 return {'id':name,'duration':len(pcm)/48000,'peak':max(abs(v) for v in pcm),'rms':math.sqrt(sum(v*v for v in pcm)/len(pcm)),'sources':[str(p.relative_to(S)) for p in inputs],'filter':graph}
rows=[render('enemyMissile',[S/'feedback-v5/missile.mp3',S/'physical-v2/cannon.mp3'], '[0:a]atrim=duration=0.52,asetpts=PTS-STARTPTS,asetrate=40000,aresample=48000,highpass=f=50,lowpass=f=1000,bass=g=3:f=130,afade=t=in:d=0.015,afade=t=out:st=0.27:d=0.35,volume=0.9[rocket];[1:a]atrim=duration=0.12,asetpts=PTS-STARTPTS,lowpass=f=500,afade=t=in:d=0.006,afade=t=out:st=0.03:d=0.09,volume=0.13[latch];[rocket][latch]amix=inputs=2:normalize=0,apad,atrim=duration=0.7,alimiter=limit=0.72:level=false[out]',.7),render('alert',[S/'physical-v2/cannon.mp3',S/'physical-v2/click.mp3'],'[0:a]atrim=duration=0.14,asetpts=PTS-STARTPTS,highpass=f=100,lowpass=f=900,afade=t=in:d=0.01,afade=t=out:st=0.05:d=0.09,volume=0.6[a];[1:a]atrim=duration=0.11,asetpts=PTS-STARTPTS,lowpass=f=1300,afade=t=out:st=0.03:d=0.08,volume=0.23[b];[a][b]amix=inputs=2:normalize=0,asplit=2[p][q];[q]adelay=220|220,volume=0.85[q2];[p][q2]amix=inputs=2:normalize=0,apad,atrim=duration=0.62,alimiter=limit=0.68:level=false[out]',.62)]
(O/'mix.json').write_text(json.dumps({'revision':'hostile-v6-low-rocket-double-warning','method':'Edits of existing ElevenLabs recordings; no new generation','assets':rows},indent=2),encoding='utf8');print(json.dumps([{k:v for k,v in r.items() if k in ['id','duration','peak','rms']} for r in rows]))
