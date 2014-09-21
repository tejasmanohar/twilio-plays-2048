var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

app.use(express.static(__dirname + '/public'));

io.configure('production', function(){
  io.enable('browser client minification');  // send minified client
  io.enable('browser client etag');          // apply etag caching logic based on version number
  io.enable('browser client gzip');          // gzip the file
  io.set('log level', 1);                    // reduce logging
  // enable all transports (optional if you want flashsocket)
  io.set('transports', [ 'websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling']);
});

var port = process.env.PORT || 8000;
server.listen(port);
console.log("Listening at port: " + port);

// Routes
app.get('/api', function (req, res) {
  var data = game.getGameData();
  data.highscores = game.getScores();
  data.moveCount = moveCount;
  data.numUsers = io.sockets.clients().length; // Online users
  data.totalNumUsers = nextUserId; // Visitor count
  res.send(data);
});

app.get('*', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

// Setup game
var democracy = true;
var nextUserId = 0;
var moveCount = 0;
var game = require('./private/js/game');

var voted = false;
var votes = [0, 0, 0, 0]; // for democracy mode
var ids = [];

if (democracy) {
  setInterval(function() {
    var direction = 0;
    for (var i = 1; i < 4; i++) {
      if (votes[i] > votes[direction]) direction = i;
    }
    if (votes[direction] == 0) return;

    // COPIED FROM BELOW
    ++moveCount;
    // update the game
    game.move(direction);

    // Send the move with the game state
    var gameData = game.getGameData();
    var data = {
      direction: direction,
      userId: "Democracy",
      numUsers: io.sockets.clients().length,
      gameData: gameData
    };
    io.sockets.emit('move', data);

    // Reset the game if it is game over or won
    if (gameData.over || gameData.won) {
      game.restart(function () {
        var data = game.getGameData();
        data.highscores = game.getHighscores();
        io.sockets.emit('restart', data);
      });
    }
    // END COPIED

    ids = [];
    votes = [0, 0, 0, 0];
    voted = false;
  }, 1000);
}

io.sockets.on('connection', function (socket) {
  socket.userId = ++nextUserId;

  // When connecting
  var gameData = game.getGameData();
  var data = {
    userId: socket.userId,
    gameData: gameData,
    numUsers: io.sockets.clients().length,
    highscores: game.getHighscores()
  };
  socket.emit('connected', data);
  socket.broadcast.emit('someone connected', {
    numUsers: io.sockets.clients().length
  });

  // When someone moves
  var numMovesPerSecond = 2;
  var pastEvents = [];
  for (var i = 0; i < numMovesPerSecond; i++) {
    pastEvents.push(0);
  }
  socket.on('move', function (direction) {
    if (democracy) {
      // Keep track of events
      pastEvents.push(new Date().getTime());
      pastEvents.splice(0, pastEvents.length - numMovesPerSecond);

      // Multiplayer
      var spamming = pastEvents[pastEvents.length - 1] - pastEvents[0] < 1000;
      if (!voted && !spamming) {
        voted = true;
        votes[direction]++;

        // Send the move with the same old game state
        var gameData = game.getGameData();
        var data = {
          direction: direction,
          userId: socket.userId,
          numUsers: io.sockets.clients().length,
          gameData: gameData
        };
        io.sockets.emit('move', data);
      }
    } else {
      ++moveCount;
      // update the game
      game.move(direction);

      // Send the move with the game state
      var gameData = game.getGameData();
      var data = {
        direction: direction,
        userId: socket.userId,
        numUsers: io.sockets.clients().length,
        gameData: gameData
      };
      io.sockets.emit('move', data);

      // Reset the game if it is game over or won
      if (gameData.over || gameData.won) {
        game.restart(function () {
          var data = game.getGameData();
          data.highscores = game.getHighscores();
          io.sockets.emit('restart', data);
        });
      }
    }
  });

  socket.on('disconnect', function () {
    io.sockets.emit('someone disconnected', {
      numUsers: io.sockets.clients().length,
    });
  });
});
