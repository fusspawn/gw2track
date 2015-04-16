var config  = require("./config.js");
var request = require("request");
var _ = require("async");
var util = require("util");
var api_url = "https://api.guildwars2.com/v2/";
var min_spread = 1;
var Datastore = require('nedb');
var profitdb = new Datastore({ filename: './db/profitdb',
                               autoload: true });

var LAST_SCANNED_ID = 0;
function get_api(extras, callback) {
    request(api_url + extras, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        callback(JSON.parse(body));
      } else {
        callback(null);
      }
    });
}

var scan_item = function(id, callback)
{
   console.log("scanning " + id);
   id = parseInt(id);
   try {
             get_api("/commerce/prices/" + id.toString(), function(data)
             {
                 if(data === null) {
                   callback(null);
                   return;
                 }
                 var is_checking = true;
                 if(is_checking) {
                     var spread = data.sells.unit_price - data.buys.unit_price;
                     if(spread > min_spread) {
                        get_api("/items/" + id, function(idata) {
                              if(idata === null)  { callback(null); return; }
                              profitdb.update({ id: id}, {id: id,
                                               name: idata.name,
                                               spread: spread,
                                               indexedat: new Date(),
                                               buy: data.buys.unit_price,
                                               sell: data.sells.unit_price,
                                               icon: idata.icon}, { upsert: true }, function () {
                                   LAST_SCANNED_ID = id;
                                   console.log("scanned: " + id);
                                   callback({id: id,
                                               name: idata.name,
                                               spread: spread,
                                               indexedat: new Date(),
                                               buy: data.buys.unit_price,
                                               sell: data.sells.unit_price,
                                               icon: idata.icon});
                              });
                        });
                     } else {
                              callback(null);
                     }
                 } else {
                     callback(null);
                 }
             });
           } catch(e) { callback(null); }
}

var run = function(run_cb)
{
     console.log("aquiring all items");
     get_api("/items", function(ids) {
         if(ids === null) {
           run_cb();
         }
         console.log("aquired: " + ids.length + " ids");
         _.eachLimit(ids, 100, function(id, callback)
         {
           try {
             get_api("/commerce/prices/" + id.toString(), function(data)
             {
                 if(data === null) {
                   callback(null);
                   return;
                 }
                 var is_checking = (data.buys.quantity > 1
                                    && data.sells.quantity > 1);
                 if(is_checking) {
                     var spread = data.sells.unit_price - data.buys.unit_price;
                     if(spread > min_spread) {
                        get_api("/items/" + id, function(idata) {
                              if(idata === null)  { callback(null); return; }
                              profitdb.update({ id: id}, {id: id,
                                               name: idata.name,
                                               spread: spread,
                                               indexedat: new Date(),
                                               buy: data.buys.unit_price,
                                               sell: data.sells.unit_price,
                                               icon: idata.icon}, { upsert: true }, function () {
                                   LAST_SCANNED_ID = id;
                                   callback();
                              });
                        });
                     } else {
                              callback(null);
                     }
                 } else {
                     callback(null);
                 }
             });
           } catch(e) { callback(null); }
         }, function(err) {
             if(err === null)
               console.log("Something went wrong?!");
             else {
               run_cb();
             }
         });
  });
}

run(function() {

});

setInterval(function() {
  run(function() {
  });
}, 1000 * 60 * 60);

var express = require('express');
var app = express();
var ejs = require("ejs"), moment = require('moment');

app.set('views', './views')
app.set('view engine', 'ejs');
app.get('/', function(req, res) {
   profitdb.find({}).sort({spread: -1}).limit(100).exec(function(err, docs) {
     if(err)
       res.send(error);
     else
       res.render("index", {table: docs, lastid: LAST_SCANNED_ID, moment: moment});
   });
});

app.get("/custom/:gold", function(req, res) {
    console.log(req.params.gold);
    profitdb.find({"buy": {$lt: parseInt(req.params.gold)}}).sort({spread: -1}).limit(50).exec(function(err, docs) {
        if(err)
          throw err;
        else {
          res.render("index", {table: docs, lastid: LAST_SCANNED_ID, moment: moment});
        }
    });
});

app.get("/scan/:id", function(req, res) {
    scan_item(req.params.id, function(resp) {
        if(resp === null)
          res.send(JSON.stringify({error: "something went wrong.."}));
        else
          res.send(JSON.stringify(resp));
    });
})

app.listen(config.port);
console.log("server running on port " + config.port);
