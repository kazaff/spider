/**
 * Created by kazaff on 2014/6/4.
 */
"use strict";

var Async = require("async");
var Config = require("./config");
var Request = require("request");
var Htmlparser = require("htmlparser2");
var Url = require("url");

var queue = Async.queue(function(task, callback){

    //请求->响应
    var options = {
        url: Config.domain + task.target
        , headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/34.0.1847.116 Safari/537.36"
        }
        , method: "GET"
        , maxRedirects: 2
        , timeout: Config.timeout * 1000
    };

    //出错后的重试
    var errTimes = Config.retry;
    Async.whilst(function(){
        return errTimes > 0;
    }, function(cb){
        Request(options, function(error, response, body){
            //无响应后的重试，包括异常，响应状态不等于200
            if(error || response.statusCode != 200){
                errTimes--;

                //如果重试过指定次数后依然无法得到正常结果，则放弃该目标地址
                if(errTimes <= 0){
                    callback({
                        url: task.target
                        , err: error
                        , statusCode: response ? response.statusCode : 0
                    });
                }
                return cb();
            }

            errTimes = -1;

            //抽取url的规则
            var urls = [];
            var parser = new Htmlparser.Parser({
                onopentag: function(name, attribs){
                    if(name === "a" && attribs.href){
                        //href又分：相对路径，绝对路径，还要去掉跨域链接，javascript脚本，锚点链接等
                        var urlData = Url.parse(attribs.href);
                        if((urlData.protocol == null && urlData.hash == null)
                            || ((urlData.protocol == "http:" || urlData.protocol == "https:") && urlData.host == Url.parse(Config.domain).host)){  //只留下

                            if(urls.indexOf(urlData.path) === -1){  //去掉目标集合中的重复项
                                urls.push(urlData.path);
                            }
                        }
                    }
                }
                , onend: function(){
                    callback(null, urls);
                    cb();
                }
            });

            parser.write(body);
            parser.end();
        });
    }, function(err){
        if(err){
            //所有任务最终完成后的回调
            callback({
                url: task.target
                , err: err
                , statusCode: 0
            });
        }
    });

}, Config.concurrency/*例如队列消费者数目限制请求并发数*/);


//迭代逻辑
function run(data, callback){

    var collections = [];
    var errorUrls = [];     //返回错误的url

    if(data.length){
        //把每个目标url以任务的方式添加到队列
        data.forEach(function(url){
            queue.push({target: url}, function(err, urls){
                //错误处理，针对某些目标地址返回异常，记录在errorUrls变量中
                if(err){
                    errorUrls.push(err);
                }else{
                    //把分析得到的新连接添加到集合
                    for(var i = 0, max = urls.length; i < max; i++){
                        collections.push(urls[i]);
                    }
                }
            });
        });

        //所有任务完成后触发
        queue.drain = function(){
            callback(null, {collections: collections, exceptionUrls: errorUrls});
        };

    }else{
        callback(null, {collections: [], exceptionUrls: []});
    }

}

module.exports = {
    start: run
};
