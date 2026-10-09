const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn } = require('child_process');
const fs=require('fs'), path=require('path');
const WORK=__dirname;
(async()=>{
  const mode=process.argv[2];
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--disable-web-security','--allow-file-access-from-files','--force-color-profile=srgb']});
  const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
  page.on('console',m=>console.log('PAGE',m.text())); page.on('pageerror',e=>console.log('ERR',e.message));
  await page.goto('file://'+WORK+'/index.html');
  await page.waitForFunction('window.READY===true',null,{timeout:120000});
  const stage=await page.$('#stage');
  if(mode==='stills'){
    const ts=process.argv[3].split(',').map(Number);
    for(const t of ts){await page.evaluate(t=>render(t),t);await stage.screenshot({path:path.join(__dirname,'stills',`s_${t.toFixed(2)}.jpg`),type:'jpeg',quality:85});}
  } else if(mode==='sfx'){
    fs.writeFileSync(path.join(WORK,'sfx.json'),JSON.stringify(await page.evaluate(()=>window.SFX)));
  } else if(mode==='video'){
    const f0=+process.argv[3], f1=+process.argv[4], out=process.argv[5];
    const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r','30',out],{stdio:['pipe','inherit','inherit']});
    const st=Date.now();
    for(let f=f0;f<f1;f++){await page.evaluate(t=>render(t),f/30);
      const buf=await stage.screenshot({type:'jpeg',quality:93});
      if(!ff.stdin.write(buf)) await new Promise(r=>ff.stdin.once('drain',r));
      if((f-f0)%150===0) console.log(out,f,((Date.now()-st)/1000).toFixed(0)+'s');}
    ff.stdin.end(); await new Promise(r=>ff.on('close',r));
  }
  await browser.close();
})();
