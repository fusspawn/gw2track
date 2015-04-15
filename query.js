var Datastore = require('nedb');
var profitdb = new Datastore({ filename: './db/profitdb',
                               autoload: true });
var util = require("util");

profitdb.find({"buy": {$lt: 9530}}).sort({spread: -1}).limit(50).exec(function(err, docs) {
    if(err)
      throw err;
    else {
      console.log(util.inspect(docs));
    }
});