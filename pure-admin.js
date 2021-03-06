#!/usr/bin/env node

global.$ = require('./pure-admin.json').$;

var readline = require('readline');
var fs = require('fs');
var asy = require("async");
var cl = console.log;
var path = require('path');
var sqlite3 = require('sqlite3');
var mysql = require('mysql');


var getall = require($.__pm2+'/pm2-apps.js').getall;
var pm2 = require($.__pm2+'/node_modules/pm2');

var his;
try{$.his = JSON.parse(fs.readFileSync($.__his))} 
catch(err){$.his = {}; hisput('init',true)}

function exec(cmd,cb){
	var childProcess = require('child_process');
	childProcess.exec(cmd,function (error, stdout, stderr) {
		if(typeof(cb)=="function") {
			if(error){ return cb({error:true,'err':error,'std':stderr,'msg':stderr});}
			else return cb(stdout);
		} else return null;
	});
};

function clone(obj){return JSON.parse(JSON.stringify(obj))}
function getrl(){return readline.createInterface({input: process.stdin,output: process.stdout})}
function intpad(n){if(n<10) return "0"+n; return n.toString()}
function objidx(ar,key,val){return ar.map(function(e){return e[key]}).indexOf(val);}

function strpad(str,len,chr){if(str===null||str===undefined) str='';str = str.toString();chr = chr || ' ';if(str.length > len) return str.substr(0,len-3)+'...';return str += new Array(len-str.length+1).join(chr);}
function keysort(array, key) {return array.sort(function(a, b) {var x = a[key]; var y = b[key];return ((x < y) ? -1 : ((x > y) ? 1 : 0));});}

function obj2url(obj){
  return Object.keys(obj).map(function(k) {
    return encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]);
  }).join('&')
}

// var def = [['TIME',9],['SITE',8],['FRQ',3], ['UNITS',6],['EVENT ID',50]];
function dohead(def){
  var tit=[],ul=[];
  def.map(function(e){tit.push(strpad(e[0],e[1]));ul.push(strpad('=',e[1],'='))});
  process.stdout.write(ul.join(' ')+"\n");
  process.stdout.write(style(tit.join(' '),'fg_blu')+"\n");
  process.stdout.write(ul.join(' ')+"\n");
}

function dorow(def,row,sty){
  var r=[];
  row.map(function(col,idx){r.push(strpad(col,def[idx][1]))});
  if(sty) process.stdout.write(style(r.join(' '),sty)+"\n");
  else process.stdout.write(r.join(' ')+"\n");
}

// common error handler.
function error(res){
  cl(res.msg);
  pm2.disconnect();
  process.exit();
}

function dofoot(def,msg){
  var tit=[],ul=[];
  def.map(function(e){tit.push(strpad(e[0],e[1]));ul.push(strpad('=',e[1],'='))});
  process.stdout.write(ul.join(' ')+"\n");
  if(msg) process.stdout.write(style(msg,'fg_blu')+"\n\n");
}

function adddir(file) {var dir = $.__run+file.split('/').slice(0,-1).join('/');try {fs.statSync(dir)} catch(e) {fs.mkdirSync(dir)}}
function csv(str){return str.split(/[ ,]+/).filter(Boolean);}
function exists(path){try{fs.statSync(path);return true} catch(err){return false}}

function multisort(arr,sf) {
  var s = ''; sf.forEach(function(f,idx) {
    if(f.charAt(0)=='<'){f = f.replace('<',''); var k = '<';} else k = '>';
    s += 'if(arguments[0].'+f+k+'arguments[1].'+f+') return 1;';
    s += 'else if(arguments[0].'+f+'==arguments[1].'+f+')';
    s += (idx < sf.length-1)? '{' : 'return 0';
  });
  s += Array(sf.length).join('}')+';return -1';
  return arr.sort(new Function(s));
};

function hisget(id){
  var idu = id+'_'+$.uid;
  if(!(idu in $.his)) $.his[idu]=null;
  return $.his[idu];
}

function hisput(id,val){
  var idu = id+'_'+$.uid;
  if(!(idu in $.his)) $.his[idu]=null;
  if($.his[idu] != val) $.his[idu]=val;
  return fs.writeFileSync($.__his,JSON.stringify($.his,null,2));
}

function hislast(id){
  var last = hisget(id);
  if(last) return last;
  return ''; 
}

// backend HTTP Request
function http(url,cb){
  var request = require('request');
  request({
    url: url,
    headers: {
    'User-Agent': 'local-request'
    }
  }, function (err,res,body) {
    if (!err && res.statusCode == 200) return cb(body);
    else return cb({error:true,msg:err})
  })
}

function sdate(date){
  if(!date) return '';
  var d = new Date(date);
  var sd = [d.getYear()-100,intpad(d.getMonth()+1,2),intpad(d.getDate(),2)].join('');
  sd+=' '+[intpad(d.getHours(),2),intpad(d.getMinutes(),2),intpad(d.getSeconds(),2)].join(':');
  return sd; 
}

// ### Command Line ###

/*
if(process.argv.length > 2){
  const rl = getrl(); 
  rl.question(strpad('Enter 3 Letter User ID:',25), function(uid){
    rl.close();
    $.uid = uid.toUpperCase();
    var cmd = process.argv[2];
    //var arg = process.argv.splice(3);
    var arg = process.argv[3];
    module.exports[cmd](function(res){cl(JSON.stringify(res,null,2))},arg);
  });
} else {
  cl('USAGE:','pureadmin');
}
*/

function style(str,sty,noclr){
  var cols={res: "\x1b[0m",bright : "\x1b[1m",dim : "\x1b[2m",ul : "\x1b[4m",blink : "\x1b[5m",reverse : "\x1b[7m",hide : "\x1b[8m",fg_blk : "\x1b[30m",fg_red : "\x1b[31m",fg_grn : "\x1b[32m",fg_yel : "\x1b[33m",fg_blu : "\x1b[34m",fg_pur : "\x1b[35m",fg_cyn : "\x1b[36m",fg_wht : "\x1b[37m",bg_blk : "\x1b[40m",bg_red : "\x1b[41m",bg_grn : "\x1b[42m",bg_yel : "\x1b[43m",bg_blu : "\x1b[44m",bg_pur : "\x1b[45m",bg_cyn : "\x1b[46m",bg_wht : "\x1b[47m"};
  str = cols[sty]+str;
  if(!noclr) str+=cols['res'];
  return str;
}

function slquery(site,sql,cb){
  var path = site.env.DATA+'/dwap.db';
  var db = new sqlite3.Database(path);
  db.all(sql, function(err, rows) {
    if(err) return cb({error:true,msg:err.message});
    cb(rows);  
  });	
  db.close();
}

function slexec(site,sql,cb){
  var path = site.env.DATA+'/dwap.db';
  var db = new sqlite3.Database(path);
  db.exec(sql, function(err, rows) {
    if(err) return cb({error:true,msg:err.message});
    cb(rows);  
  });	
  db.close();
}

function myquery(site,sql,cb){
  var db = site.env.DBSA;
  var con = mysql.createConnection({
    host     : db.host,
    user     : db.user,
    password : db.pwd,
    database : db.name
  });

  con.connect();
  con.query(sql, function (err,rs) {
    if (err) return cb({error:true,msg:err.message})
    cb(rs);
  });
  con.end();
}; var myexec = myquery;

function getsite(cb,msg){
  msg = msg || 'Select Site ID';
  var err=[],list=[],slist=[];
  //$.allsites = require($.__pm2+'pm2-apps.js',true).getall(true);
  $.allsites = getall(true);
  var idx=0;
  for(var site in $.allsites){
    $.allsites[site].idx = idx;
    if($.allsites[site].appid=='puremfg') {
      var len = slist.push(site);
      list.push(len);
      idx++;
  }}
  const rl = getrl();  
  cl(); slist.map(function(e,i){cl(strpad(i+1+'.',3),e)});
  rl.question('\n'+msg+': ',function(idx){
    hisput('sites',idx);
    rl.close();
    var sout = [];
    lists(list,idx).map(function(idx){
      sout.push($.allsites[slist[idx-1]])
    });
    cb(sout);
  });
  rl.write(hislast('sites'));
}

/* ######################## */


function mydump(user='ROOT',pwd,db,fn,cb){
  exec(`/usr/bin/mysqldump --routines -u ${user} -p${pwd} ${db} | sed -e 's/DEFINER=[^ |\*]*//' > ${fn}`,cb)
}

function lists(list,idx){
  if(!idx || /q/i.test(idx)) return cb();
  var sids = idx.split(/ *\, */);
  if(sids=='all') sids=list;
  return sids;
}

function ___sqlid(cb,arg){
  getsite(function(sites){
    const rl = getrl();
    rl.question('Enter _sqlid : ', function(sqlid){
      rl.question('Enter _func : ', function(func){
        rl.close();
        hisput('sqlid_id',sqlid);
        hisput('sqlid_fn',func);         
        asy.eachSeries(sites,function(site,next){
          var url = "http://localhost:"+site.env.PORT+"/?_func="+func+"&_sqlid="+sqlid;
          cl(url);
          http(url,function(res){
            try{cl(JSON.parse(res))}
            catch(e){cl(res)}
            next();
          });
        })
      
      })
      rl.write(hislast('sqlid_fn'));
    })
    rl.write(hislast('sqlid_id'));  
  })  
}

function logins(site,cb){
  http("http://localhost:"+site.env.PORT+"/?_func=get&_sqlid=admin^logins",function(res){
    var rows = JSON.parse(res);
    var users=[]; rows.ofc.rows.map(function(row){
      var exp = (new Date(row.maxage) - new Date().getTime())/60000;
      users.push([row.uid,exp])
    });
    cb({'uids':users,'data':rows});
  });  
}

// Login Columns
function devcols(site,res,next){
  var cols = [['SITE ID',10],['DEVICE ID',18],['IP ADDRESS',17],['LOGIN TIME',16],['LAST TXN',16],['EXPIRES',16],['MIS/HR',6]] 
  if(!$.colhead) {cl(); dohead(cols);$.colhead=true;}
  res.sf.rows.map(function(row){
    row.misshr = row.misshr || 0;
    dorow(cols,[site.name.split('.')[0].toUpperCase(),row.devid,row.ip,sdate(row.login),sdate(row.last),sdate(row.expires),row.misshr]);  
  })
  if(res.sf.rows.length > 0) cl();
  next();
}

function usrcols(site,res,next){
  var cols = [['SITE ID',8],['USER ID',15],['IP ADDRESS',15],['LOGIN TIME',16],['EXPIRES',22],['PATH',25]];
  $.ucols = cols; 
  if(!$.colhead) {cl(); dohead(cols);$.colhead=true;}
  if(res && res.ofc && res.ofc.rows) {
      res.ofc.rows.map(function(row){
      $.rowtot ++;
      var sty;
      row.expires = ((new Date(row.maxage) - new Date().getTime())/60000).toFixed(1);
      //if($.uid = 'xPAC' && row.expires < 10) var expires = style(row.expires,'fg_red'); else var expires = row.expires;
      if(row.expires < 20) {
        row.expires += '*';
        sty = 'fg_red';
      }
      if(row.last=='1') row.last = '-';
      if($.array.indexOf(row.uid)>-1) row.uid+='*';
      else $.array.push(row.uid);
      row.last = row.last.replace(/\^/g,' > ');
      dorow(cols,[site.name.split('.')[0].toUpperCase(),row.uid,row.ip,sdate(row.login),sdate(row.maxage)+' '+row.expires,row.last],sty);  
    })
    if(res.ofc.rows.length > 0) cl();
  }
  next();
}

// Login Columns
function updcols(site,rows,next){
  var cols = [['#',4],['MOD',8],['ID',34],['STAMP',16],['VERSION',9],['STATUS',9]] 
  if(!$.colhead) {cl(); dohead(cols);$.colhead=true;}
  rows.map(function(row,idx){
    row.misshr = row.misshr || 0;
    //if(row.status=='released') dorow(cols,[style(idx+1,'fg_red'),row.mod,row.id,row.ts,row.rver,row.status]);
    dorow(cols,[idx+1,row.mod,row.id,row.ts,row.rver,row.status]); 
  })
  next();
}

function getevents(site,cb){
  http("http://localhost:"+site.env.PORT+"/?_func=get&_sqlid=admin^events",function(res){
    cb(JSON.parse(res));
  });  
}

function events(site,res,next){
  date = new Date($.date).toString().split(' ').slice(1,3).join(' ');
  var evts=[]; JSON.parse(res).map(function(e){
    if(e.trigger_on=='timer' && e.next_trigger_time.indexOf(date) >-1){
      evts.push({
        site: site.name.split('.')[0].toUpperCase(),
        secs: site.idx * 5,
        duration: e.duration,
        next_trigger_time:e.next_trigger_time,
        id: e.id,
        duration_parameter: e.duration_parameter
      })
    }  
  })

  var last, def = [['START',9],['SEC',3],['SITE',8],['FRQ',3],['UNITS',6],['EVENT ID',50]];
  if(!$.colhead) {cl(); dohead(def);$.colhead=true;}
  multisort(evts,['next_trigger_time','id','secs']).map(function(evt){
    var dt = new Date(evt.next_trigger_time);
    var ds = [intpad(dt.getHours(),2),intpad(dt.getMinutes(),2),intpad(dt.getSeconds(),2)].join(':');
    //if(last && last!=ds) cl();
    dorow(def,[ds,evt.secs,evt.site,evt.duration,evt.duration_parameter,evt.id]);
    last = ds;
  });
  cl();
  next();  
}

function upfiles(site,sel,cb){
  http("http://localhost:"+site.env.PORT+"/?_func=get&_sqlid=admin^updates&shost=update.puremfg.net",function(refdat){
    http("http://localhost:"+site.env.PORT+"/?_func=get&_sqlid=admin^versions",function(locdat){

      try {refdat = JSON.parse(JSON.parse(refdat));} catch (err){refdat = {};}
      try {locdat = JSON.parse(locdat);} catch (err){locdat = {};}
           
      //cl(refdat.info,locdat.info);
      var mods=[], rows=[], keeps={};
      
      // one-time update.
      var dbsa=['DELETE FROM dbsa.UPDATES'], dwap=['DELETE FROM updates'];
      for(var f in refdat.files){
        
        if( (/tracked\.json|untracked\.json|\.log/).test(refdat.files[f].path) ) continue;
        
        // MYSQL / MSSQL
        if((/(dbsa\..*\.sql)/i).test(refdat.files[f].path)){
          var sqlfn = refdat.files[f].path.split('.')[1]; //sql/dbsa.160919.sql
          dbsa.push("INSERT INTO UPDATES(ID) VALUES('"+sqlfn+"')");
          if(locdat.dbsa.indexOf(sqlfn) !=-1) continue; // in tracked AND found in db        
          else refdat.files[f].lver = '-none-';
          refdat.files[f].sql = true;
        } 
        
        // SQLITE
        else if((/(dwap\..*\.sql)/i).test(refdat.files[f].path)){
          var sqlfn = refdat.files[f].path.split('.')[1]; //sql/dwap.160919.sql
          dwap.push("INSERT INTO updates(id) VALUES('"+sqlfn+"')");
          if(locdat.dwap.indexOf(sqlfn) !=-1) continue;
          else refdat.files[f].lver = '-none-';
          refdat.files[f].sql = true;
        }
        
        else refdat.files[f].sql = false;
        
        var bits = f.split('/');
      
        if(bits.length == 1){
          var mod = 'ROOT';
          var path = bits[0];
        }

        else if(bits[0]=='mod') {
          if(bits.length > 2){
            var mod = bits[1].toUpperCase();
            var path = bits.slice(2).join(' > ').toUpperCase();
          } else {
            var mod = 'MOD';
            var path = bits.slice(1).join(' > ').toUpperCase();
          } 
        }
       
        else {
          var mod = bits[0].toUpperCase();
          var path = bits.slice(1).join(' > ').toUpperCase();  
        }         
        
        if(objidx(mods,'value',mod)==-1) mods.push({'text':mod,'value':mod});
        
        var lver='-none'; 
        if(locdat.files[f] && locdat.files[f].ver) lver = locdat.files[f].ver;
        
        var sync = 'y'; if(lver != refdat.files[f].ver) sync = 'n';
        
        // rows.push({
        if(lver != refdat.files[f].ver && refdat.files[f].status == 'released') rows.push({
          'id':f, 
          'mod':mod,
          'fn':path,
          'ts': sdate(new Date(refdat.files[f].ts)),
          'rver':refdat.files[f].ver, 
          'path':refdat.files[f].path, 
          'lver':lver,
          'sync':sync,
          'lock':refdat.files[f].lock,
          'note': refdat.files[f].note,
          'status': refdat.files[f].status,
          'sql': refdat.files[f].sql
        });
        
        if( f.indexOf('test') !== 0) keeps[f] = refdat.files[f];
        
      }

      cb({
        'rows':multisort(rows,['mod','fn']),
        'mods':multisort(mods,['value']),
        'dbsa':dbsa,
        'dwap':dwap
      });
      
    })
  })
}

// nginx configuration
function ngt(pmt){
return `server { 
  listen 443 ssl http2; 
  listen [::]:443 http2; 
  #listen 80; 
  #listen [::]:80; 
  server_name ${pmt.name}; 
  root ${$.__root}/public; 

  location / { 
    try_files $uri @backend; 
  } 

  location ~ .(?:ico|jpg|css|png|js|swf|woff|eot|svg|ttf|html|gif)$ { 
    add_header Pragma "public"; 
    add_header Cache-Control "public"; 
    expires 30d; 
  } 

  location @backend {
    proxy_pass http://localhost:${pmt.env.PORT}; 
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; 
    proxy_set_header Host $http_host; 
    proxy_set_header X-Forwarded-Proto $scheme; 
    proxy_buffering off; 
  } 

  location = /444-response {return 444;} 
}`;
}

function utils(site){
  const rl = getrl();
  var opts = [    
    
    {
      txt:'Add new Site', 
      qp:[],
      nosite:function(){
        
        // find existing max port
        var maxport = 0;
        getall().map(function(site){
          if(site.appid=='puremfg' && site.env.PORT > maxport) maxport = parseInt(site.env.PORT);   
        })
        maxport += 10;

        // PM2 Configuration
        var pmt = {
          "name": "",
          "disabled": false,
          "appid": "puremfg",
          "script": "",
          "log_date_format": "DD-MM HH:mm:ss",
          "exec_mode": "fork",
          
          "env": {
            "TZOSET": "",
            "SITEID": "",
            "GRPID": "",
            "DATA": "",
            "GRP_DATA": "",
            "NODE_ENV": "production",
            "PORT": 0,
            "DBSA": {
              "host": "",
              "name": "",
              "user": "root",
              "pwd": "",
              "engine": "MYSQL",
              "pooling": true,
              "connectionLimit": 0
            }
          }
        };      

        var qs = {
          'pmt.name': {
            txt: 'http host name',
            post: function(item,val){
              val = val.toUpperCase();
            }
          },
          
          'pmt.env.SITEID': {
            txt: 'site ID'},
          
          'pmt.env.GRPID': {
            txt: 'group ID',
            pre: function(item,val){
              item.def = pmt.env.SITEID  
            }
          },

          'pmt.script': {
            txt: 'Path to Engine',
            def: `${$.__root}/pureapp.js`
          },
          
          'pmt.env.DATA': {
            txt: 'Site Data Path',
            def: $.__data, 
            pre: function(item,val){
              item.def += '/' + qs['pmt.env.SITEID'].val+'/data';
            }
          },
          
          'pmt.env.GRP_DATA': {
            txt: 'Group Data Path',
            def: $.__data, 
            pre: function(item,val){
              item.def += '/' + qs['pmt.env.GRPID'].val+'/data';
            }
          },
          
          'pmt.env.PORT': {
            txt: 'Node Port',
            def: maxport.toString()
          },
          
          'pmt.env.DBSA.host': {
            txt: 'Database Host / IP',
            def: $.dbhost
          },

          'pmt.env.DBSA.pwd': {
            txt: 'MYSQL Root Password'
          },
          
          'pmt.env.DBSA.name': {
            txt: 'Database Name',
            pre: function(item,val){
              item.def = qs['pmt.env.SITEID'].val.toUpperCase()
            }
          },

          'pmt.env.DBSA.connectionLimit': {
            txt: 'Max Connections',
            def: '5',
            post: function(item,val){
              val = parseInt(val);
            }
          },

          'pmt.env.TZOSET': {
            txt:  'Timezone Offset',
            def:  '+8:00'
          },
          
        }
        
        // loop through the questions.
        var vars = Object.keys(qs);
        const rl = getrl();
        asy.eachSeries(vars,function(key,next){
          var val,item = qs[key];
          if(item.pre) item.pre(item,val);
          
          rl.question(`Enter ${strpad(item.txt,20)} >: `, function(val){
            if(!val) error({error:true,msg:'value cannot be null'})
            if(item.post) item.post(item,val);
            qs[key].val = val;
            eval(`${key}=val`);
            next();
               
          });
          if(item.def) rl.write(item.def);
        },function(){
          
          // questions finished
          cl('====');
          rl.close();
          
          var sid = pmt.env.SITEID;
          var path = `${$.__pm2}/json/${sid}.json`;
        
          // write the pm2 file
          fs.writeFile(path,JSON.stringify({"apps":[pmt]},null,2),'utf-8',function(err){          
            
            // create folder structure.
            cl(`Creating Default Folders ${pmt.env.DATA}`);
            var cmd = `mkdir -p ${pmt.env.DATA}; cp -rp ${$.__tpl}/data/* ${pmt.env.DATA}/`; 
            exec(cmd,function(res){
              //ignore errors if folder already exists
              
              // Create nginx configuration.
              var ngfn = `${$.__ngpath}/${pmt.name}.conf`;
              cl(`Saving NGINX config ${ngfn}`);
                fs.writeFile(ngfn,ngt(pmt),'utf-8',function(err){
                  if(err) error(err);
                  cl('@@@@@@@@@ DONE @@@@@@@@');
                  cl(`Port Number is ${pmt.env.PORT}`);
                  cl(`Please create database ${pmt.env.DBSA.name} before starting engine.`);
                  cl(`Please reload nginx: service nginx reload`);
                  cl(`To start engine:\n pm2 start ${path}`);
                  cl('=======================');
                })   
                  
            });         
          });
        });
      },        
    },

    {
      txt:'User Logins',
      qp:['_func=get','_sqlid=admin^logins'],
      post:usrcols,
      done:function(site,sel){
        var msg = $.rowtot+' users logged in.'+' Select "Logout Idle Users" to logout idle (red) users.';
        dofoot($.ucols,msg);
      }
    },
    
    {txt:'Device Logins', qp:['_func=get','_sqlid=admin^logins'],post:devcols},
    
    {
      txt:'User Logout Request', 
      qp:['_func=usermsg'],
      pre_http:function(site,sel,go){
        var qp = sel.qp.slice();
        var msg = 'Dear $userid;\n\nCan you please log out for a few minutes so we can apply some updates.\n\nThank You.'
        logins(site,function(log){
          var uids=[$.uid];log.uids.map(function(e){uids.push(e[0])}); //['PAC',30]
          qp.push('userid='+uids.join('^'),'msg='+msg);
          cl(strpad(site.name.split('.')[0]+' sending to: ',20)+uids.join(','));
          cl();
          go(qp);
        });  
      }
    },
    
    {
      txt:'Logout Idle Users', 
      qp:['_func=logout'],
      pre_http: function(site,sel,go){
        logins(site,function(log){
          var th = 20, qp = sel.qp.slice();
          var uids=[];log.uids.map(function(e){
            if(e[1]<th) uids.push(e[0]);
          });
          qp.push('userids='+uids.join(','));
          cl('Logging Out Idle Users (<'+th+' mins): '+uids.join('|'));
          cl();
          go(qp);
        });         
      }
    },

    {txt:'Disable Logins', qp:['_func=nologins']},

    {
      txt:'Ping', 
      qp:['_func=ping&uid='+$.uid.toUpperCase()],
      post:function(site,res,next){
        cl(strpad(site.name+' replied ',30)+res);
        next();
      }
    },

    {
      txt:'Timed Events', 
      qp:['_func=get','_sqlid=admin^events'],
      post:function(site,res,next){
        events(site,res,next);
      },
      post_site:function(site,sel,cb){
        const rl = getrl();
        var td = new Date(), dst = [td.getFullYear(),intpad(td.getMonth()+1,2),intpad(td.getDate(),2)].join('-');
        rl.question('Enter Date : ',function(date){
          rl.close();
          $.date = new Date(date).toString().split(' ').slice(1,3).join(' ');
          cb(sel.qp);
        });
        rl.write(dst)
      }
    },
  
    {
      off:true,
      txt:'Event Time Change', 
      qp:['_func=upd','_sqlid=_admin^event'],
      post_site:function(site,sel,cb){
        const rl = getrl();
        getevents(site,function(evts){
          rl.question('Select Event : ',function(id){
            rl.close();
            cl(id);
            cb(sel.qp);
          });
        })     
      }
    },
    
    {txt:'Enable Debugging', qp:['_func=debug']},
    {txt:'Engine Restart', qp:['_func=restart']},

    {
      txt:'Database Utility', 
      qp:[],
      post_site:function(site,sel,cb){
        const rl = getrl();
        var opts = [['SQLITE Query',slquery],['SQLITE Exec',slexec],['MYSQL Query',myquery],['MYSQL Exec',myexec]];
        cl();
        opts.map(function(e,i){cl(strpad(i+1+'.',4)+e[0]);})

        rl.question('\nSelect Type: ', function(idx){
          if(isNaN(idx) || idx > opts.length || idx < 1) rl.close();
          cl('Using: ',opts[idx-1][0]);
          rl.question('Enter SQL: ', function(sql){
            rl.close();
            hisput('dbsql',sql)
            opts[idx-1][1](site,sql,cl);
            cb(sel.qp);
          });
          rl.write(hislast('dbsql'));
        })
      }
    },

    {
      txt:'Data Clone', 
      site_prompt:'Select ONE CLONE-SOURCE Site',
      qp:[],
      post_site:function(site,sel,cb){
        if($.sites.length >1) return cl('Cannot have multiple source sites.')
        var opts = [['Job Clone','CALL PURE_COPYJOB'],['Quality Plan Clone','CALL PURE_COPY_QPPLAN']];
        cl(); opts.map(function(e,i){cl(strpad(i+1+'.',4)+e[0]);})
        const rl = getrl();
        rl.question('\nSelect Type: ', function(idx){
          rl.question('Enter DOC ID: ', function(doc){
            rl.close();
            getsite(function(tgts){
              var tgt = tgts[0];   
              var sql = opts[idx-1][1]+" ('"+site.env.DBSA.name+"','"+tgt.env.DBSA.name+"','"+doc+"');";
              cl('Using SQL: ',sql);
              const rl = getrl();
              var quest = 'YES I am sure';
              rl.question('Are you sure ? ['+quest+'] : ', function(yn){
                rl.close();
                if(yn==quest) {
                  myexec(site,sql,cl);
                }
              })
               
            },'Select CLONE-TARGET Site');
          })
        })
      }
    },

    {
      txt:'Database Move', 
      site_prompt:'Select ONE SOURCE Site',
      qp:[],
      post_site:function(site,sel,cb){
        if($.sites.length >1) return cl('Cannot select multiple sites.')
        const rl = getrl();
        rl.question('\nTarget IP/Host: ', function(tgt){
          
          // get the vwlt site.
          var pure = $.sites[0];
          var sid = pure.env.SITEID;
          
          // check src/tgt (localhost)
          var src = pure.env.DBSA.host; 
          if(src==tgt){
            rl.close();
            cl('Source is same as target');
            process.exit();
          }
          
          var vwlt = {name:''};
          for(var s in $.allsites){
            var site = $.allsites[s];
            if(site.env.SITEID==sid && site.appid=='vwlt'){
              vwlt = site;
              break;      
            }
          }
          
          rl.question('\nMYSQL Root Password: ', function(pwd){
               
            var quest = `YES ${$.uid} is sure`;
            rl.question('\nAre you sure ? ['+quest+'] : ', function(yn){
              cl(`Deleting node processes: ${pure.name}, ${vwlt.name}`)
              rl.close(); 
              if(yn==quest) {
                var db = pure.env.DBSA.name;
                pm2.connect(function(err){
                  if(err) error(err);
                  
                  // Stop Pure Site
                  pm2.delete(pure.name,function(err){     
                    if(err) error(err);
                    
                    // Stop VWLT site
                    pm2.delete(vwlt.name,function(err){  
                      if(err) cl(err); // ignore if vwlt does not exist.
                      
                      // Dump Source Database
                      cl(`Dumping ${db} database ...`);
                      var dfn = `/tmp/${db}_MOVE.sql`; 
                      mydump('root',pwd,db,dfn,function(res){
                        if(res.error) error(res);

                        // Drop & create database & load on tgt
                        cl(`Creating new ${db} database on ${tgt}...`);
                        var cmd = `/usr/bin/mysql -h ${tgt} -u root -p${pwd} -e "CREATE DATABASE ${db}; USE ${db}; SOURCE ${dfn}; COMMIT;"`;
                        exec(cmd,function(res){
                          if(res.error) error(res);
                          
                          // Edit pm2 file
                          cl('Changing host in ${path}...')
                          var path = `${$.__pm2}/json/${pure._filename}`; 
                          var purejs = require(path);
                          purejs.apps.map(function(app){
                            app.env.DBSA.host = tgt;
                            cl(app.env.DBSA);
                          });
                          
                          // Save file with new host
                          cl(`Saving new PM2 file ${path}...`);
                          fs.writeFile(path,JSON.stringify(purejs,null,2),'utf-8',function(err){
                            if(err) error(err);  
                            
                            // Start new process using new host.
                            cl(`Starting new PM2 Processes ...`);
                            pm2.start(path,function(err){
                              if(err) error(err);
                              
                              // Delete dump file.
                              cl(`Deleting dump file ${dfn}...`);
                              exec(`rm-rf ${path}`,function(){
                                cl('Database move DONE.')
                                pm2.disconnect(); 
                              });
                            });
                          });       
                        });
                      })
                    })
                  })
                })
                
              }   //y/n
            })    // sure
          })      // root PWD
        })        //Target IP
        rl.write('puredb')
      }
    },
    
    {
      off:false,
      txt:'System Updates', 
      qp:['_func=put','_sqlid=admin^update','_skips=','host=update.puremfg.net'],
      post_site: function(site,sel,cb){
        if($.sites.length > 1) return cl('One at a time.');
        upfiles(site,sel,function(obj){
          updcols(site,obj.rows,function(){
            const rl = getrl(); 
            cl();
            rl.question('Select file or [q]uit : ', function(idx){

// if($.uid=='PAC') return cl(lists(obj.rows,idx));
               
              if(idx=='q' || isNaN(idx) || idx > obj.rows.length) return rl.close();
              
              var file = obj.rows[idx-1];
              $.sql = file.sql;              
              cl('Updating : '+file.id+' ...');
              sel.qp.push(
                'files[0][id]='+file.id,
                'files[0][path]='+file.path,
                'files[0][lver]='+file.lver,
                'files[0][rver]='+file.rver,
                'files[0][note]='+file.note+' (pure-admin: '+$.uid+')'
              );
              
              rl.question('Are you sure ? [YES] : ', function(yn){
                rl.close();
                if(yn=='YES') cb(sel.qp);
              })
            })
          });
        });
      },
      
      post:function(site,res,next){
        cl(res);
        // only process other sites if it is a sql file.
        if($.sql) next();
        else return;
      }
    },


    {
      txt:'JSON API Request', 
      qp:[],
      post_site:function(site,sel,cb){
        
        const rl = getrl();
        rl.question('\nEnter JSON Data: ', function(json){
          var data;
          try{
            data = JSON.parse(json);
            if(data._sqlid && data._sqlid.indexOf('^') < 0) return error({error:true,msg:`ERROR Bad sqlid: ${data._sqlid}`});
            var url = obj2url(data);
            cl('JSON Data is Valid.');
            rl.question('\nProceed Now ? [YES/NO]: ', function(yn){
              rl.close();
              if(yn!=='YES') process.exit();
              http(`http://localhost:${site.env.PORT}/?${url}`,function(res){
                cl(res);  
              })
            });
          }
          catch(err){
            error({error:true,msg:err})
          }    
        })
      }
    },


  ];
  cl();
  
  opts.map(function(e,i){
    cl(strpad(i+1+'.',4)+e.txt);
  }); cl();
  
  rl.question('Select Function: ', function(idx){
    rl.close();
    if(isNaN(idx) || idx > opts.length) return cl('Invalid selection: '+idx);
    hisput('idx',idx);
    var sel = opts[idx-1];    
    if($.uid != 'PAC' && sel.off) return cl('@@@', 'This function is under development','@@@');
    if(sel.nosite) return sel.nosite();
    
    
    getsite(function(sites){
      $.sites = sites;
      function main(){
        asy.eachSeries(sites,function(site,next){
          
          function go(qp){
            var url = "http://localhost:"+site.env.PORT+"/?_appid=pure-admin&"+qp.join('&');
            //if($.uid=='PAC') cl('@@URL:',url);
            http(url,function(res){
              try {
                var data = JSON.parse(res)
                if(sel.post) sel.post(site,data,next);
                else {
                  cl(data);
                  next();
                }
              }
              catch(e){
                if(sel.post) sel.post(site,res,next);
                else {
                  cl(res);
                  next();
                }
              };
 
            });
          }
          
          if(sel.pre_http) sel.pre_http(site,sel,go); 
          else go(sel.qp);
            
        },function(){
          if(sel.done) sel.done(site,sel);
        });
      }
      
      // select first site.
      if(sel.post_site) sel.post_site(sites[0],sel,main);
      else main();
    
    },sel.site_prompt) //getsite
  }); // select function
  //rl.write(hislast('idx'));
}

$.uid = process.env.UID3;
if($.uid){
  $.uid = $.uid.toUpperCase();
  utils();
} else {
  const rl = getrl(); 
  rl.question(strpad('Enter 3 Letter User ID:',25), function(uid){
    rl.close();
    $.uid = uid.toUpperCase();
    utils();
  });
}
