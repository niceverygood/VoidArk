const {app, BrowserWindow, protocol, net, Menu, dialog} = require('electron');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {contentPath} = require('./content-path.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'ark', privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
app.setName('VOID ARK');
app.setPath('userData', path.join(app.getPath('appData'), 'VOID ARK'));
const gotLock = app.requestSingleInstanceLock();
let win;
if (!gotLock) app.quit();
else {
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
  app.whenReady().then(()=>{
    const root = path.join(__dirname,'game');
    protocol.handle('ark',request=>{
      const file = contentPath(root,request.url);
      return file ? net.fetch(pathToFileURL(file).href) : new Response('Not found',{status:404});
    });
    win = new BrowserWindow({width:1280,height:800,minWidth:960,minHeight:600,title:'VOID ARK',backgroundColor:'#050b15',show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',(event,url)=>{if(url!=='ark://game/')event.preventDefault();});
    win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
    win.webContents.on('render-process-gone',(_e,details)=>dialog.showErrorBox('VOID ARK 실행 오류',details.reason+'\n게임을 다시 실행해 주세요. 저장된 진행은 유지됩니다.'));
    win.webContents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key==='F11'){win.setFullScreen(!win.isFullScreen());event.preventDefault();}});
    Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'게임',submenu:[{label:'전체 화면',accelerator:'F11',click:()=>win.setFullScreen(!win.isFullScreen())},{type:'separator'},{role:'quit',label:'게임 종료'}]}]));
    win.once('ready-to-show',()=>win.show());
    win.loadURL('ark://game/');
  });
  app.on('window-all-closed',()=>app.quit());
}
