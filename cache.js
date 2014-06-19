/**
 * Created by kazaff on 2014/6/9.
 */
"use strict";

var Async = require("async");
var Config = require("./config");
var Redis = require("redis");

function run(callback){
    var Client = Redis.createClient(Config.cache.port, Config.cache.host);
    Client.on("error", function(err){
        callback(err);
    });
    Client.auth(Config.cache.auth);

    var delCount = 0;

    Async.waterfall([
        function(cb){
            Client.keys(Config.cache.key, function(err, keys){

                delCount = keys.length;
                cb(null, keys);
            });
        }
        , function(keys, cb){
            if(keys.length){
                Client.del(keys, function(err, total){
                    cb(null, total);
                });

            }else{
                cb(null, 0);
            }
            
        }
    ], function(err, total){

        Client.quit();

        if(delCount != total){
            return callback({error: 500, message: "some cache data was not be cleaned("+ total + "/" + delCount +")"});
        }

        callback();
    });
}

module.exports = {
    clean: run
};