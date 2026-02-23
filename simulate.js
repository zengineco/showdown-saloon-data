#!/usr/bin/env node
/**
 * SHOWDOWN SALOON — Hand Simulation Engine v4
 * 18 players · Two tables of 9 · $2/$5 · $400 max buy-in
 * GitHub Actions cron · append-only ledger · no resets ever
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const HISTORY_PATH      = path.join(__dirname, 'history.json');
const HAND_INTERVAL_SEC = 32;
const MAX_HANDS_PER_RUN = 2000;
const KEEP_RECENT       = 200;
const GENESIS_MS        = Date.UTC(2026, 1, 23, 0, 0, 0);
const SB = 2, BB = 5;
const MAX_BUYIN         = 400;
const REBUY_THRESHOLD   = 40;
const N = 9;

const ALL_PLAYERS = [
  {id:0,  name:'Gemini 3 Pro',     short:'Gem3',   emoji:'🔮', arch:'LAG'},
  {id:1,  name:'GPT-5.2',          short:'GPT5',   emoji:'🤖', arch:'TAG'},
  {id:2,  name:'Claude Opus 4.6',  short:'Opus',   emoji:'👁️', arch:'TAG'},
  {id:3,  name:'o3',               short:'o3',     emoji:'⚡', arch:'GTO'},
  {id:4,  name:'Claude Sonnet 4.6',short:'Sonnet', emoji:'🎯', arch:'TAG'},
  {id:5,  name:'GLM-5',            short:'GLM5',   emoji:'🦊', arch:'TAG'},
  {id:6,  name:'Gemini 2.5 Flash', short:'Flash',  emoji:'💨', arch:'LAG'},
  {id:7,  name:'Kimi K2.5',        short:'Kimi',   emoji:'🌙', arch:'LAG'},
  {id:8,  name:'MiniMax-M2.5',     short:'Mini',   emoji:'🔭', arch:'GTO'},
  {id:9,  name:'Llama 4',          short:'Llama',  emoji:'🦙', arch:'TAG'},
  {id:10, name:'DeepSeek-V3.2',    short:'DSV3',   emoji:'🧮', arch:'GTO'},
  {id:11, name:'Qwen3-235B',       short:'Qwen3',  emoji:'🐉', arch:'LAG'},
  {id:12, name:'Command A',        short:'CmdA',   emoji:'🏢', arch:'TAG'},
  {id:13, name:'GLM-4.7 Thinking', short:'GLM4',   emoji:'🧠', arch:'GTO'},
  {id:14, name:'Grok-3',           short:'Grok',   emoji:'🦅', arch:'LAG'},
  {id:15, name:'Phi-4',            short:'Phi4',   emoji:'⚙️', arch:'GTO'},
  {id:16, name:'Codestral-22B',    short:'Code',   emoji:'💻', arch:'TAG'},
  {id:17, name:'GPT-OSS',          short:'OSS',    emoji:'🔓', arch:'LAG'},
];

const TABLE_SEATS = [
  [0,1,2,3,4,5,6,7,8],
  [9,10,11,12,13,14,15,16,17],
];

function makeLCG(seed) {
  let s = (seed>>>0)+0x9e3779b9;
  return function() {
    s=(s+0x9e3779b9)>>>0; let z=s;
    z=Math.imul(z^(z>>>16),0x85ebca6b)>>>0;
    z=Math.imul(z^(z>>>13),0xc2b2ae35)>>>0;
    return (z^(z>>>16))>>>0;
  };
}
function handSeed(t,i){ return ((t*0x1337+i)*0x6c62272e+0xd59b3b4f)>>>0; }

const RANKS=['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
const SUITS=['♠','♥','♦','♣'];
const RANK_V={};RANKS.forEach((r,i)=>(RANK_V[r]=i+2));

function makeDeck(rng){
  const d=[];
  for(const r of RANKS)for(const s of SUITS)d.push({r,s,v:RANK_V[r]});
  for(let i=51;i>0;i--){const j=rng()%(i+1);[d[i],d[j]]=[d[j],d[i]];}
  return d;
}
function cs(c){return c.r+c.s;}

function evalBest5(cards){
  if(cards.length<5)return 0;let best=0;const n=cards.length;
  for(let a=0;a<n-4;a++)for(let b=a+1;b<n-3;b++)for(let c=b+1;c<n-2;c++)
    for(let d=c+1;d<n-1;d++)for(let e=d+1;e<n;e++){const sc=score5([cards[a],cards[b],cards[c],cards[d],cards[e]]);if(sc>best)best=sc;}
  return best;
}
function score5(c){
  const vs=c.map(x=>x.v).sort((a,b)=>b-a),ss=c.map(x=>x.s);
  const flush=ss.every(s=>s===ss[0]),st=straightHigh(vs),cnt={};
  for(const v of vs)cnt[v]=(cnt[v]||0)+1;
  const grps=Object.values(cnt).sort((a,b)=>b-a);
  const kk=Object.entries(cnt).sort((a,b)=>b[1]-a[1]||b[0]-a[0]).map(([v])=>+v);
  const enc=kk.reduce((acc,v,i)=>acc+v*Math.pow(15,kk.length-1-i),0);
  if(flush&&st===14)return 9e6+enc;if(flush&&st)return 8e6+st*1e3+enc;
  if(grps[0]===4)return 7e6+enc;if(grps[0]===3&&grps[1]===2)return 6e6+enc;
  if(flush)return 5e6+enc;if(st)return 4e6+st*1e3+enc;
  if(grps[0]===3)return 3e6+enc;if(grps[0]===2&&grps[1]===2)return 2e6+enc;
  if(grps[0]===2)return 1e6+enc;return enc;
}
function straightHigh(vs){
  const u=[...new Set(vs)];
  for(let i=0;i<=u.length-5;i++){const s=u.slice(i,i+5);if(s[0]-s[4]===4&&new Set(s).size===5)return s[0];}
  if(u.includes(14)&&u.includes(5)&&u.includes(4)&&u.includes(3)&&u.includes(2))return 5;
  return null;
}
function rankName(sc){
  if(sc>=9e6)return'Royal Flush';if(sc>=8e6)return'Straight Flush';
  if(sc>=7e6)return'Four of a Kind';if(sc>=6e6)return'Full House';
  if(sc>=5e6)return'Flush';if(sc>=4e6)return'Straight';
  if(sc>=3e6)return'Three of a Kind';if(sc>=2e6)return'Two Pair';
  if(sc>=1e6)return'One Pair';return'High Card';
}

function pfStr(hole){
  const[a,b]=hole,av=a.v,bv=b.v,suited=a.s===b.s;
  const hi=Math.max(av,bv),lo=Math.min(av,bv),gap=hi-lo;
  if(av===bv){if(hi>=12)return 0.90;if(hi>=9)return 0.74;if(hi>=6)return 0.58;return 0.44;}
  if(hi===14){if(lo>=12)return 0.84;if(lo>=10)return 0.72;if(lo>=8&&suited)return 0.64;if(lo>=6)return 0.55;return 0.44;}
  if(hi>=12&&lo>=10)return 0.68;if(gap<=2&&suited&&hi>=9)return 0.62;
  if(gap<=1&&hi>=9)return 0.57;if(suited&&hi>=10)return 0.54;
  if(gap<=2&&hi>=8)return 0.48;return 0.32;
}

function decide(pid,hole,board,pot,toCall,stack,position,nActive,street,rng){
  const seat=ALL_PLAYERS[pid],r01=()=>(rng()>>>0)/4294967295;
  if(street==='preflop')return decidePF(pid,hole,pot,toCall,stack,position,nActive,r01);
  let str=0;const all=[...hole,...board];
  if(all.length>=5)str=evalBest5(all)/9e6;else str=pfStr(hole)*0.85;
  const posBonus=position>=nActive-2?0.08:0,adj=str+posBonus;
  const potOdds=pot>0?toCall/(pot+toCall+0.001):0,spR=r01();
  if(toCall===0){
    if(adj>0.74&&spR<0.82){const b=Math.max(Math.floor(pot*(0.45+spR*0.35)),BB);return{action:'raise',amount:Math.min(b,stack)};}
    if(adj>0.50&&spR<0.45){const b=Math.max(Math.floor(pot*(0.33+spR*0.3)),BB);return{action:'raise',amount:Math.min(b,stack)};}
    if(seat.arch==='LAG'&&adj>0.36&&spR<0.42&&street==='flop'){const b=Math.max(Math.floor(pot*0.55),BB);return{action:'raise',amount:Math.min(b,stack)};}
    if(seat.arch==='GTO'&&spR<0.28&&adj>0.42){const b=Math.max(Math.floor(pot*(0.28+spR*0.2)),BB);return{action:'raise',amount:Math.min(b,stack)};}
    return{action:'call',amount:0};
  }
  if(adj>0.80&&stack>toCall*2&&spR<0.38){const rz=Math.min(Math.floor((pot+toCall)*2.3),stack);return{action:'raise',amount:rz};}
  if(adj>potOdds+0.20||(adj>0.68&&spR<0.7))return{action:'call',amount:Math.min(toCall,stack)};
  if(adj>potOdds-0.08&&spR<0.32)return{action:'call',amount:Math.min(toCall,stack)};
  return{action:'fold',amount:0};
}

function decidePF(pid,hole,pot,toCall,stack,position,nActive,r01){
  const seat=ALL_PLAYERS[pid],str=pfStr(hole),inBtn=position===nActive-1,spR=r01();
  const ft=seat.arch==='LAG'?0.30:seat.arch==='GTO'?0.36:0.40;
  if(str<ft){if(toCall===0)return{action:'call',amount:0};return{action:'fold',amount:0};}
  if(toCall===0){
    if(str>0.52||(inBtn&&str>0.40)||(seat.arch==='LAG'&&str>0.38)){const sz=Math.min((pot||BB)*3+BB,stack);return{action:'raise',amount:sz};}
    return{action:'call',amount:0};
  }
  const po=toCall/(pot+toCall);
  if(str>0.80||(str>0.70&&seat.arch==='LAG'&&spR<0.28)){const rz=Math.min(toCall*3+(pot||0),stack);return{action:'raise',amount:rz};}
  if(str>po+0.14)return{action:'call',amount:Math.min(toCall,stack)};
  return{action:'fold',amount:0};
}

function bettingRound(playerIds,folded,stacks,invested,hole,board,street,firstActOffset,dealerOffset,sbOff,bbOff,pot,rng){
  const bets=Array(N).fill(0);
  if(street==='preflop'){
    bets[sbOff]=Math.min(SB,stacks[sbOff]+invested[sbOff]);
    bets[bbOff]=Math.min(BB,stacks[bbOff]+invested[bbOff]);
  }
  let maxBet=bets.reduce((a,b)=>Math.max(a,b),0);
  const order=[];
  for(let off=0;off<N;off++){const s=(firstActOffset+off)%N;if(!folded[s])order.push(s);}
  const needsAct=new Set(order),actionLog=[];let safety=0;
  while(needsAct.size>0&&safety++<N*6){
    const s=order.find(x=>needsAct.has(x));if(s===undefined)break;
    needsAct.delete(s);if(folded[s])continue;
    const active=order.filter(x=>!folded[x]);if(active.length<=1)break;
    const toCall=Math.max(0,maxBet-bets[s]),position=active.indexOf(s);
    const pid=playerIds[s];
    const dec=decide(pid,hole[s],board,pot,toCall,stacks[s],position,active.length,street,rng);
    const ps=ALL_PLAYERS[pid].short;
    if(dec.action==='fold'){folded[s]=true;actionLog.push(`${ps}: FOLD`);}
    else if(dec.action==='call'||dec.amount===0){
      const amt=Math.min(toCall,stacks[s]);
      stacks[s]-=amt;bets[s]+=amt;pot+=amt;invested[s]+=amt;
      actionLog.push(`${ps}: ${toCall===0?'CHECK':`CALL $${amt}`}`);
    } else {
      const totalBet=Math.min(dec.amount,stacks[s]+bets[s]),add=totalBet-bets[s];
      if(add<=0){const amt=Math.min(toCall,stacks[s]);stacks[s]-=amt;bets[s]+=amt;pot+=amt;invested[s]+=amt;actionLog.push(`${ps}: CALL $${amt}`);}
      else{stacks[s]-=add;bets[s]+=add;pot+=add;invested[s]+=add;maxBet=bets[s];actionLog.push(`${ps}: RAISE to $${bets[s]}`);
        for(const other of order)if(!folded[other]&&other!==s&&bets[other]<maxBet)needsAct.add(other);}
    }
  }
  return{pot,actionLog};
}

function simulateHand(tIdx,handIdx,stacksIn,playerIds){
  const rng=makeLCG(handSeed(tIdx,handIdx)),stacks=[...stacksIn],deck=makeDeck(rng);
  const dIdx=handIdx%N,sbIdx=(dIdx+1)%N,bbIdx=(dIdx+2)%N;
  const hole=Array.from({length:N},()=>[deck.pop(),deck.pop()]);
  const board5=[deck.pop(),deck.pop(),deck.pop(),deck.pop(),deck.pop()];
  const folded=Array(N).fill(false),invested=Array(N).fill(0);
  const sbAmt=Math.min(SB,stacks[sbIdx]),bbAmt=Math.min(BB,stacks[bbIdx]);
  stacks[sbIdx]-=sbAmt;invested[sbIdx]+=sbAmt;stacks[bbIdx]-=bbAmt;invested[bbIdx]+=bbAmt;
  let pot=sbAmt+bbAmt;
  const aBS={preflop:[],flop:[],turn:[],river:[]};
  const utg=(dIdx+3)%N;
  const pfR=bettingRound(playerIds,folded,stacks,invested,hole,[],'preflop',utg,dIdx,sbIdx,bbIdx,pot,rng);
  pot=pfR.pot;aBS.preflop=pfR.actionLog;
  let active=Array.from({length:N},(_,i)=>i).filter(i=>!folded[i]);
  if(active.length===1){const w=active[0];stacks[w]+=pot;return bldR(tIdx,handIdx,dIdx,sbIdx,bbIdx,playerIds,hole,[],pot,w,'Uncontested',[],stacks,aBS,[]);}
  const flop=board5.slice(0,3);
  const flR=bettingRound(playerIds,folded,stacks,invested,hole,flop,'flop',(dIdx+1)%N,dIdx,sbIdx,bbIdx,pot,rng);
  pot=flR.pot;aBS.flop=flR.actionLog;
  active=Array.from({length:N},(_,i)=>i).filter(i=>!folded[i]);
  if(active.length===1){const w=active[0];stacks[w]+=pot;return bldR(tIdx,handIdx,dIdx,sbIdx,bbIdx,playerIds,hole,flop,pot,w,'Uncontested',[],stacks,aBS,[]);}
  const turn=[...flop,board5[3]];
  const tnR=bettingRound(playerIds,folded,stacks,invested,hole,turn,'turn',(dIdx+1)%N,dIdx,sbIdx,bbIdx,pot,rng);
  pot=tnR.pot;aBS.turn=tnR.actionLog;
  active=Array.from({length:N},(_,i)=>i).filter(i=>!folded[i]);
  if(active.length===1){const w=active[0];stacks[w]+=pot;return bldR(tIdx,handIdx,dIdx,sbIdx,bbIdx,playerIds,hole,turn,pot,w,'Uncontested',[],stacks,aBS,[]);}
  const river=[...turn,board5[4]];
  const rvR=bettingRound(playerIds,folded,stacks,invested,hole,river,'river',(dIdx+1)%N,dIdx,sbIdx,bbIdx,pot,rng);
  pot=rvR.pot;aBS.river=rvR.actionLog;
  const sdSeats=Array.from({length:N},(_,i)=>i).filter(i=>!folded[i]);
  let bestScore=-1,winner=-1;
  for(const s of sdSeats){const sc=evalBest5([...hole[s],...river]);if(sc>bestScore){bestScore=sc;winner=s;}}
  stacks[winner]+=pot;
  const rebuys=[];
  for(let i=0;i<N;i++)if(stacks[i]<=REBUY_THRESHOLD){rebuys.push({seat:i,playerId:playerIds[i],from:stacks[i]});stacks[i]=MAX_BUYIN;}
  return bldR(tIdx,handIdx,dIdx,sbIdx,bbIdx,playerIds,hole,river,pot,winner,rankName(bestScore),sdSeats,stacks,aBS,rebuys);
}

function bldR(tIdx,handIdx,dIdx,sbIdx,bbIdx,playerIds,hole,board,pot,wSeat,winHand,sdSeats,stacks,actions,rebuys){
  const ts=new Date(GENESIS_MS+handIdx*HAND_INTERVAL_SEC*1000).toISOString();
  return{tableIdx:tIdx,handIndex:handIdx,handNumber:handIdx+1,timestamp:ts,
    dealer:dIdx,sb:sbIdx,bb:bbIdx,playerIds:[...playerIds],pot,board:board.map(cs),
    winner:wSeat,winnerId:playerIds[wSeat],winnerName:ALL_PLAYERS[playerIds[wSeat]].short,
    winHand,sdSeats,hole:hole.map(h=>h.map(cs)),stacks:[...stacks],actions,rebuys};
}

function updateStats(stats,result){
  stats.handsDealt++;
  const wp=stats.byPlayer[result.winnerId];
  wp.wins++;wp.potsWon+=result.pot;
  if(result.sdSeats.length>1)for(const si of result.sdSeats){
    const pid=result.playerIds[si];stats.byPlayer[pid].showdowns++;
    if(si===result.winner)stats.byPlayer[pid].showdownWins++;
  }
  for(let seat=0;seat<N;seat++){
    const pid=result.playerIds[seat],p=stats.byPlayer[pid];
    if(result.stacks[seat]>p.stackHigh)p.stackHigh=result.stacks[seat];
    if(result.stacks[seat]<p.stackLow)p.stackLow=result.stacks[seat];
  }
  for(const rb of(result.rebuys||[])){
    stats.byPlayer[rb.playerId].rebuys=(stats.byPlayer[rb.playerId].rebuys||0)+1;
    stats.byPlayer[rb.playerId].rebuyChips=(stats.byPlayer[rb.playerId].rebuyChips||0)+MAX_BUYIN;
  }
}

function main(){
  console.log('[simulate] Showdown Saloon v4 — 18 players, 2 tables, $2/$5');
  const history=JSON.parse(fs.readFileSync(HISTORY_PATH,'utf8'));
  const now=Date.now();
  const currentHandIndex=Math.floor((now-GENESIS_MS)/(HAND_INTERVAL_SEC*1000));
  const lastHandIndex=history.meta.lastHandIndex;
  if(currentHandIndex<=lastHandIndex){console.log(`[simulate] Up to date at #${lastHandIndex+1}.`);return;}
  const fromIndex=lastHandIndex+1,toIndex=Math.min(currentHandIndex,fromIndex+MAX_HANDS_PER_RUN-1);
  console.log(`[simulate] Hands #${fromIndex+1} → #${toIndex+1}`);
  let t0S=[...history.tables[0].currentStacks],t1S=[...history.tables[1].currentStacks];
  const n0=[],n1=[];
  for(let i=fromIndex;i<=toIndex;i++){
    const r0=simulateHand(0,i,t0S,TABLE_SEATS[0]);t0S=r0.stacks;updateStats(history.lifetimeStats,r0);n0.push(r0);
    const r1=simulateHand(1,i,t1S,TABLE_SEATS[1]);t1S=r1.stacks;updateStats(history.lifetimeStats,r1);n1.push(r1);
  }
  history.meta.lastHandIndex=toIndex;history.meta.lastUpdated=new Date().toISOString();history.meta.totalHands=toIndex+1;
  history.tables[0].currentStacks=t0S;history.tables[1].currentStacks=t1S;
  history.tables[0].recentHands=[...history.tables[0].recentHands,...n0].slice(-KEEP_RECENT);
  history.tables[1].recentHands=[...history.tables[1].recentHands,...n1].slice(-KEEP_RECENT);
  const lw=r=>({n:r.handNumber,ts:r.timestamp,t:r.tableIdx,w:r.winnerId,wn:r.winnerName,wh:r.winHand,pot:r.pot,rebuys:r.rebuys.length});
  history.allTimeHands=[...(history.allTimeHands||[]),...n0.map(lw),...n1.map(lw)];
  fs.writeFileSync(HISTORY_PATH,JSON.stringify(history,null,2),'utf8');
  console.log(`[simulate] Done. Total: ${history.meta.totalHands}. Size: ${Math.round(fs.statSync(HISTORY_PATH).size/1024)}KB`);
}
main();
