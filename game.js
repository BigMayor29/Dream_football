(() => {
"use strict";
const $ = id => document.getElementById(id);
const menu = $("menu"), game = $("game"), canvas = $("pitch"), ctx = canvas.getContext("2d");
const W = 1000, H = 560;
let running = false, paused = false, last = 0, elapsed = 0, homeScore = 0, awayScore = 0;
let careerWins = Number(localStorage.getItem("dfWins") || 0);
$("careerInfo").textContent = `CAREER RECORD  ·  ${careerWins} ${careerWins === 1 ? "WIN" : "WINS"}`;
const input = {x:0,y:0,sprint:false};
const field = {left:42,right:958,top:38,bottom:522};
let players = [], ball = {x:500,y:280,vx:0,vy:0,owner:0}, active = 0, goalFlash = 0, messageTimer = 0;
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
function say(text, seconds=1.3){ $("toast").textContent=text; messageTimer=seconds; }
function makePlayers(){
  players=[];
  const home = [[180,280],[300,150],[300,410],[420,225],[420,335]];
  const away = [[820,280],[700,150],[700,410],[580,225],[580,335]];
  home.forEach((p,i)=>players.push({x:p[0],y:p[1],homeX:p[0],homeY:p[1],team:0,n:i,hasBall:false,stun:0}));
  away.forEach((p,i)=>players.push({x:p[0],y:p[1],homeX:p[0],homeY:p[1],team:1,n:i,hasBall:false,stun:0}));
  active=0; ball={x:500,y:280,vx:0,vy:0,owner:0}; players[0].hasBall=true;
}
function resize(){
  const r=canvas.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.max(1,Math.floor(r.width*dpr)); canvas.height=Math.max(1,Math.floor(r.height*dpr));
  ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
  draw();
}
function startMatch(){
  menu.classList.add("hidden"); game.classList.remove("hidden"); $("pauseOverlay").classList.add("hidden");
  homeScore=0;awayScore=0;elapsed=0;running=true;paused=false;
  $("homeScore").textContent="0";$("awayScore").textContent="0";$("pauseBtn").textContent="Ⅱ";
  makePlayers(); say("KICK OFF! MOVE TO PLAY",2);
  requestAnimationFrame(loop); setTimeout(resize,40);
}
function setOwner(index){
  players.forEach(p=>p.hasBall=false);
  if(index===null){ball.owner=null;return}
  ball.owner=index;players[index].hasBall=true;active=index;ball.vx=ball.vy=0;
}
function nearestHome(){let best=0,bd=Infinity;players.forEach((p,i)=>{if(p.team===0){let d=dist(p,ball);if(d<bd){bd=d;best=i}}});return best}
function movePlayer(p,dx,dy,speed,dt){
  const mag=Math.hypot(dx,dy)||1;p.x+=dx/mag*speed*dt;p.y+=dy/mag*speed*dt;
  p.x=clamp(p.x,field.left+12,field.right-12);p.y=clamp(p.y,field.top+12,field.bottom-12);
}
function passBall(){
  if(!running||paused)return;
  const p=players[active]; if(ball.owner!==active){say("GET THE BALL FIRST");return}
  let target=-1,best=-Infinity;
  players.forEach((q,i)=>{if(q.team===0&&i!==active){let forward=q.x-p.x;let score=forward*0.8-Math.abs(q.y-p.y)*0.35;if(score>best){best=score;target=i}}});
  if(target<0)return;
  const q=players[target], dx=q.x-p.x,dy=q.y-p.y,mag=Math.hypot(dx,dy)||1;
  setOwner(null);ball.x=p.x;ball.y=p.y;ball.vx=dx/mag*470;ball.vy=dy/mag*470;say("PASS!");
}
function shootBall(){
  if(!running||paused)return;
  const p=players[active];
  if(ball.owner!==active){say("GET THE BALL FIRST");return}
  setOwner(null);ball.x=p.x;ball.y=p.y;
  const dx=960-p.x,dy=280-p.y + input.y*70;
  const mag=Math.hypot(dx,dy)||1;
  ball.vx=dx/mag*690;ball.vy=dy/mag*690;say("SHOOT!");
}
function scoreGoal(team){
  if(team===0){homeScore++;careerWins=homeScore>awayScore?careerWins:careerWins; $("homeScore").textContent=homeScore;}
  else {$("awayScore").textContent=awayScore+1;awayScore++;}
  if(team===0 && homeScore>awayScore){careerWins++;localStorage.setItem("dfWins",String(careerWins));}
  goalFlash=1.3;say(team===0?"GOOOAL! DREAM FC":"RIVAL FC SCORES",1.8);
  makePlayers();ball.x=500;ball.y=280;
}
function update(dt){
  if(!running||paused)return;
  elapsed+=dt; $("clock").textContent=`${String(Math.floor(elapsed/60)).padStart(2,"0")}:${String(Math.floor(elapsed%60)).padStart(2,"0")}`;
  if(elapsed>=180){running=false; say(homeScore>awayScore?"FULL TIME — YOU WIN!":homeScore<awayScore?"FULL TIME — TRY AGAIN!":"FULL TIME — DRAW!",10);return}
  if(messageTimer>0){messageTimer-=dt}
  if(goalFlash>0)goalFlash-=dt;
  const human=players[active];
  if(ball.owner===active){
    movePlayer(human,input.x,input.y,(input.sprint?245:165),dt);
    ball.x=human.x+15;ball.y=human.y+8;
  }else if(ball.owner===null){
    // Closest home player automatically moves toward loose ball; joystick moves selected player.
    players.forEach((p,i)=>{
      if(p.team===0&&i!==active&&dist(p,ball)>24){let dx=ball.x-p.x,dy=ball.y-p.y;movePlayer(p,dx,dy,82,dt)}
    });
    movePlayer(human,input.x,input.y,(input.sprint?245:165),dt);
    ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
    const drag=Math.pow(.985,dt*60);ball.vx*=drag;ball.vy*=drag;
    if(Math.hypot(ball.vx,ball.vy)<18){ball.vx=ball.vy=0}
    // Possession when a player reaches the loose ball.
    let closest=-1,cd=23;
    players.forEach((p,i)=>{let d=dist(p,ball);if(d<cd){cd=d;closest=i}});
    if(closest>=0){setOwner(closest);if(players[closest].team===1)say("RIVAL HAS THE BALL");}
  }else{
    const owner=players[ball.owner];
    if(owner.team===1){
      const dx=500-owner.x,dy=280-owner.y;movePlayer(owner,dx,dy,65,dt);
      ball.x=owner.x-14;ball.y=owner.y+5;
      if(owner.x<540&&Math.random()<dt*0.6){setOwner(null);ball.vx=-400;ball.vy=(Math.random()-.5)*180}
    }else{
      players.forEach((p,i)=>{if(p.team===0&&i!==active){let tx=p.homeX+(p.x<700?60:0),ty=p.homeY;movePlayer(p,tx-p.x,ty-p.y,42,dt)}});
      movePlayer(human,input.x,input.y,(input.sprint?245:165),dt);
      ball.x=owner.x+15;ball.y=owner.y+8;
    }
  }
  // Opponents press the ball and challenge possession.
  players.forEach((p,i)=>{
    if(p.team===1){
      const target=ball.owner!==null?players[ball.owner]:ball;
      if(dist(p,target)>23)movePlayer(p,target.x-p.x,target.y-p.y,88,dt);
      if(ball.owner!==null&&players[ball.owner].team===0&&dist(p,target)<19&&Math.random()<dt*.7){setOwner(i);say("POSSESSION LOST");}
    }else if(i!==active&&ball.owner!==i&&ball.owner!==null&&players[ball.owner].team===1){
      if(dist(p,ball)>22)movePlayer(p,ball.x-p.x,ball.y-p.y,105,dt);
      if(dist(p,ball)<20){setOwner(i);say("WIN THE BALL!");}
    }
  });
  // Goal openings are centred vertically. Ball crossing end line in the opening scores.
  if(ball.x<field.left+3){
    if(Math.abs(ball.y-280)<82){scoreGoal(1);return}
    ball.x=field.left+4;ball.vx=Math.abs(ball.vx)*.65;
  }
  if(ball.x>field.right-3){
    if(Math.abs(ball.y-280)<82){scoreGoal(0);return}
    ball.x=field.right-4;ball.vx=-Math.abs(ball.vx)*.65;
  }
  if(ball.y<field.top+4||ball.y>field.bottom-4){ball.vy*=-.7;ball.y=clamp(ball.y,field.top+4,field.bottom-4)}
  if(ball.owner!==null && players[ball.owner].team===0)active=ball.owner;
}
function draw(){
  if(!ctx)return;
  ctx.clearRect(0,0,W,H);
  // Pitch and alternating grass
  ctx.fillStyle="#23743b";ctx.fillRect(0,0,W,H);
  for(let i=0;i<10;i++){ctx.fillStyle=i%2?"#2a8042":"#26783d";ctx.fillRect(i*100,0,100,H)}
  ctx.strokeStyle="#ffffffb8";ctx.lineWidth=3;ctx.strokeRect(field.left,field.top,field.right-field.left,field.bottom-field.top);
  ctx.beginPath();ctx.moveTo(500,field.top);ctx.lineTo(500,field.bottom);ctx.stroke();
  ctx.beginPath();ctx.arc(500,280,65,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(500,280,3,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();
  // Penalty boxes and goals
  ctx.strokeRect(field.left,190,130,180);ctx.strokeRect(field.left,225,52,110);
  ctx.strokeRect(field.right-130,190,130,180);ctx.strokeRect(field.right-52,225,52,110);
  ctx.fillStyle="#e9eee9";ctx.fillRect(9,222,33,116);ctx.fillRect(958,222,33,116);
  ctx.strokeStyle="#dfe9df";ctx.lineWidth=2;ctx.strokeRect(9,222,33,116);ctx.strokeRect(958,222,33,116);
  // Players
  players.forEach((p,i)=>{
    ctx.save();ctx.translate(p.x,p.y);
    ctx.fillStyle="#0005";ctx.beginPath();ctx.ellipse(2,10,13,6,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=p.team===0?"#d7ff55":"#f4f5f1";
    ctx.beginPath();ctx.arc(0,0,13,0,Math.PI*2);ctx.fill();
    ctx.lineWidth=i===active?4:2;ctx.strokeStyle=i===active?"#10220d":(p.team===0?"#f4ffd1":"#b3c0b6");ctx.stroke();
    ctx.fillStyle=p.team===0?"#13200d":"#17251c";ctx.font="bold 11px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(String(p.n+1),0,1);
    if(i===active){ctx.strokeStyle="#e9ff98";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.stroke()}
    ctx.restore();
  });
  // Ball
  ctx.save();ctx.translate(ball.x,ball.y);ctx.fillStyle="#0006";ctx.beginPath();ctx.ellipse(3,7,8,4,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#263129";ctx.lineWidth=1.2;ctx.stroke();
  ctx.fillStyle="#202820";ctx.beginPath();ctx.arc(0,0,2.5,0,Math.PI*2);ctx.fill();ctx.restore();
  if(goalFlash>0){ctx.fillStyle=`rgba(215,255,85,${Math.min(.22,goalFlash*.16)})`;ctx.fillRect(0,0,W,H)}
}
function loop(t){
  if(!running)return;
  const dt=Math.min((t-last)/1000||0,0.04);last=t;
  if(!paused){update(dt);draw()}
  requestAnimationFrame(loop);
}
// Joystick pointer controls; works with touch and mouse.
const joystick=$("joystick"),stick=$("stick");let pointerId=null;
function joyMove(e){
  const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  const max=r.width*.29;let dx=e.clientX-cx,dy=e.clientY-cy,mag=Math.hypot(dx,dy);
  if(mag>max){dx=dx/mag*max;dy=dy/mag*max}
  input.x=dx/max;input.y=dy/max;
  stick.style.transform=`translate(${dx}px,${dy}px)`;
}
joystick.addEventListener("pointerdown",e=>{e.preventDefault();pointerId=e.pointerId;joystick.setPointerCapture(pointerId);joyMove(e)});
joystick.addEventListener("pointermove",e=>{if(pointerId===e.pointerId)joyMove(e)});
function joyEnd(e){if(pointerId===e.pointerId){pointerId=null;input.x=input.y=0;stick.style.transform="translate(0,0)"}}
joystick.addEventListener("pointerup",joyEnd);joystick.addEventListener("pointercancel",joyEnd);
$("sprintBtn").addEventListener("pointerdown",e=>{e.preventDefault();input.sprint=true});
["pointerup","pointercancel","pointerleave"].forEach(ev=>$("sprintBtn").addEventListener(ev,()=>input.sprint=false));
$("passBtn").addEventListener("click",passBall);$("shootBtn").addEventListener("click",shootBall);
$("startBtn").addEventListener("click",startMatch);
$("careerBtn").addEventListener("click",()=>{careerWins=Number(localStorage.getItem("dfWins")||0);$("careerInfo").textContent=`CAREER RECORD  ·  ${careerWins} ${careerWins===1?"WIN":"WINS"} — KICK OFF TO ADD TO YOUR RECORD`;});
function togglePause(){if(game.classList.contains("hidden"))return;paused=!paused;$("pauseOverlay").classList.toggle("hidden",!paused);$("pauseBtn").textContent=paused?"▶":"Ⅱ";if(!paused){last=performance.now();requestAnimationFrame(loop)}}
$("pauseBtn").addEventListener("click",togglePause);$("resumeBtn").addEventListener("click",togglePause);
$("menuBtn").addEventListener("click",()=>{running=false;paused=false;game.classList.add("hidden");$("pauseOverlay").classList.add("hidden");menu.classList.remove("hidden");$("careerInfo").textContent=`CAREER RECORD  ·  ${Number(localStorage.getItem("dfWins")||0)} WINS`;});
window.addEventListener("resize",resize);window.addEventListener("orientationchange",()=>setTimeout(resize,150));
document.addEventListener("visibilitychange",()=>{if(document.hidden&&running&&!paused)togglePause()});
makePlayers();resize();
})();