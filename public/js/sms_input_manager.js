function SMSInputManager() {
  this.events = {};

  this.listen();
}

SMSInputManager.prototype.on = function (event, callback) {
  if (!this.events[event]) {
    this.events[event] = [];
  }
  this.events[event].push(callback);
};

// Keep track of the past events (queue)
var numMovesPerSecond = 2;
var pastEvents = [];
for (var i = 0; i < numMovesPerSecond; i++) {
  pastEvents.push(0);
}
SMSInputManager.prototype.emit = function (event, data) {
  var callbacks = this.events[event];

  // Keep track of events
  pastEvents.push(new Date().getTime());
  pastEvents.splice(0, pastEvents.length - numMovesPerSecond);

  // Multiplayer
  var spamming = pastEvents[pastEvents.length - 1] - pastEvents[0] < 1000;
  if (Multiplayer[event] && !spamming) {
    Multiplayer[event](data);
  }
};

SMSInputManager.prototype.listen = function () {
  var self = this;

  var map = {
    38: 0, // Up
    39: 1, // Right
    40: 2, // Down
    37: 3 // Left
  };

 /* document.addEventListener("keydown", function (event) {
  // Change stuff here to work with twilio
//     var modifiers = event.altKey || event.ctrlKey || event.metaKey ||
//                     event.shiftKey;
//     var mapped    = map[event.which];
    alert(mapped);
//     if (!modifiers) {
      if (mapped !== undefined) {
        event.preventDefault();
        self.emit("move", mapped);
      }

      if (event.which === 32) self.restart.bind(self)(event);
//     }
  });*/

  var retry = document.getElementsByClassName("retry-button")[0];
  retry.addEventListener("click", this.restart.bind(this));

  var gameContainer = document.getElementsByClassName("game-container")[0];

};

SMSInputManager.prototype.restart = function (event) {
  event.preventDefault();
  this.emit("restart");
};