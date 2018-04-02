#!/usr/bin/env node

var readline = require('readline');
var fs = require('fs');
var cl = console.log;
var json = JSON.parse(fs.readFileSync(__dirname+'/myslow.json','utf-8'));
var uid = process.env.UID3.toUpperCase();
//cl(uid);
/*
  
## SLOWLOGS
0 8 * * 1               /usr/share/nodejs/utils/myslow.js save
0 12 * * 1,2,3,4,5      /usr/share/nodejs/utils/myslow.js save
0 17 * * 1,2,3,4,5      /usr/share/nodejs/utils/myslow.js save  
  
*/

// var def = [['TIME',9],['SITE',8],['FRQ',3], ['UNITS',6],['EVENT ID',50]];
function dohead(def){var tit=[],ul=[];def.map(function(e){
  tit.push(strpad(e[0],e[1]));ul.push(strpad('=',e[1],'='))});
  process.stdout.write(ul.join(' ')+"\n");
  process.stdout.write(style(tit.join(' '),'fg_blu')+"\n");
  process.stdout.write(ul.join(' ')+"\n");
}

function dorow(def,row,sty){var r=[];row.map(function(col,idx){
  r.push(strpad(col,def[idx][1]))});
  if(sty) process.stdout.write(style(r.join(' '),sty)+"\n");
  else process.stdout.write(r.join(' ')+"\n");
}

function sdate(date){
  if(!date) return '';
  var d = new Date(date);
  var sd = [d.getYear()-100,intpad(d.getMonth()+1,2),intpad(d.getDate(),2)].join('');
  sd+=' '+[intpad(d.getHours(),2),intpad(d.getMinutes(),2),intpad(d.getSeconds(),2)].join(':');
  return sd; 
}

function intpad(n){if(n<10) return "0"+n; return n.toString()}
function strpad(str,len,chr){if(str===null||str===undefined) str='';str = str.toString();chr = chr || ' ';if(str.length > len) return str.substr(0,len-3)+'...';return str += new Array(len-str.length+1).join(chr);}

function style(str,sty,noclr){
  var cols={res: "\x1b[0m",bright : "\x1b[1m",dim : "\x1b[2m",ul : "\x1b[4m",blink : "\x1b[5m",reverse : "\x1b[7m",hide : "\x1b[8m",fg_blk : "\x1b[30m",fg_red : "\x1b[31m",fg_grn : "\x1b[32m",fg_yel : "\x1b[33m",fg_blu : "\x1b[34m",fg_pur : "\x1b[35m",fg_cyn : "\x1b[36m",fg_wht : "\x1b[37m",bg_blk : "\x1b[40m",bg_red : "\x1b[41m",bg_grn : "\x1b[42m",bg_yel : "\x1b[43m",bg_blu : "\x1b[44m",bg_pur : "\x1b[45m",bg_cyn : "\x1b[46m",bg_wht : "\x1b[47m"};
  str = cols[sty]+str;
  if(!noclr) str+=cols['res'];
  return str;
}

send = function(sub,html, cb) {
  var nodemailer = require('nodemailer');
  var transport = nodemailer.createTransport('SMTP',{
    'host': 'echo.dis.com.sg',
    'secureConnection':   false,
    'port': 25,
    'tls': {'rejectUnauthorized': false}
  });

  var mailOptions = {
    from: 'noreply@dis.com.sg',
    to: 'pac@dis.com.sg',
    subject: sub || 'Slow Log Stats.',
    html: html
  };

  transport.sendMail(mailOptions, function(err, info){
    transport.close();
    if(err && cb) cb(err, info);
    else if(cb) cb(null, info);
  });
}

function loctime(x){
  x.setHours(x.getHours() - x.getTimezoneOffset() / 60);
  return x;
}

function parse(last){
  
  /*
    # Time: 180326  8:15:11
    # User@Host: root[root] @ localhost [127.0.0.1]
    # Thread_id: 44  Schema: WLHTEST  QC_hit: No
    # Query_time: 1382.585184  Lock_time: 0.000526  Rows_sent: 66413  Rows_examined: 132436
    # Rows_affected: 0
    use WLHTEST;
    SET timestamp=1522023311;
    select * from JOB_OPN;
  */

  //cl(last);
  var path = "/var/log/mysql/mariadb-slow.log";
  var rows=[], data= {}, row, idx=0;
  var unique = true;
  var logs = fs.readFileSync(path,'utf-8').split(/\n/);
  logs.push('# Time: 000000  0:00:00\n'); // Dummy Row.
  
  logs.map(function(line,idx){
    if(!line) return;
    line = line.trim();
    
    if(line.indexOf('#')==0){
      line=line.replace('# ','');
      
      // Line #1
      if(line.indexOf('Time:')==0) {
        if(row) {
          
          // Query strings
          row.Key = row.Query.join('')
            .replace(/use OMS[^;]+/g,'OMS??')
            .replace(/OMS[^;]+;/g,'')
            .replace(/''/g,'"?"')
            .replace(/\d+/g, 0)
            .replace(/'[^']+'/g,'"?"')
            .replace(/SET timestamp=0;/g,'')
          
          if(!(row.Key in data)) data[row.Key] = [];
          data[row.Key].push(row);
          rows.push(row);
        }
        
        // Query time
        var ts=line.slice(6);
        if(line.indexOf('000000')==0) return;
        var date = new Date([20+ts.slice(0,2),ts.slice(2,4),ts.slice(4,6)].join('/')+ts.slice(6))
        
        // don't repeat-process the same data
        if(unique && date <= last) row = null;
        else row = {Query:[],Time: date};
      }
      
      // Line #3
      if(row && line.indexOf('Thread_id:')==0) {
        var bits = line.replace(/  /g,' ').split(' ');
        row.Schema = bits[3];
        row.QC_hit = bits[5][0];
      }
      
      // Line #4
      if(row && line.indexOf('Query_time:')==0) {
        var bits = line.split(/  /);
        bits.map(function(col){
          var bobs = col.trim().split(/ *: */);
          row[bobs[0].trim()]=parseFloat(bobs[1].trim());
        })
      }
      
      // Line #5
      if(row && line.indexOf('Rows_affected:')==0) row.Rows_affected = line.split(/ *: */)[1];
    }
    
    else {
      if(row && row.Rows_affected) row.Query.push(line);
    }
  })
  
  return {data:data,rows:rows};
}


function tail(){
  var def = [['STAMP',9],['DBASE',6],['SECS',5],['/HR',4],['LOCKED',7], ['EXAMIN',7],['SENT',6],['QC',3],['SQL QUERY (PARSED)',50]];
  cl();
  dohead(def);
  
  var qt_tot=0,count=0,first, last=new Date();
  setInterval(function(){
    var rows = parse(last).rows;
    rows.map(function(row){
      if(count > 0 && count % 35 ==0) dohead(def);
      if(row.Time) {
        var ts = new Date(row.Time) 
        if(!first) first = ts;
        last = ts;
        var runsec = (last.getTime()-first.getTime())/1000;
        var runmin = runsec / 60;
        var runhr = runmin / 60;
        qt_tot += row.Query_time;
        
        if(first==last) var qt_hr = '-';
        else qt_hr = (qt_tot/runhr).toFixed(2);
        
        //if(uid=='PAC') cl(first,last,runsec,runmin,runhr,qt_tot,qt_hr);
        var sty; if(parseInt(row.Query_time)>2) sty = 'fg_red';
        
        dorow(def,[
          sdate(row.Time).split(' ')[1],
          row.Schema,
          row.Query_time.toFixed(2),
          qt_hr,
          row.Lock_time.toFixed(4),
          row.Rows_examined,
          row.Rows_sent,
          row.QC_hit,
          row.Key
        ],sty);

      }
      count++
    })
  },5000)
}

function go(){

  var last = new Date(json.last);
  var data = parse(last).data;
  
  var odata = {
    
    /* LOG STATS */
    run_time        : new Date(),
    first_log       : -1,
    last_log        : -1,
    log_runmin      : 0,
    
    max_lock_sec    : 0,
    tot_slow_sec    : 0,
    slow_percent    : 0,
    tot_loc_sec     : 0,    
    tot_queries     : 0,
    slow_qry_hr     : 0,    
    
    /* DETAILS */
    qry_strings    : [],

    max_run        : {
                      qry   :'',
                      secs  : 0,
                      db    :'',
                    },
    
    max_rows       : {
                      qry   : '',
                      rows  : 0,
                      db    : '',
                    },
    
    most_freq      : {
                      qry   : '',
                      count :0
                    } ,
    
  };
  
  for(var key in data){
    
    // query strings
    odata.qry_strings.push([key,data[key].length]);
    
    if(data[key].length > odata.most_freq.count) {
      odata.most_freq.qry = key;
      odata.most_freq.count = data[key].length;
    }
    
    data[key].map(function(qry){
      
      // max_run
      var qt = parseFloat(qry.Query_time); 
      if(qt > odata.max_run.secs) {
        odata.max_run.secs = qt;
        odata.max_run.qry = key;
        odata.max_run.db = qry.Schema
        
      }

      // total slow seconds
      odata.tot_slow_sec += qt;
      
      // max_rows
      var re = parseInt(qry.Rows_examined); 
      if(re > odata.max_rows.rows) {
        odata.max_rows.rows = re;
        odata.max_rows.qry = key;
        odata.max_rows.db = qry.Schema
      }
      
      // lock time
      var lt = parseFloat(qry.Lock_time);
      if(lt > odata.max_lock_sec) odata.max_lock_sec = lt;
      odata.tot_loc_sec += lt; 
      
      // log start / end
      odata.tot_queries ++;
      if(odata.first_log == -1 || qry.Time < odata.first_log) odata.first_log = qry.Time;
      if(odata.last_log == -1 || qry.Time > odata.last_log) odata.last_log = qry.Time;
    }); 
  }
  
  // run times
  odata.log_runmin = parseInt((odata.last_log - odata.first_log)/60000); 
  odata.slow_qry_hr = parseInt(odata.tot_queries / (odata.log_runmin/60));
  
  odata.slow_percent = ((odata.tot_slow_sec/(odata.log_runmin*60)) * 100).toFixed(2);  
  
  cl(odata);
  if(process.argv[2] && process.argv[2]=='save'){
    var sub = [
      'Slow Data',
      'Slow: '+odata.slow_percent+'%',
      'Qry: '+odata.tot_queries,
      'Hour: '+odata.slow_qry_hr,
      'Secs: '+parseInt(odata.max_run.secs),
      'Rows: '+odata.max_rows.rows
    ].join('  ');

    send(sub,'<pre>'+JSON.stringify(odata,null,2)+'</pre>');
    json.data.push(odata);
    json.last = odata.run_time;
    fs.writeFileSync(__dirname+'/myslow.json',JSON.stringify(json,null,2),'utf-8');
  }
}


if(process.argv[2] && process.argv[2]=='tail') tail();
else go();

/*
  /usr/bin/mysqld, Version: 10.1.23-MariaDB (MariaDB Server). started with:
Tcp port: 3306  Unix socket: /run/mysqld/mysqld.sock
Time                 Id Command    Argument

# Time: 180326  8:15:11
# User@Host: root[root] @ localhost [127.0.0.1]
# Thread_id: 44  Schema: WLHTEST  QC_hit: No
# Query_time: 1382.585184  Lock_time: 0.000526  Rows_sent: 66413  Rows_examined: 132436
# Rows_affected: 0
use WLHTEST;
SET timestamp=1522023311;
select * from JOB_OPN;

# Time: 180326  8:23:00
# User@Host: root[root] @ localhost [127.0.0.1]
# Thread_id: 47  Schema: OMSSGTEST  QC_hit: No
# Query_time: 23.848487  Lock_time: 0.000419  Rows_sent: 1000  Rows_examined: 2602
# Rows_affected: 0
use OMSSGTEST;
SET timestamp=1522023780;
select * from JOB_OPN_WLH limit 0,1000;

# Time: 180326  8:45:00
# User@Host: root[root] @ localhost [127.0.0.1]
# Thread_id: 47  Schema: OMSSGTEST  QC_hit: No
# Query_time: 11.112
*/