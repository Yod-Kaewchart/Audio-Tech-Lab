'use strict';
// Shared pure queue rules. A shuffled cycle visits each track once, with actual previous history.
class PlayerQueue {
 constructor(random=Math.random){this.random=random;this.reset();}
 reset(){this.current=null;this.history=[];this.bag=[];this.visited=new Set();this.shuffle=false;this.repeat='off';}
 sync(ids){this.history=this.history.filter(id=>ids.includes(id));this.bag=this.bag.filter(id=>ids.includes(id));this.visited=new Set([...this.visited].filter(id=>ids.includes(id)));if(!ids.includes(this.current))this.current=null;}
 select(id){if(this.current&&id!==this.current)this.history.push(this.current);this.current=id;this.visited.add(id);this.bag=this.bag.filter(key=>key!==id);return id;}
 next(ids,ended=false){
  if(!ids.length)return null;
  if(ended&&this.repeat==='one'&&this.current)return this.current;
  if(this.shuffle){
   if(!this.bag.length){let candidates=ids.filter(id=>!this.visited.has(id));if(!candidates.length){if(ended&&this.repeat!=='all')return null;this.visited.clear();candidates=ids.filter(id=>id!==this.current);if(!candidates.length)candidates=[...ids];}
    this.bag=[...candidates];for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}
   }return this.select(this.bag.shift());
  }
  const index=ids.indexOf(this.current);if(index===ids.length-1&&ended&&this.repeat!=='all')return null;return this.select(ids[(index+1)%ids.length]);
 }
 previous(ids){if(this.shuffle&&this.history.length){const target=this.history.pop();this.current=target;return target;}const index=ids.indexOf(this.current);return this.select(ids[(index-1+ids.length)%ids.length]);}
}
if(typeof module!=='undefined')module.exports={PlayerQueue};else window.PlayerQueue=PlayerQueue;
