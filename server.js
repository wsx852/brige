//https://www.jianshu.com/p/2c87708dca05

'use strict';

const express = require('express');
const SocketServer = require('ws').Server;

const path = require('path');
const PORT = process.env.PORT || 31;
const INDEX = path.join(__dirname, 'index.html');
const server = express()
    .use((req, res) => res.sendFile(INDEX) )
    .listen(PORT, () => console.log(`Listening on ${ PORT }`));


// 本地資料庫
// var mysql = require('mysql');
// var connection = mysql.createConnection({
//     host     : 'ec2-34-224-229-81.compute-1.amazonaws.com',//'127.0.0.1',
//     username : 'bbolkeeemcikue',//'jasonchen',
//     password : '40cb0170c8467c99536c4dfc6303a5e4ca10c7389a40d92b3e3012e6da363367',//'12341234',
//     database : 'd1mn5960l6o8og'//'cards'
// });

// heroku資料庫
// const { Client } = require('pg');
// const database = new Client({
//     connectionString: process.env.DATABASE_URL,
//     ssl: {
//         rejectUnauthorized: false
//     }
// });

var wsuserdic = {};// socket使用者
var loginusers = [];// 登入的使用者 
var callsuits = [];// 喊的花色
var accumulationcallsuits = [];// 喊的花色加墩數
var callsuitnum = 1;// 喊到墩數
var putcards = [];// 出的牌
var winnum = [0, 0];// 贏的墩數

const wss = new SocketServer({ server });
wss.on('connection', (ws, req) => {
    console.log("connect success~");
    console.log("");
    console.log("url: " + req.url);
    
    var parts = req.url.split("?")[1].split("&");
    console.log("url parts: " + parts);
    var length = parts.length;
    var userId = "";

    for (var index = 0; index < length; index++) {
        var strarr = parts[index].split("=");
        if (strarr[0] == "userId") {
            wsuserdic[strarr[1]] = ws;
            console.log("");
            console.log("USER: " + strarr[1] + "已連接");
            userId = strarr[1];
            // updatedb(`UPDATE room SET player`+ userId + "=" + userId + ` WHERE id=1`);
            loginusers.push([userId]);
            break;
        }
    }
    // database.connect();

    ws.send("connect success~");
    // 接收消息
    ws.on('message', (message) => {
        console.log("");
        console.log("------------------------------------------分隔線---------------------");
        console.log(userId + "發送訊息: " + message);

        // if (message == "clear") {
        //     updatedb(`UPDATE room SET player1=null WHERE id=1`);
        //     updatedb(`UPDATE room SET player2=null WHERE id=1`);
        //     updatedb(`UPDATE room SET player3=null WHERE id=1`);
        //     updatedb(`UPDATE room SET player4=null WHERE id=1`);
        //     return;
        // }

        if (message == "心跳") {
            return;
        }

        if (message == "發牌") {
            console.log("發牌");
            callsuits = [];
            accumulationcallsuits = [];
            callsuitnum = 1;
            putcards = [];
            winnum = [0, 0];
            console.log("現在人數:" + loginusers);
            if (loginusers.length < 4) {
                distribute("1^" + "connect success, 但人數只有:" + loginusers);
                return;
            }
            // selectdb(`SELECT * FROM room`, (roomdic) => {
            //     console.log("room:" + roomdic);
            //     let players = JSON.parse(roomdic);
            //     let p1 = players.player1;
            //     let p2 = players.player2;
            //     let p3 = players.player3;
            //     let p4 = players.player4;
            //     if (p1 != null && p2 != null && p3 != null && p4 != null) {
                    var cards = getcards();
                    // 存資料庫 發13張
                    distribute("1^" + cards[0]);
                    distribute("2^" + cards[1]);
                    distribute("3^" + cards[2]);
                    distribute("4^" + cards[3]);
                    origincallsuit();
            //     }
            // });
            return;
        }

        if (message.substr(0, 1) == "喊") {
            callsuits.push(userId + message);
            if (callsuits.length == 1) {
                accumulationcallsuits.push(userId + "喊1" + message.substr(1));
                wss.clients.forEach((client) => {
                    client.send(accumulationcallsuits + "| ");
                });    
            } else {
                let callnum = getcallnum(callsuits);
                if (callnum == 2) {
                    // console.log("acc: " + accumulationcallsuits);
                    wss.clients.forEach((client) => {
                        client.send("喊到王牌: " + accumulationcallsuits[accumulationcallsuits.length - 3]);
                        client.send("不能叫牌");
                        client.send(accumulationcallsuits + ", " + userId + "喊" + callsuitnum + "pass | ");
                    });
                    let calluser = accumulationcallsuits[accumulationcallsuits.length - 3].substr(0, 1);
                    console.log("喊到的人" + calluser);
                    if ((calluser - 1) <= 0) {
                        nextputcard(4);
                    } else {
                        nextputcard(calluser - 1);
                    }
                    return;
                } else {
                    callsuitnum = callsuitnum + callnum;
                    accumulationcallsuits.push(userId + "喊" + callsuitnum + message.substr(1));
                    wss.clients.forEach((client) => {
                        client.send(accumulationcallsuits + " | ");
                    });                            
                }
            }
            nextcallsuit(userId);
            
            // if (message.substr(1) != "pass") {
            //     updatedb(`UPDATE kingsuit SET suit='` + message.substr(1) + `' WHERE id=1`);
            // }
            return;
        }

        if (message.substr(0, 1) == "出") {
            putcards.push(userId + "出" + message.substr(1));
            console.log("陣列數量:" + putcards.length + ":" + putcards);
            wss.clients.forEach((client) => {
                client.send("" + putcards + "");
            });
            if (Number(putcards.length) == Number(4)) {
                console.log("clear~~~~~king:" + accumulationcallsuits[accumulationcallsuits.length - 3].substr(3));
                let winuser = whowin(putcards, accumulationcallsuits[accumulationcallsuits.length - 3].substr(3));
                if (winuser == 1 || winuser == 3) {
                    winnum[0] = winnum[0] + 1;
                    wss.clients.forEach((client) => {
                        client.send("1和3累積墩數: " + winnum[0]);
                    });
                    if (checkwiner(winnum[0], 1) == "win") {
                        wss.clients.forEach((client) => {
                            client.send("1和3贏了");
                        });
                    }
                } else {
                    winnum[1] = winnum[1] + 1;
                    wss.clients.forEach((client) => {
                        client.send("2和4累積墩數: " + winnum[1]);
                    });
                    if (checkwiner(winnum[1], 2) == "win") {
                        wss.clients.forEach((client) => {
                            client.send("2和4贏了");
                        });
                    }
                }
                nextputcard(winuser);
                putcards = [];
                return;
            }
            if (userId == 4) {
                nextputcard(1);
            } else {
                nextputcard(Number(userId) + Number(1));
            }
            console.log("看看" + message.substr(1));
            return;
        }
        
        sendeverybody(userId, message);

        // 發送消息
        // ws.send(message);
    });
});

function origincallsuit() {
    var users = [1, 2, 3, 4];
    let random = getRandom(3);
    distribute(users[random] + "^能叫牌"); 
    users.splice(random, 1);
    for (var i = 0; i < users.length; i++) {
        distribute(users[i] + "^不能叫牌");
    }
}

function nextcallsuit(userId) {
    console.log("next call~~~~");
    switch (Number(userId)) {
        case 1:
            let users1 = [2, 1, 3, 4];
            callsuit(users1);
            break;
        case 2:
            let users2 = [3, 1, 2, 4];
            callsuit(users2);
            break;
        case 3:
            let users3 = [4, 1, 2, 3];
            callsuit(users3);
            break;
        case 4:
            let users4 = [1, 2, 3, 4];
            callsuit(users4);
            break;
    }
}

function callsuit(users) {
    // console.log("next: " + users)
    distribute(users[0] + "^能叫牌"); 
    for (var i = 1; i < users.length; i++) {
        distribute(users[i] + "^不能叫牌");
    }
}

function nextputcard(userId) {
    console.log("next put~~~~" + userId);
    switch (Number(userId)) {
        case 1:
            let users1 = [1, 2, 3, 4];
            putcard(users1);
            break;
        case 2:
            let users2 = [2, 3, 1, 4];
            putcard(users2);
            break;
        case 3:
            let users3 = [3, 4, 1, 2];
            putcard(users3);
            break;
        case 4:
            let users4 = [4, 1, 2, 3];
            putcard(users4);
            break;
    }
}

function putcard(users) {
    console.log("next put: " + users)
    distribute(users[0] + "^能亮牌"); 
    for (var i = 1; i < users.length; i++) {
        distribute(users[i] + "^不能亮牌");
    }
}

function whowin(cards, king) {
    var kingcards = [];//有王牌的
    var kingusers = [];//比大小用的
    if (king == "noking") {
        return nokingcards(cards);
    } else {
        cards.forEach(card => {
            if ((card.substr(2, 1)) == king) {
                kingcards.push(card);
            }
        });
        console.log("kinguserarr: " + kingcards);
        if (kingcards.length == 0) {
            return nokingcards(cards);
        } else {
            var winuser;
            kingcards.forEach(kinguser => {
                if (Number(kinguser.substr(3)) == 1) {
                    winuser = kinguser.substr(0, 1);
                    console.log("whowin1: " + kinguser + ", user: " + winuser);
                } else {
                    kingusers.push(Number(kinguser.substr(3)));
                    console.log("whowin2: " + kingusers + " , type:" + typeof(kingusers));
                }
            });
            if (winuser == undefined) {
                let sortuser = kingusers.sort(function(a, b) {
                    return b - a;
                });
                console.log("sort1: " + sortuser);
                console.log("sort2: " + sortuser[0]);                
                kingcards.forEach(kinguser => {
                    if (sortuser[0] == Number(kinguser.substr(3))) {
                        winuser = kinguser.substr(0, 1);
                    }
                });    
            }
            return winuser;    
        }
    }
}

function nokingcards(cards) {
    console.log("noking: " + cards);
    console.log("noking first: " + cards[0]);
    var suits = [];
    var newcards = [];
    var winuser;
    cards.forEach(card => {
        if ((card.substr(2, 1)) == cards[0].substr(2, 1)) {
            if (card.substr(3) == 1) {
                winuser = card.substr(0, 1);
            }
            suits.push(card.substr(3));
            newcards.push(card);
        }
    });
    console.log("suits: " + suits);
    if (winuser == undefined) {
        let sortsuit = suits.sort(function(a, b) {
            return b - a;
        });
        console.log("sortsiut: " + sortsuit);
        newcards.forEach(card => {
            if (sortsuit[0] == card.substr(3)) {
                winuser = card.substr(0, 1);
            }
        });        
    }
    console.log("winuser: " + winuser);
    return winuser;
}

function checkwiner(winnum, winuser) {
    console.log("喊到噸數:" + callsuitnum);
    console.log("贏到次數:" + winnum);
    
    let calluser = accumulationcallsuits[accumulationcallsuits.length - 3].substr(0, 1);//喊到的人
    let winusercamp = winuser % 2;
    let callusercamp = calluser % 2;
    
    if (winusercamp == callusercamp) {
        if (callsuitnum == 1 && winnum == 7) {
            return "win";
        } else if (callsuitnum == 2 && winnum == 8) {
            return "win";
        } else if (callsuitnum == 3 && winnum == 9) {
            return "win";
        } else if (callsuitnum == 4 && winnum == 10) {
            return "win";
        } else if (callsuitnum == 5 && winnum == 11) {
            return "win";
        } else if (callsuitnum == 6 && winnum == 12) {
            return "win";
        } else if (callsuitnum == 7 && winnum == 13) {
            return "win";
        } else {
            return "";
        }
    } else {
        if (callsuitnum == 1 && winnum == 7) {
            return "win";
        } else if (callsuitnum == 2 && winnum == 6) {
            return "win";
        } else if (callsuitnum == 3 && winnum == 5) {
            return "win";
        } else if (callsuitnum == 4 && winnum == 4) {
            return "win";
        } else if (callsuitnum == 5 && winnum == 3) {
            return "win";
        } else if (callsuitnum == 6 && winnum == 2) {
            return "win";
        } else if (callsuitnum == 7 && winnum == 1) {
            return "win";
        } else {
            return "";
        }
    }
}

function getcallnum(suits) {
    console.log("get callsuits:" + suits);
    let previou = changestring(suits[suits.length - 2].substr(2));
    if (previou == 0) {
        previou = changestring(suits[suits.length - 3].substr(2));
        if (previou == 0 && suits[suits.length - 1].substr(2) == "pass") {
            return 2;// 連續三pass
        }
    }
    if (previou == 0) {
        previou = changestring(suits[suits.length - 4].substr(2));
    }
    let final = changestring(suits[suits.length - 1].substr(2));
    console.log("final", final);
    if (final == 0 || final >= previou) {
        return 0;
    } else {
        return 1;
    }
}

function changestring(call) {
    if (call == "noking") {
        return 5;
    } else if (call == "桃") {
        return 4;
    } else if (call == "心") {
        return 3;
    } else if (call == "方") {
        return 2;
    } else if (call == "梅") {
        return 1;
    } else {
        return 0;
    }
}

function sendeverybody(userId, message) {
    if(message.indexOf("^") == -1) {
        console.log("給所有人");
        wss.clients.forEach((client) => {
            client.send(userId + ": " + message);
        });
        // for(var userdicId in wsuserdic) {
        //     wsuserdic[userId].send(sendmessage);
        // }
    }
}

function updatedb(query) {
    console.log("update query: " + query);
    database
    .query(query)
    .then(result => {
        console.log("update success");
    })
    .catch(err => {
        console.log("update error: " + err);
        throw err;
    });
}

function selectdb(query, callback) {
    console.log("select query: " + query);
    database
    .query(query, (err, res) => {
        if (err) {
            console.log("select error: " + err);
        } else {
            var dic;
            for (let row of res.rows) {
                dic = JSON.stringify(row, ["player1", "player2", "player3", "player4"]);
            }
            callback(dic);
        }
    });
}

function distribute(message) {
    let towsarr = message.split("^")[0].split("#");
    let newmessage = message.split("^")[1];
    console.log("指定給: " + towsarr + ", 訊息: " + newmessage);
    towsarr.map(function(userId, i) {
    //找出userId的client
        for(var userdic in wsuserdic) {
            if(userdic == userId) {
                // console.log("dic: " + userdic);
                wsuserdic[userdic].send(newmessage);
                console.log("發牌: " + message);
            }
        }
    })
}

function getcards() {
    var cards = [
    "梅1", "梅2", "梅3", "梅4", "梅5", "梅6", "梅7", "梅8", "梅9", "梅10", "梅11", "梅12", "梅13",
    "方1", "方2", "方3", "方4", "方5", "方6", "方7", "方8", "方9", "方10", "方11", "方12", "方13",
    "心1", "心2", "心3", "心4", "心5", "心6", "心7", "心8", "心9", "心10", "心11", "心12", "心13",
    "桃1", "桃2", "桃3", "桃4", "桃5", "桃6", "桃7", "桃8", "桃9", "桃10", "桃11", "桃12", "桃13"];
    var p1 = [];
    var p2 = [];
    var p3 = [];
    var p4 = [];
    for (var i = 1; i < 5; i++) {
        for (var j = 1; j < 14; j++) {
            let random = getRandom(cards.length);
        	switch (i) {
                case 1:
                	p1.push(cards[random]);
                	cards.splice(random, 1);
                    break;
                case 2:
                	p2.push(cards[random]);
                	cards.splice(random, 1);
                    break;
                case 3:
                	p3.push(cards[random]);
                	cards.splice(random, 1);
                    break;
                case 4:
                	p4.push(cards[random]);
                	cards.splice(random, 1);
                    break;
            }
        }
    }
    return [[p1.sort()], [p2.sort()], [p3.sort()], [p4.sort()]];
}

function getRandom(num) {
    // 會回傳0~num之間的隨機數字
    return Math.floor(Math.random() * num);
}

function xx() {
    // 連線資料庫
    database.connect();
    database.query('SELECT * FROM room', (err, res) => {
        if (err) {
            console.log("資料庫連接失敗: " + err);
        } else {
            console.log("資料庫連接成功: ");
            for (let row of res.rows) {
                console.log(JSON.stringify(row));
            }      
        }
        // client.end();
      });
}
