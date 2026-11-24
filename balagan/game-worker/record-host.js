const panel=document.getElementById('host-capture');
if(panel){
 const record=document.getElementById('record'), stop=document.getElementById('stop');
 const upload=document.getElementById('mp3'), notice=document.getElementById('capture-status');
 let stream,recorder,timer,parts=[];
 async function send(blob){
  notice.textContent='Saving your MP3…';
  const result=await fetch(panel.dataset.upload,{method:'POST',headers:{'Content-Type':'audio/mpeg'},body:blob});
  if(!result.ok)throw new Error(await result.text());
  location.reload();
 }
 async function encode(blob){
  const context=new AudioContext({sampleRate:44100});
  try{
   const decoded=await context.decodeAudioData(await blob.arrayBuffer());
   const data=decoded.getChannelData(0),pcm=new Int16Array(data.length);
   for(let i=0;i<data.length;i++){const value=Math.max(-1,Math.min(1,data[i]));pcm[i]=value<0?value*32768:value*32767;}
   const encoder=new lamejs.Mp3Encoder(1,44100,96), buffers=[];
   for(let i=0;i<pcm.length;i+=1152){const buffer=encoder.encodeBuffer(pcm.subarray(i,i+1152));if(buffer.length)buffers.push(new Uint8Array(buffer));}
   const end=encoder.flush();if(end.length)buffers.push(new Uint8Array(end));
   return new Blob(buffers,{type:'audio/mpeg'});
  }finally{await context.close();}
 }
 function failure(error){
  stream?.getTracks().forEach(track=>track.stop());
  clearTimeout(timer);record.disabled=false;stop.disabled=true;upload.disabled=false;
  notice.textContent=error?.message||'Recording could not be saved. Try again or upload an MP3.';
 }
 record.onclick=async()=>{
  try{
   record.disabled=true;upload.disabled=true;
   stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,autoGainControl:false}});
   recorder=new MediaRecorder(stream);parts=[];
   recorder.ondataavailable=({data})=>{if(data.size)parts.push(data);};
   recorder.onerror=()=>failure(new Error('Recording failed. Try again.'));
   recorder.onstop=async()=>{
    clearTimeout(timer);stop.disabled=true;stream.getTracks().forEach(track=>track.stop());
    notice.textContent='Preparing MP3…';
    try{await send(await encode(new Blob(parts,{type:recorder.mimeType})));}catch(error){failure(error);}
   };
   recorder.start();stop.disabled=false;
   notice.textContent='Recording. Stop when you finish the script.';
   timer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},58000);
  }catch(error){failure(error);}
 };
 stop.onclick=()=>{if(recorder?.state==='recording')recorder.stop();};
 upload.onchange=async()=>{
  if(!upload.files[0])return;
  try{record.disabled=true;upload.disabled=true;await send(upload.files[0]);}catch(error){failure(error);}
 };
}
