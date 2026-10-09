import json, subprocess, numpy as np
from scipy.signal import butter, sosfilt, lfilter
SR=48000; DUR=69.77; N=int(SR*(DUR+0.3))
rs=np.random.default_rng(7)
def bp(x,lo,hi,o=4): return sosfilt(butter(o,[lo,hi],btype='band',fs=SR,output='sos'),x)
def lp(x,f,o=4): return sosfilt(butter(o,f,btype='low',fs=SR,output='sos'),x)
def hp(x,f,o=4): return sosfilt(butter(o,f,btype='high',fs=SR,output='sos'),x)
def tt(d): return np.arange(int(SR*d))/SR
def env(d,a=.005,dec=8.0):
    t=tt(d); return np.minimum(1,t/a)*np.exp(-t*dec)
def noise(d): return rs.standard_normal(int(SR*d))
def norm(x,pk): return x/(np.abs(x).max()+1e-9)*pk
def paper(): d=.45; n=bp(noise(d),1200,7500); cr=lp(np.abs(rs.standard_normal(len(n)))**3,60); return norm(n*cr*env(d,.01,6),.30)
def pop(): t=tt(.12); f=650*np.exp(-t*14)+250; ph=2*np.pi*np.cumsum(f)/SR; return norm(np.sin(ph)*env(.12,.002,30),.28)
def thud(): t=tt(.45); f=95*np.exp(-t*6)+42; ph=2*np.pi*np.cumsum(f)/SR; x=np.sin(ph)*env(.45,.003,7)+.4*lp(noise(.45),900)*env(.45,.001,40); return norm(x,.75)
def stamp(): t=tt(.3); f=120*np.exp(-t*10)+55; x=np.sin(2*np.pi*np.cumsum(f)/SR)*env(.3,.002,14)+.8*bp(noise(.3),300,3000)*env(.3,.001,45); return norm(x,.6)
def scribble(): d=.7; t=tt(d); am=np.abs(np.sin(2*np.pi*13*t+rs.random()*3))**2*(.6+.4*lp(rs.random(len(t)),20)*3); x=bp(noise(d),1800,8000)*am*np.minimum(1,t/.05)*np.minimum(1,(d-t)/.1); return norm(x,.14)
def sweep(d,f0,f1,pk):
    n=noise(d); seg=int(SR*.03); out=np.zeros_like(n); k=len(n)//seg
    for i in range(k+1):
        a=i*seg; b=min(len(n),a+seg*2)
        if a>=len(n): break
        fc=f0*(f1/f0)**(i/max(1,k)); w=np.hanning(b-a); out[a:b]+=bp(n[a:b],fc*.6,min(fc*1.6,20000),2)*w
    e=np.hanning(len(n))**1.5; return norm(out*e,pk)
def whoosh(): return sweep(.45,400,3500,.32)
def whooshlong(): return sweep(.85,300,4000,.30)
def riser(): return sweep(.6,500,7000,.30)
def drop(): return sweep(.65,5000,250,.32)
def page(): d=.6; t=tt(d); fl=.55+.45*np.sin(2*np.pi*28*t)**2; x=bp(noise(d),700,6500)*fl*np.hanning(len(t))+.5*np.concatenate([np.zeros(int(SR*.45)),thud()[:int(SR*.15)]*.4]); return norm(x,.34)
ticktoggle=[0]
def tick():
    ticktoggle[0]^=1; f=(3200 if ticktoggle[0] else 2100); x=bp(noise(.04),f*.8,f*1.25,2)*env(.04,.0005,140); return norm(x,.22)
FX=dict(paper=paper,pop=pop,thud=thud,stamp=stamp,scribble=scribble,whoosh=whoosh,whooshlong=whooshlong,riser=riser,drop=drop,page=page,tick=tick)
sfx=np.zeros(N); last={}
for c in json.load(open('sfx.json')):
    ty,t=c['type'],c['t']
    if ty in last and t-last[ty]<.12: continue
    last[ty]=t; x=FX[ty](); a=int(SR*max(0,t)); b=min(N,a+len(x)); sfx[a:b]+=x[:b-a]

# ---- music: soft curious piano, A minor, 84 bpm ----
bpm=84; beat=60/bpm; bar=4*beat
def midi(m): return 440*2**((m-69)/12)
def piano(f,d,vel):
    t=tt(d); x=np.zeros_like(t)
    for k in range(1,7): x+=np.sin(2*np.pi*f*k*t*(1+.0004*k))*(1/k**1.4)*np.exp(-t*(1.6+.9*k))
    return x*np.minimum(1,t/.004)*vel
chords=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]]   # Am F C G
mus=np.zeros(N)
def place(x,t):
    a=int(SR*t); b=min(N,a+len(x))
    if a<N: mus[a:b]+=x[:b-a]
nb=int(DUR/bar)+1
for b in range(nb):
    t0=b*bar; ch=chords[b%4]; inten=1.0+ (0.35 if 40<t0<57 else 0)
    place(piano(midi(ch[0]-12),bar*1.2,.55),t0); place(piano(midi(ch[0]-12),bar*.8,.35),t0+2*beat)
    pat=[ch[0]+12,ch[1]+12,ch[2]+12,ch[1]+24,ch[2]+12,ch[1]+12,ch[2]+12,ch[0]+24]
    for i,m in enumerate(pat):
        if t0+i*beat/2>DUR-1.2: break
        place(piano(midi(m),1.6,(.20 if i%2 else .26)*inten),t0+i*beat/2)
    # pad
    t=tt(bar+.6); pad=sum(np.sin(2*np.pi*midi(m)*t)+.3*np.sin(2*np.pi*midi(m)*2.003*t) for m in ch)
    place(lp(pad,1200,2)*np.minimum(1,t/.8)*np.minimum(1,(bar+.6-t)/.6)*.05,t0)
# final ringing chord
place(sum(piano(midi(m),3.0,.28) for m in [45,57,60,64,69]),67.02)
def reverb(x,seed):
    r=np.random.default_rng(seed); y=np.zeros_like(x)
    for d,g in [(1557,.82),(1617,.8),(1491,.81),(1422,.83)]:
        dd=int(d*SR/44100*(1+r.random()*.03)); a=np.zeros(dd+1); a[0]=1; a[dd]=-g; y+=lfilter([1],a,x)
    return y/4
musL=mus+.35*reverb(mus,1); musR=mus+.35*reverb(mus,2)
fadeo=np.clip((DUR+.2-np.arange(N)/SR)/1.6,0,1); fadei=np.clip(np.arange(N)/SR/.6,0,1)
musL*=fadeo*fadei; musR*=fadeo*fadei

# ---- voice ----
raw=subprocess.run(['ffmpeg','-loglevel','error','-i','vo.mp3','-ar',str(SR),'-ac','1','-f','f32le','-'],capture_output=True).stdout
vo=np.frombuffer(raw,dtype=np.float32).astype(np.float64); v=np.zeros(N); v[:min(N,len(vo))]=vo[:N]
v=norm(v,.89)
rms=lambda x:np.sqrt(np.mean(x[np.abs(x)>1e-4]**2))
vr=rms(v); mr=rms((musL+musR)/2)
g=vr*10**(-20/20)/mr; musL*=g; musR*=g
# gentle duck under speech (extra 3 dB)
ve=lp(np.abs(v),4,2); duck=1-.3*np.clip(ve/ve.max()*4,0,1); musL*=duck; musR*=duck
sfx=sfx*0.55
L=v+musL+sfx; R=v+musR+sfx
pk=max(np.abs(L).max(),np.abs(R).max()); L=np.tanh(L/pk*1.05)/np.tanh(1.05)*.93; R=np.tanh(R/pk*1.05)/np.tanh(1.05)*.93
out=np.stack([L,R],1).astype(np.float32)
open('mix.f32','wb').write(out.tobytes())
subprocess.run(['ffmpeg','-y','-loglevel','error','-f','f32le','-ar',str(SR),'-ac','2','-i','mix.f32','-t',str(DUR),'mix.wav'])
print('music rel dB', 20*np.log10(rms((musL+musR)/2)/vr))
