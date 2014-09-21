var moveList = document.getElementsByClassName("inputlist")[0];
var highscoreList = document.getElementsByClassName("scorelist")[0];
var userCount = document.getElementsByClassName("numUsers")[0];
var userString = document.getElementsByClassName("userString")[0];
var arrows = ['▲', '▶', '▼', '◀'];
var MOVE_LIST_CUTOFF = 20;

var democracy = true;

var socket = io.connect();
var yourUserId;
socket.on('connected', function (data) {
  yourUserId = data.userId;
  var gameData = data.gameData;
  var highscores = data.highscores;
  setHighscores(highscores);
  updateUserCount(data);
  manager.setGameData(gameData);
});

socket.on('someone connected', function (data) {
  updateUserCount(data);
});

socket.on('someone disconnected', function (data) {
  updateUserCount(data);
});

socket.on('move', function (data) {
  // Add move to input list
  var direction = data.direction;
  var userId = data.userId;
  var moveElement = document.createElement('li');

  var userIdString = 'User ' + userId;
  if (userId === yourUserId) {
    userIdString = '<strong>' + userIdString + '</strong>';
  }
  moveElement.innerHTML = '<span class="move move-'+direction+'">' + arrows[direction] + '</span>' + userIdString;
  moveList.insertBefore(moveElement,moveList.firstChild);

  // Remove input list item if there are too many
  var moveListLen = moveList.childNodes.length;
  if (moveListLen > MOVE_LIST_CUTOFF) {
    for (var i = MOVE_LIST_CUTOFF; i < moveListLen; ++i) {
      moveList.removeChild(moveList.childNodes[i]);
    }
  }

  // Update number of users
  updateUserCount(data);

  // Set the game state (if we're not in a pause state)
  if (!(manager.won || manager.over)) {
    if (!democracy || userId == "Democracy") {
      var gameData = data.gameData;
      manager.setGameData(gameData);
    }
  }
});

socket.on('restart', function (gameData) {
  var highscores = gameData.highscores;
  setHighscores(highscores);
  manager.restart();
  manager.setGameData(gameData);
});

// Sets the visual high score list
function setHighscores (highscores) {
  // Remove all scores
  highscoreList.innerHTML = '';

  // Add all scores
  for (var i = 0; i < highscores.length; ++i) {
    var hsElement = document.createElement('li');
    var hs = highscores[i];
    var hsString = '<strong class="score">' + hs.score + '</strong>' + prettyDate(new Date(hs.date));
    if (hs.won) {
      hsElement.innerHTML = '<span class="won">' + hsString + '</span>';
    } else {
      hsElement.innerHTML = hsString;
    }
    highscoreList.appendChild(hsElement);
  }
}

// Update the user count
function updateUserCount (data) {
  var numUsers = data.numUsers;
  userCount.innerHTML = numUsers;
  userString.innerHTML = numUsers === 1 ? 'user' : 'users';
}

//// Pretty date adapted from https://github.com/netcode/node-prettydate
function createHandler(divisor, noun, restOfString){
  return function(diff){
    var n = Math.floor(diff/divisor);
    var pluralizedNoun = noun + ( n > 1 ? 's' : '' );
    return "" + n + " " + pluralizedNoun + " " + restOfString;
  };
}

var formatters = [
  { threshold: 1,        handler: function(){ return      "just now"; } },
  { threshold: 60,       handler: createHandler(1,        "second",    "ago" ) },
  { threshold: 3600,     handler: createHandler(60,       "minute",    "ago" ) },
  { threshold: 86400,    handler: createHandler(3600,     "hour",      "ago" ) },
  { threshold: 172800,   handler: function(){ return      "yesterday"; } },
  { threshold: 604800,   handler: createHandler(86400,    "day",       "ago" ) },
  { threshold: 2592000,  handler: createHandler(604800,   "week",      "ago" ) },
  { threshold: 31536000, handler: createHandler(2592000,  "month",     "ago" ) },
  { threshold: Infinity, handler: createHandler(31536000, "year",      "ago" ) }
];

function prettyDate (date) {
  var diff = (((new Date()).getTime() - date.getTime()) / 1000);
  for( var i=0; i<formatters.length; i++ ){
    if( diff < formatters[i].threshold ){
      return formatters[i].handler(diff);
    }
  }
  throw new Error("exhausted all formatter options, none found"); //should never be reached
}
////

// Yes, this is in the global scope.
var Multiplayer = {
  move: function (direction) {
    socket.emit('move', direction);
  }
};
