#!/usr/bin/env node

var lpath = '/usr/share/nodejs/dwap/node_modules/';

var readline = require('readline');
var fs = require('fs');
var asy = require("async");
var cl = console.log;
var path = require('path');
var sqlite3 = require(lpath+'sqlite3');
var pm2 = require(__dirname+'/pm2-apps.js');

function exec(cmd,cb){
	var childProcess = require('child_process');
	childProcess.exec(cmd,function (error, stdout, stderr) {
		if(typeof(cb)=="function") {
			if(error){ return cb({error:true,'err':error,'std':stderr,'msg':stderr});}
			else return cb(stdout);
		} else return null;
	});
};

function intpad(n){if(n<10) return "0"+n; return n.toString()}
function strpad(str,len,chr){str = str.toString();chr = chr || ' ';if(str.length > len) return str.substr(0,len-3)+'...';return str += new Array(len-str.length+1).join(chr);}
function keysort(array, key) {return array.sort(function(a, b) {var x = a[key]; var y = b[key];return ((x < y) ? -1 : ((x > y) ? 1 : 0));});}

// var def = [['TIME',9],['SITE',8],['FRQ',3], ['UNITS',6],['EVENT ID',50]];
function dohead(def){var tit=[],ul=[];def.map(function(e){tit.push(strpad(e[0],e[1]));ul.push(strpad('=',e[1],'='))});cl(tit.join(' '));cl(ul.join(' '))}
function dorow(def,row){var r=[];row.map(function(col,idx){r.push(strpad(col,def[idx][1]))});cl(r.join(' '))}

function multisort(arr,sf) {
  var s = '';
  sf.forEach(function(f,idx) {
    if(f.charAt(0)=='<'){f = f.replace('<',''); var k = '<';} else k = '>';
    s += 'if(arguments[0].'+f+k+'arguments[1].'+f+') return 1;';
    s += 'else if(arguments[0].'+f+'==arguments[1].'+f+')';
    s += (idx < sf.length-1)? '{' : 'return 0';
  });
  s += Array(sf.length).join('}')+';return -1';
  return arr.sort(new Function(s));
};

/* ######################## */
function dblget(arg,cb){
  // {file,site,date,secs}
  var db = new sqlite3.Database(arg.file);
  db.all("select '"+arg.site+"' as site, '"+arg.secs+"' as secs, duration, duration_parameter, next_trigger_time, id from events where trigger_on = 'timer' and next_trigger_time like '%"+arg.date+"%' ORDER BY next_trigger_time ASC;", function(err, rows) {
    cb(rows);  
  });	
  db.close();
}

function list(){
  var td = new Date();
  var dst = [td.getFullYear(),intpad(td.getMonth()+1,2),intpad(td.getDate(),2)].join('-');
  var rl = readline.createInterface({input: process.stdin,output: process.stdout});
  rl.question('Enter Date : ',function(date){
    rl.close();
    date = new Date(date).toString().split(' ').slice(1,3).join(' ');
    
    var idx=0,dbs = [];
    pm2.getAll().map(function(site){
      if(site.appid=='puremfg'){
        dbs.push([site.name.split('.')[0],site.env.DATA,idx]);
        idx++;  
      }
    })
    
    var evts=[];
    asy.eachSeries(dbs,function(db,next){
      var path = db[1]+'/dwap.db';
      dblget({'file':db[1]+'/dwap.db','site':db[0],'date':date,'secs':intpad(db[2]*5,2)},function(rows){
        evts = evts.concat(rows.sort());
        next();
      });
    },function(){
      cl('');
      var last, def = [['START',9],['SEC',3],['SITE',8],['FRQ',3],['UNITS',6],['EVENT ID',50]];
      dohead(def);
      multisort(evts,['next_trigger_time','id','secs']).map(function(evt){
        var dt = new Date(evt.next_trigger_time);
        var ds = [intpad(dt.getHours(),2),intpad(dt.getMinutes(),2),intpad(dt.getSeconds(),2)].join(':');
        if(last && last!=ds) cl();
        dorow(def,[ds,evt.secs,evt.site,evt.duration,evt.duration_parameter,evt.id]);
        last = ds;
      })
      cl(strpad('=',80,'='))
    })
  })
  rl.write(dst)
}

//return cl(process);
list();
