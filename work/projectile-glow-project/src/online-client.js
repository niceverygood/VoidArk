export class OnlineClient {
 constructor(onState,onStatus){this.onState=onState;this.onStatus=onStatus;this.connected=false;this.players=[];this.socket=null;}
 connect(ship='ark',nation=''){
  return new Promise((resolve,reject)=>{const protocol=location.protocol==='https:'?'wss:':'ws:',url=protocol+'//'+location.host+'/galaxy';const socket=new WebSocket(url);this.socket=socket;let welcomed=false;
  const timeout=setTimeout(()=>{socket.close();reject(new Error('공유 은하 서버에 연결할 수 없습니다. npm run online으로 서버를 시작하세요.'));},6000);
  socket.onopen=()=>{let token;try{token=sessionStorage.getItem('void-ark-online-token');}catch{}socket.send(JSON.stringify({type:'join',token,ship,nation}));};
  socket.onmessage=event=>{let m;try{m=JSON.parse(event.data);}catch{return;}if(m.type==='welcome'){welcomed=true;clearTimeout(timeout);this.id=m.id;this.connected=true;try{sessionStorage.setItem('void-ark-online-token',m.token);}catch{}resolve();this.onStatus('접속 완료 · 조종사 '+m.id.slice(-4));}if(m.type==='state'){this.players=m.players;this.onState(m);}if(m.type==='ack'){if(!m.ok)this.onStatus('요청 불가 · 자원, 도약 충전, 교전 거리 또는 선행 조건을 확인하세요');this.refresh=true;}};
  socket.onclose=()=>{clearTimeout(timeout);this.connected=false;this.players=[];if(!welcomed)reject(new Error('접속 실패 · 공유 은하 서버 상태를 확인하세요'));else this.onStatus('서버 연결 종료 · 메뉴에서 다시 접속하세요');};socket.onerror=()=>{};
 });}
 command(name,...args){if(this.connected)this.socket.send(JSON.stringify({type:'command',name,args}));}
 input(input){if(this.connected&&this.socket.bufferedAmount<64000)this.socket.send(JSON.stringify({type:'input',input}));}
 close(){this.connected=false;this.socket?.close();this.players=[];}
}
