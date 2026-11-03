// Quiet, synthesized location sound. No samples leave the page; nothing plays until requested.
export function createSound(){
 let ctx,master,air,rumble,buffer,active=false,visible=true,place='',lastCue=-1,next=0;
 const profiles={overview:[570,.105],cage:[180,.030],gallows:[370,.064],thornhallow:[750,.068],veilcross:[1060,.084],cairnhold:[470,.075]};
 function start(){if(ctx)return;const BrowserAudio=window.AudioContext||window.webkitAudioContext;if(!BrowserAudio)return;
 ctx=new BrowserAudio();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
 buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const data=buffer.getChannelData(0);let y=0;for(let i=0;i<data.length;i++){y=.37*y+.63*(Math.random()*2-1);data[i]=y;}
 const wind=ctx.createBufferSource();wind.buffer=buffer;wind.loop=true;air=ctx.createBiquadFilter();air.type='lowpass';air.frequency.value=620;air.Q.value=.38;wind.connect(air).connect(master);wind.start();
 const bass=ctx.createOscillator();bass.frequency.value=72;rumble=ctx.createGain();rumble.gain.value=.012;bass.connect(rumble).connect(master);bass.start();}
 function level(){if(!ctx)return;const value=active&&visible?.19:0;master.gain.setTargetAtTime(value,ctx.currentTime,.16);}
 function tone(f,to,len,level,delay=0,type='sine'){if(!ctx||!active||!visible)return;
 const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(to,t+len);
 g.gain.setValueAtTime(.00001,t);g.gain.exponentialRampToValueAtTime(level,t+.018);g.gain.exponentialRampToValueAtTime(.00001,t+len);o.connect(g).connect(master);o.start(t);o.stop(t+len+.02);o.onended=()=>{o.disconnect();g.disconnect()};}
 function beat(key,q,magic){if(key==='veilcross'&&q===1){if(magic){[440,659,880].forEach((f,j)=>tone(f,f*1.006,.92,.155,j*.07));}else{tone(635,390,.28,.12,0,'triangle');tone(1168,828,.31,.1,.022);}}
 else if(key==='cage'&&q===1){tone(131,77,.37,.14,0,'triangle');tone(410,320,.20,.06,.12);}
 else if(q===1&&key!=='overview'){tone(92,48,.14,.2);tone(108,53,.10,.13,.31);}}
 function scene(key,q,magic){if(!ctx||!active||!visible)return;const t=ctx.currentTime;
 if(key!==place){place=key;lastCue=-1;next=t+1.4;const p=profiles[key]||profiles.overview;air.frequency.setTargetAtTime(p[0],t,.85);rumble.gain.setTargetAtTime(p[1]*.27,t,.9);}
 if(q!==lastCue){beat(key,q,magic);lastCue=q;}
 if(t>next){next=t+5.6+Math.random()*4;if(key==='thornhallow'||key==='veilcross'){tone(1550,2160,.15,.046);tone(1750,1390,.18,.037,.21);}else if(key==='cage'){tone(790,580,.11,.035);tone(576,565,.24,.018,.10);}else if(key==='cairnhold'){tone(330,329,.85,.041);tone(495,494,.75,.025,.04);}}}
 return {async toggle(){start();if(!ctx)return false;if(!active){await ctx.resume();}active=!active;level();return active;},visible(v){visible=v;level()},scene,reset(){lastCue=-1}};
}
