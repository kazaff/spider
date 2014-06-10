/**
 * Created by kazaff on 2014/6/6.
 */
"use strict";

//读取配置文件
var Config = require("./config");
var Worker = require("./workers");
var Async = require("async");

function inArray(item, collection){
    var i = collection.length;
    while(i--){
        if(item == collection[i]){
            return true;
        }
    }

    return false;
}

function creep(callback){
    //初始化数据：层级，无效请求集合，有效请求集合，当前目标集合
    var exceptionUrls = [],
        historyUrls = [],
        targetUrls = [Config.startUrl],
        level = Config.maxLevel;

    Async.whilst(function(){
        return level > 0;
    }, function(cb){
        level--;

        console.log("===================debug: " + level);  //TODO 测试用

        //调用workers执行业务逻辑
        Worker.start(targetUrls, function(err, results){

            //分拣结果，筛选出成功的和失败的，分别存入historyUrls和exceptionUrls
            for(var i = 0, max = results.exceptionUrls.length; i < max; i++){
                exceptionUrls.push(results.exceptionUrls[i]);
            }

            var errUrls = [];
            var index = results.exceptionUrls.length;
            while(index--){
                errUrls.push(results.exceptionUrls[index].url);
            }
            for(var i = 0, max = targetUrls.length; i < max; i++){
                if(!inArray(targetUrls[i], errUrls)){
                    historyUrls.push(targetUrls[i]);
                }
            }

            targetUrls = [];    //为下一次迭代初始化目标链接集合
            //注意从historyUrls中过滤出重复的，避免重复请求，例如首页链接可能出现在任何一个页面
            for(var i = 0, max = results.collections.length; i < max; i++){
                if(!inArray(results.collections[i], historyUrls) && !inArray(results.collections[i], errUrls)){
                    targetUrls.push(results.collections[i]);
                }
            }

            console.log(exceptionUrls);   //TODO 测试用
            console.log(historyUrls);   //TODO 测试用
            console.log(targetUrls);   //TODO 测试用

            cb();
        });
    }, function(err){
        callback(err, exceptionUrls);
    });
}

//返回需要等到执行的毫秒数
function timer(){
    var currentDate = new Date();
    var currentHour =  currentDate.getHours();
    var currentSeconds = currentDate.getSeconds();

    var totalSeconds = 0;

    if(currentHour > 2){    //当前小时数如果晚于凌晨两点，则需要等到第二天凌晨两点
        totalSeconds = ((24 - currentHour + 2) * 60 * 60) - currentSeconds;
    }else{  //若当前时间早于凌晨两点，则等到当前的两点
        totalSeconds = ((2 - currentHour) * 60 * 60) - currentSeconds;
    }

    //return totalSeconds * 1000; //返回毫秒数
    return 0;   //TODO 测试用
}

//入口函数
function main(){
    var startTime = (new Date()).getTime();

    //清理redis缓存
    if(Config.cache && 0){ //TODO 测试用
        require("./cache").clean(function(err){
            if(err){
                //缓存清理存在问题
                restart(err);
            }else{
                creep(restart);
            }
        });
    }else{
        creep(restart);
    }

    //所有任务最终完成后的回调
    function restart(err, exceptionUrls){

        //TODO 如果有任何异常，则发送邮件给管理员
        if((err || exceptionUrls.length) && Config.mail){

        }

        //日志
        console.log("-----------------");
        console.log("总耗时：" + ((new Date()).getTime() - startTime) + "毫秒");
        console.log("异常链接：");
        var index = exceptionUrls.length;
        while(index--){
            console.log("       url：" + exceptionUrls[index].url);
            console.log("       status：" + exceptionUrls[index].statusCode);
            console.log("       err：" + exceptionUrls[index].err);
            console.log("       ================");
        }
        console.log("-----------------");

        //重置任务
        //setTimeout(main, timer());    //TODO
    }
}

//设置定时
setTimeout(main, timer());






