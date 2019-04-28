var express = require('express');
var app = express();
app.get('/',function(req,res){
	res.sendFile(__dirname + '/Client/index.html');
});
app.use('/Client',express.static(__dirname + '/Client'));

var os = require( 'os' );
var networkInterfaces = os.networkInterfaces( );

var ip = networkInterfaces['Wi-Fi'].filter(function(value,index,arr){
	if(value.family === 'IPv4')
	{
		return value;
	}
}); 

console.log(ip[0].address);

var server = app.listen(8000,ip[0].address);
var io = require('socket.io').listen(server);


var players=0;
var socketsList=[];
var bullets=[];
var deathLog = [];

io.on('connection',function(socket) {
	console.log('new player');
	players++;
	socket.id = Math.floor((1+Math.random())*0x10000).toString(16).substring(0);
	socket.x=Math.floor(Math.random()*800);
	socket.y = Math.floor(Math.random()*400);
	socket.rotation = Math.floor(Math.random()*360);

	socket.health=100;
	socket.score=0;
	socket.color = '#' + (function co(lor){   return (lor +=
  [0,1,2,3,4,5,6,7,8,9,'a','b','c','d','e','f'][Math.floor(Math.random()*16)])
  && (lor.length == 6) ?  lor : co(lor); })('');
  	var player = {
			x: socket.x,
			y: socket.y,
			rotation: socket.rotation,
			color: socket.color,
			health:socket.health,
			score:socket.score,
			id: socket.id
		};

	socket.emit('currPlayer',player);
	socketsList.push(socket);


	io.emit('PlayerCount',{n: players});

	socket.on('disconnect',function(){
		console.log('player left:{ '+socket.id+"}");
		players--;
		io.emit('PlayerCount',{n: players});
		for (var i = 0; i < socketsList.length; i++) {
			if(socketsList[i].id == socket.id)
			{
				socketsList.splice(i,1);
			}
		}
	});

	socket.on('playerUpdate',function(data){
		socketsList = socketsList.map(function(socket,index){
			if(socket.id == data.id)
			{
				socket = data;
			}
			return socket;
		});

	});


	socket.on('newBullet',function(data){
		//console.log('new Bullet : x:' + data.x + ' y: '+ data.y + ' rotation: ' + data.rotation);
		bullets.push(data);
	});

});

function distance(p1,p2)
{
	var x = p1.x - p2.x;
	var y = p1.y - p2.y;
	return Math.sqrt(x*x + y*y);
}


function checkBulletCollision()
{
	if(bullets.length>0)
	{
		for (var i = 0; i < bullets.length; i++) {
			bullets[i].x += 6*Math.cos(bullets[i].rotation*Math.PI/180);
			bullets[i].y += 6*Math.sin(bullets[i].rotation*Math.PI/180);

			if(bullets[i].x<=0 || bullets[i].x>=800)
			{
				console.log("kicked out:" + bullets.splice(i,1));
			}
			else if(bullets[i].y<=0 || bullets[i].y>=400)
			{
				console.log("kicked out:" + bullets.splice(i,1));
			}
		}
	}
	if(bullets.length>0)
	{
		bullets = bullets.filter(function(value,index,arr){
			var remove=false;
			var damageFirst=false;
			for (var i = 0; i < socketsList.length; i++) {
				var player = {
					x:socketsList[i].x,
					y:socketsList[i].y
				};
				var b = 
				{
					x:value.x,
					y:value.y
				};
				if(distance(player,b)<20)
				{
					if(!damageFirst)
					{
						if(socketsList[i].health>0)
						{
							socketsList[i].health-=10;
						}
						if(socketsList[i].health<10)
						{
							socketsList[i].health = 100;
							socketsList[i].score = 0;
							socketsList[i].x=Math.floor(Math.random()*800);
							socketsList[i].y = Math.floor(Math.random()*400);
							socketsList[i].rotation = Math.floor(Math.random()*360);
							//TODO: death log
							if(deathLog.length==5)
							{
								deathLog.shift();
							}
							deathLog.push( {from:value.from,color_from: value.color,killed:socketsList[i].id,color_killed: socketsList[i].color,frame:0});
							console.log('new item pushed: to deathlog: ' + deathLog);
						}
						socketsList = socketsList.map(function(socket,index){
							if(socket.id === value.from)
							{
								socket.score++;
							}
							return socket;
						});
					}
					remove = true;
				}
			}
			if(!remove)
			{
				return value;
			}			
		});


	}
}

setInterval(function(){

	checkBulletCollision();
	if(deathLog.length>0)
	{
		console.log('deathLog.length is greater than 0:');
		for (var i = 0; i < deathLog.length; i++) {
			deathLog[i].frame++;
			console.log('frameIncrement: ' + deathLog[i]);
		}
		deathLog = deathLog.filter(function(value,index,arr){
			console.log(value);
			if(value.frame<100)
			{
				return value;
			}
		});
		console.log('new death length: '+ deathLog.length);
	}

	playerData =[];
	bulletData=[];
	for (var i = 0; i < socketsList.length; i++) {
		var socket = socketsList[i];
		var player = {
			x: socket.x,
			y: socket.y,
			rotation: socket.rotation,
			health:socket.health,
			score:socket.score,
			color: socket.color,
			id: socket.id
		};
		playerData.push(player);
	}

	for (var i = 0; i < bullets.length; i++) {
		bulletData.push(bullets[i]);
	}
	io.emit('new positions',{players: playerData,bullets: bulletData,deaths:deathLog});



},1000/25);


console.log('server is running...');
