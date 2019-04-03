function isPortrait(screen) {
  return screen.height > screen.width;
}

var LINE_STOPPED_SPEED = 0;
var LINE_STARTED_SPEED = -330;

var scoreText;
var score = 0;
var levelText;

var pauseFlag = false;
var feature = '';
var queryParams = '?level=';
var level = 0;

featureMap = {
  'past_participle':'VBN',
  'comparative_adjective': 'JJR',
  'present_participle': 'VBG',
  'plural_noun': 'NNS',
  'simple_past': 'VBD'
}

var bounds;
var sentenceWord;

var scrollPool;


function playPastParticiple() {
  console.log('past participle!');
  feature = 'past_participle';
  game.state.start('play');
}

function playSimplePast() {
  console.log('simple past!');
  feature = 'simple_past';
  game.state.start('play');
}

function playPresentParticiple() {
  console.log('present participles!');
  feature = 'present_participle';
  game.state.start('play');
}

function preload() {
}

var game = (function () {
  var heightScale = isPortrait(screen) ? 0.7 : 0.75;
  return new Phaser.Game(screen.width * .8, screen.height * heightScale, Phaser.CANVAS, 'gameDiv', {
    preload: preload,
    create: create,
    update: update
  });
})();


var sentenceFactory = (function () {

  var factory = {};
  var counter = -1;
  var sentences = [];

  factory.nextSentence = function nextSentence() {
    counter++;
    if (counter < sentences.length) {
      console.log('Returning sentence ' + (counter + 1) + ' of ' + sentences.length + '.');
      console.log(sentences);
      return {'sentence' : sentences[counter].sentence, 'words' : sentences[counter].words};
    } else {
//      game.state.start('win');
      console.log('There are no more sentences; call loadSentences() again.');
      //return null;
    }
  };

  factory.loadSentences = function loadSentences(process) {
    console.log('Loading a fresh batch of sentences.');
    var urlString = feature + queryParams;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/' + urlString);
    xhr.onload = function () {
      if (xhr.status === 200) {
        counter = -1;
        sentences = JSON.parse(xhr.response).sentences;
        process(null, factory);
      } else {
        console.log('AJAX error when loading a fresh batch of sentences.', xhr.response);
        process(xhr.status, factory);
      }
    };
    xhr.send();
  };

  return factory;
})();

function create() {
  game.physics.startSystem(Phaser.Physics.ARCADE);

  var scaleX = game.world.width / 1200;
  var scaleY = game.world.height / 800;

  game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
  game.scale.pageAlignHorizontally = true;
  game.scale.pageAlignVertically = true;
  game.scale.refresh();

  var background = game.add.tileSprite(0, 0, 1200, 800, 'background');
  background.tileScale.x = scaleX;
  background.tileScale.y = scaleY;
  
  var floor = game.add.tileSprite(0, game.world.height - 100, 1200, 100, 'floor');

  var conveyor = game.add.sprite(game.world.width, game.world.height * .95, 'conveyor');
  conveyor.anchor.set(0.75, 0.75);
  conveyor.scale.setTo(scaleX,scaleY);

  var scaffolding = game.add.sprite(game.world.width, game.world.height * .25, 'scaffolding');
  scaffolding.anchor.set(0.95, 0.75);
  scaffolding.scale.setTo(scaleX,scaleY);

  var scoreFontSize = isPortrait(screen) ? '2em Georgia' : '3.5em Georgia';
  scoreText = game.add.text(5, 5, 'Points: ' + score, {font: scoreFontSize, fill: '#000000'});
  var levelFontSize = isPortrait(screen) ? '2em Georgia' : '3.5em Georgia';
  levelText = game.add.text(game.world.width - 5, 5, 'Level: ' + (level + 1), {font: levelFontSize, fill: '#000000'});
  levelText.anchor.set(1,0);

  var pauseButton = game.add.sprite(game.world.width * .15, game.world.height * .3, 'pauseButton');
  pauseButton.anchor.set(0.5);
  var pauseButtonScale = isPortrait(screen) ? .2 : .35;
  pauseButton.scale.setTo(pauseButtonScale);

  pauseButton.inputEnabled = true;
  pauseButton.events.onInputDown.add(startAndStopTheLine, this);

  currentLevelSpeed = LINE_STARTED_SPEED;

  bounds = game.add.sprite(1, game.world.height * .7, null)
  game.physics.enable(bounds, Phaser.Physics.ARCADE);
  bounds.body.immovable = true;
  bounds.body.setSize(1, game.world.height, 1, 1);

  var openingTextStyle = isPortrait(screen)
      ? {font: '3em Georgia', fill: '#d6f5d4'}
      : {font: '5em Georgia', fill: '#a5f66h'};

  scrollPool = game.add.group();
  scrollPool.enableBody = true;
  scrollPool.physicsBodyType = Phaser.Physics.ARCADE;
  scrollPool.setAll('outOfBoundsKill', true);


  function startAndStopTheLine() {
    if (!pauseFlag) {
        pauseButton.loadTexture('playButton');
        pauseFlag = true; 
    } else {
        pauseButton.loadTexture('pauseButton');
        pauseFlag = false;
    }
    var currentSentence = scrollPool.getFirstAlive();
    var resolvedSpeed = Math.abs(currentSentence.body.velocity.x) > LINE_STOPPED_SPEED ? LINE_STOPPED_SPEED : currentLevelSpeed; 
    scrollPool.setAll('body.velocity.x', resolvedSpeed);
  }

  sentenceFactory.loadSentences(advanceTheProductionLine);

}

function testWord(sprite, pointer) {
  if (sprite.data == 'changed') {
    sprite.alpha = 0.5;
    displayCheckMark();
    score += 10;
    scoreText.setText('Points: ' + score);
  } else {
    speedUpLine();
  }
}

function speedUpLine() {
  if (currentLevelSpeed <= -600) {
    return;
  } else {
    currentLevelSpeed -= 25;
    scrollPool.setAll('body.velocity.x', currentLevelSpeed);
  }
}

function displayCheckMark(){
  if (isPortrait(screen)) {
    var correctSprite = game.add.sprite(game.world.width * .45, game.world.height * .28, 'greenCheckMark');
    correctSprite.scale.setTo(.65);
  } else {
    var correctSprite = game.add.sprite(game.world.width * .5, game.world.height * .4, 'greenCheckMark');
  }
  game.time.events.add(2000, function() {
    game.add.tween(correctSprite).to({alpha:0}, 2000, Phaser.Easing.Linear.None, true);}, this);

}

function advanceTheProductionLine(error, sentences) {
    if (error) {
      console.log('Error.', error);
      // TODO: handle errors gracefully within the game
      return;
    }

    var sentenceObject = sentences.nextSentence();

    if (sentenceObject) {

      var wordsObject = sentenceObject.words;
      console.log(sentenceObject);

      var changedOneFlag = false;
      var dataFlag = false;
      positionCount = 0;

      var style = isPortrait(screen)
        ? {font: '3em Consolas', fill: '#b3h5j6'}
        : {font: '5em Consolas', fill: '#a4d7gg'};

      for (var i = 0; i < wordsObject.length; i++){

        if (wordsObject[i].pos == featureMap[feature] && changedOneFlag == false) {
          var computedValue = wordsObject[i].lemma;
          changedOneFlag = true;
        } else {
          var computedValue = wordsObject[i].original;
        }

        if (wordsObject[i + 1]) {
          var nextValue = wordsObject[i + 1].original;
        } else {
          var nextValue = null;
        }

        sentenceWord = game.add.text(game.world.width + positionCount, game.world.height * .7, computedValue, style, scrollPool);

        if (wordsObject[i].pos == featureMap[feature] && dataFlag == false) {
          sentenceWord.data = 'changed';
          dataFlag = true;
        } else {
          sentenceWord.data = 'same';
        }
        sentenceWord.body.velocity.setTo(currentLevelSpeed, 0);
        sentenceWord.checkWorldBounds = true;
        if (i == wordsObject.length - 1) {

          sentenceWord.body.onCollide = new Phaser.Signal();
          sentenceWord.body.onCollide.add(detectCollide, this);
        }
        sentenceWord.anchor.set(0,0);

        sentenceWord.inputEnabled = true;
        sentenceWord.events.onInputDown.add(testWord, this);

         if (nextValue && ( /['",\.]/.test(nextValue[0]) || /n't/.test(nextValue))) {
           positionCount += sentenceWord.width;
         } else {
           positionCount += (sentenceWord.width + 10);
         }
      }

    } else {
      game.state.start('win');
    }
  }

function detectCollide(obj1){
  if (obj1.hasCollided) {
    return;
  }
  obj1.hasCollided = true;
  onEndOfTheProductionLine();
}

function onEndOfTheProductionLine() {
  scrollPool.callAll('kill');
  advanceTheProductionLine(null, sentenceFactory);
}


function update() {
    game.physics.arcade.collide(sentenceWord, bounds, detectCollide);
}


var bootState = {
  preload: function () {
    console.log('started preload in bootstate');
    game.load.image('preloader', 'assets/images/loading.png');

    game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
    game.scale.pageAlignHorizontally = true;
    game.scale.pageAlignVertically = true;
  },

  create: function () {
    game.stage.backgroundColor = '#000000';
    game.state.start('load');
  },

  start: function () {
  }
};

var loadState = {
  preload: function () {
    console.log('started loading assets');
    game.load.image('factoryLogo', 'assets/images/factoryLogo.png');
    game.load.image('selectButton', 'assets/images/redSelectButton.png');
    game.load.image('background', 'assets/images/factoryWalls.png');
    game.load.image('floor', 'assets/images/factoryFloor.png');
    game.load.image('conveyor', 'assets/images/conveyor.png');
    game.load.image('scaffolding', 'assets/images/scaffolding.png');
    game.load.image('pauseButton', 'assets/images/pauseButtonOutlined.png');
    game.load.image('playButton', 'assets/images/playButtonOutlined.png');
    game.load.image('greenCheckMark', 'assets/images/checkmark.png');

    var loadingBar = game.add.sprite(0, game.world.height - 50, 'preloader');
    var loadingBarResizeX = game.world.width/387;
    loadingBar.scale.setTo(loadingBarResizeX,1);
    var statusText = game.add.text(game.world.centerX, game.world.height - 130, 'Loading...', {fill: 'white'});
    statusText.anchor.setTo(0.5);
    game.load.setPreloadSprite(loadingBar);
  },

  loadUpdate: function() {
    var progressAmount = game.load.progress;
    if (progressAmount === 100) {
      this.loadComplete();
    };
  },

  loadComplete: function() {
    game.state.start('splashScreen');
  }

};

var splashScreenState = {
  preload: function() {
    preload();
  },

  create: function() {
    game.scale.fullScreenScaleMode = Phaser.ScaleManager.SHOW_ALL;
    game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;

    game.scale.pageAlignHorizontally = true;
    game.scale.pageAlignVertically = true;

    game.scale.refresh();

    var logoTextFontSize = isPortrait(screen) ? '1.75em Georgia' : '3.5em Georgia';

    var logoWidth = 2086;
    var logoHeight = 2400;
    var gameLogo = game.add.sprite(game.world.centerX, game.world.centerY/2, 'factoryLogo');
    gameLogo.anchor.set(0.5);
    var resizeX = (game.world.width/logoWidth) * .65;
    var resizeY = ((game.world.height/logoHeight)/2) * .75;
    gameLogo.scale.setTo(resizeX, resizeY);
    var logoText = game.add.text(game.world.centerX, game.world.height * .75, 'SENTENCE FACTORY', {font: logoTextFontSize, fill: '#0095DD'});
    logoText.anchor.set(0.5);

    var touchToStartFontSize = isPortrait(screen) ? '1.6em Georgia' : '3em Georgia';

    var touchToStart = game.add.text(game.world.centerX, game.world.height - 35, 'touch the screen to start', {font: touchToStartFontSize, fill: '#0095DD'});
    touchToStart.anchor.set(0.5);

    touchToStart.alpha = 1;
    var textTween = game.add.tween(touchToStart).to({alpha:.25}, 300, 'Linear', true, 1, -1);
    textTween.yoyo(true, 300);

    game.input.onTap.addOnce(this.start, this);

  },

  start: function() {
    game.state.start('instructions');
  }

};

var instructionState = {
  preload: function() {
    preload();
  },
  create: function() {
    game.scale.fullScreenScaleMode = Phaser.ScaleManager.SHOW_ALL;
    game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;

    game.scale.pageAlignHorizontally = true;
    game.scale.pageAlignVertically = true;

    game.scale.refresh();

    var instructionsFontSize = isPortrait(screen) ? '1.75em Georga' : '4.5em Georgia';

    var instructionsText = game.add.text(15, 35, instructions, {font: instructionsFontSize, fill: '#0095DD', wordWrap: true, wordWrapWidth: game.world.width * .85});

    var continueTextFontSize = isPortrait(screen) ? '1.5em Georgia' : '2.5em Georgia';
    var continueTextOffsetHeight = isPortrait(screen) ? 25 : 50;

    var continueText = game.add.text(game.world.centerX, game.world.height - continueTextOffsetHeight, 'touch the screen to continue...', {font: continueTextFontSize, fill: '#0095DD'});
    continueText.anchor.set(0.5);
    game.input.onTap.addOnce(this.start, this);
  },

  start: function() {
    game.state.start('select');
  }
};

var selectState = {
  preload: function() {
  },

  create: function () {
    game.scale.fullScreenScaleMode = Phaser.ScaleManager.SHOW_ALL;
    game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;

    game.scale.pageAlignHorizontally = true;
    game.scale.pageAlignVertically = true;

    game.scale.refresh();

    var selectionFontSize = isPortrait(screen) ? '1.75em Georgia' : '4.5em Georgia';

    var selectionText = game.add.text(game.world.width/2, 35, selectionInstructions, {font: selectionFontSize, fill: '#0095DD', wordWrap: true, wordWrapWidth: game.world.width * .9});

    selectionText.anchor.set(0.5);

//    var selectButtonPool = game.add.group(); 
//    selectButtonPool.enableBody = true;
//    selectButtonPool.physicsBodyType = Phaser.Physics.ARCADE;
//    selectButtonPool.setAll('inputEnabled', true);

    var buttonScale = isPortrait(screen) ? 0.35 : 0.6;
    var textScale = isPortrait(screen) ? '1.2em Georgia' : '2.5em Georgia';

    var pastParticipleButton = game.add.sprite(game.world.width * .5, game.world.height * .35, 'selectButton');
    pastParticipleButton.anchor.set(0.5);
    var pastParticipleButtonText = game.add.text(game.world.width * .5, game.world.height * .35, 'simple past', {font: textScale, fill: '#000000'});
    pastParticipleButtonText.anchor.set(0.5);

//    selectButtonPool.add(pastParticipleButton);
    pastParticipleButton.enableBody = true;
    pastParticipleButton.physicsBodyType = Phaser.Physics.ARCADE;
    pastParticipleButton.inputEnabled = true;
    pastParticipleButton.events.onInputDown.add(playPastParticiple, this);
    pastParticipleButton.scale.setTo(buttonScale);

    var simplePastButton = game.add.sprite(game.world.width * .5, game.world.height * .55, 'selectButton');
    simplePastButton.anchor.set(0.5);
    var simplePastButtonText = game.add.text(game.world.width * .5, game.world.height * .55, 'present participle', {font: textScale, fill: '#000000'});
    simplePastButtonText.anchor.set(0.5);

//    selectButtonPool.add(simplePastButton);
    simplePastButton.enableBody = true;
    simplePastButton.physicsBodyType = Phaser.Physics.ARCADE;
    simplePastButton.inputEnabled = true;
    simplePastButton.events.onInputDown.add(playSimplePast, this);
    simplePastButton.scale.setTo(buttonScale);

    var presentParticipleButton = game.add.sprite(game.world.width * .5, game.world.height * .75, 'selectButton');
    presentParticipleButton.anchor.set(0.5);
    var presentParticipleButtonText = game.add.text(game.world.width * .5, game.world.height * .75, 'past participle', {font: textScale, fill: '#000000'});
    presentParticipleButtonText.anchor.set(0.5);

//    selectButtonPool.add(presentParticipleButton);
    presentParticipleButton.enableBody = true;
    presentParticipleButton.physicsBodytype = Phaser.Physics.ARCADE;
    presentParticipleButton.inputEnabled = true;
    presentParticipleButton.events.onInputDown.add(playPastParticiple, this);
    presentParticipleButton.scale.setTo(buttonScale);

  },

  start: function() {
    game.state.start('play');
  }
};


var playState = {
  preload: function () {
  },

  create: function () {
    console.log('started create in playState');
    console.log('feature here is ' + feature);
    create();
  },

  update: function() {
    update();
  }
};

var winState = {
  preload: function() {
  },

  create: function() {
    console.log('got to win state');
    game.scale.fullScreenScaleMode = Phaser.ScaleManager.SHOW_ALL;
    game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;

    game.scale.pageAlignHorizontally = true;
    game.scale.pageAlignVertically = true;

    game.scale.refresh();

    var winFontSize = isPortrait(screen) ? '2.5em Georgia' : '4.5em Georgia';

    var endingText = game.add.text(game.world.centerX, game.world.centerY, 'you got to the end of the level. Touch the screen to continue to the next level.' , {font: winFontSize, fill: '#0095DD', wordWrap: true, wordWrapWidth: game.world.width * .9, boundsAlignH: 'center'});
    endingText.anchor.set(0.5);

    game.input.onTap.addOnce(this.start, this);

    //feature = '';
    level++;
    queryParams = '?level=' + level;
  },

  start: function() {
    game.state.start('play');
  }
};

game.state.add('boot', bootState);
game.state.add('load', loadState);
game.state.add('splashScreen', splashScreenState);
game.state.add('instructions', instructionState);
game.state.add('select', selectState);
game.state.add('play', playState);
game.state.add('win', winState);

game.state.start('boot');
