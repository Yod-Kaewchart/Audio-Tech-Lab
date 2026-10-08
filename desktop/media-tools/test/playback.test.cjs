'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateCommand}=require('../src/playback.cjs');
test('public playback commands accept only controls with exact shapes and real scalar ranges',()=>{
 for(const type of ['play','pause','toggle','stop','next','previous'])assert.deepEqual(validateCommand({type}),{type});
 for(const [type,value] of [['seek',12.5],['volume',0],['volume',1],['mute',true],['shuffle',false],['repeat','one'],['artwork','cover']])assert.deepEqual(validateCommand({type,value}),{type,value});
 assert.equal(validateCommand({type:'play',trackId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'}).type,'play');
 for(const c of [null,[],{type:'tracks',tracks:[]},{type:'reset'},{type:'shutdown'},{type:'state'},{type:'play',mediaUrl:'file:///x'},{type:'play',trackId:'C:/x.wav'},{type:'volume',value:2},{type:'seek',value:-1},{type:'seek',value:NaN},{type:'mute',value:1},{type:'repeat',value:'forever'},{type:'artwork',value:'file:///x'},{type:'stop',value:true}])assert.throws(()=>validateCommand(c),e=>e.code==='INVALID_REQUEST');
});
