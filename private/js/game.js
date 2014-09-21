// The server-side game

// Requires
var GameManager = require('./game_manager');

var gameManager = new GameManager(4);
var scores = []; // Array of objects which include {date, score}. In sorted descending order
var isRestarting = false;

// External API
module.exports = {

  // Game move
  move: function (direction) {
    gameManager.move(direction);
  },

  // Gets the game state data
  getGameData: function () {
    return gameManager.getGameData();
  },

  // Resets the game
  restart: function (callback) {
    // Add score once
    var gameData = gameManager.getGameData();
    var score = gameData.score;
    var won = gameData.won;
    if (!isRestarting) {
      isRestarting = true;
      addScore(score, won);
      // Restart the game after a short duration
      setTimeout(function () {
        isRestarting = false;
        gameManager.restart();
        callback();
      }, 4000);
    }
  },

  // Gets all scores (could be a lot)
  getScores: function () {
    return scores;
  },

  // Gets the top few scores
  getHighscores: function () {
    return scores.slice(0, 20);
  }
};

// Add a score to the high score list
function addScore (score, won) {
  scores.push({
    date: new Date(),
    score: score,
    won: won
  });

  // Keep scores sorted
  scores.sort(function (a, b) {
    return b.score - a.score;
  });
}