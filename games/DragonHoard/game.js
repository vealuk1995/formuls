const GAME_CONSTANTS = {
    DRAGON_SPEED: 200,
    DRAGON_JUMP: -450,
    DRAGON_MAX_HEALTH: 3,
    FIREBALL_SPEED: 500,
    INITIAL_TREASURE_HP: 100,
    ENEMY_SPEED: 100,
    TILE_SIZE: 32,
    GRAVITY_Y: 500,
    MAX_ENEMIES: 50,
    MAX_FIREBALLS: 50,
    MAX_BONUSES: 10,
    DRAGON_START_Y: 0.83,
    TREASURE_Y: 0.92,
    UI_HP_Y: 0.08,
    UI_SCORE_X: 0.025,
    UI_WAVE_Y: 0.066,
    UI_DRAGON_HP_X: 0.975,
    BUTTON_SIZE_FACTOR: 0.1,
    WAVE_PAUSE_DURATION: 3000,
    ENEMY_SPAWN_DELAY: 1000,
    ASPECT_RATIO: 16 / 9
};

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 1280,
    height: 720,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: GAME_CONSTANTS.GRAVITY_Y },
            debug: false
        }
    },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let dragon, treasure, platforms, enemies, fireballs, bonuses, cursors;
let score = 0, treasureHealth = GAME_CONSTANTS.INITIAL_TREASURE_HP, waveCount = 0;
let gameWidth, gameHeight, uiElements, gameOverText, gameOverRect, startScreenText, startScreenRect, progressBar, progressScroll, startButton;
let isGameStarted = false, isWaveInProgress = false;

class Dragon {
    constructor(scene, x, y, fireballs) {
        this.scene = scene;
        this.fireballs = fireballs;
        this.sprite = scene.physics.add.sprite(x, y, 'dragon', 0);
        this.sprite.setBounce(0.2).setCollideWorldBounds(true);
        this.sprite.body.setSize(64, 64);
        this.sprite.setData('health', GAME_CONSTANTS.DRAGON_MAX_HEALTH);
        this.sprite.setData('invulnerable', false);
        this.lastDirection = 1;
        scene.physics.add.collider(this.sprite, platforms);
    }

    move(cursors) {
        if (cursors.left.isDown) {
            this.sprite.setVelocityX(-GAME_CONSTANTS.DRAGON_SPEED);
            this.lastDirection = -1;
            this.sprite.setScale(-1, 1);
            this.sprite.anims.play('dragon_walk', true);
        } else if (cursors.right.isDown) {
            this.sprite.setVelocityX(GAME_CONSTANTS.DRAGON_SPEED);
            this.lastDirection = 1;
            this.sprite.setScale(1, 1);
            this.sprite.anims.play('dragon_walk', true);
        } else {
            this.sprite.setVelocityX(0);
            this.sprite.anims.play('dragon_idle', true);
        }

        if (cursors.up.isDown && this.sprite.body.touching.down) {
            this.sprite.setVelocityY(GAME_CONSTANTS.DRAGON_JUMP);
        }
    }

    shoot() {
        if (!this.fireballs) return;
        let fireball = this.fireballs.get(this.sprite.x, this.sprite.y);
        if (fireball) {
            fireball.setActive(true).setVisible(true);
            fireball.body.allowGravity = false;
            fireball.body.setSize(36, 24);
            fireball.setVelocityX(this.lastDirection * GAME_CONSTANTS.FIREBALL_SPEED);
            fireball.setScale(this.lastDirection, 1);
            fireball.anims.play('fireball_fly', true);
            this.scene.physics.add.collider(fireball, platforms, () => fireball.destroy());
            this.scene.sound.get('fireball_sound')?.play();
        }
    }

    takeDamage() {
        if (!this.sprite.getData('invulnerable')) {
            let health = this.sprite.getData('health') - 1;
            this.sprite.setData('health', health);
            this.sprite.setData('invulnerable', true);
            this.sprite.setTint(0xff0000);
            this.scene.time.delayedCall(1000, () => {
                this.sprite.clearTint();
                this.sprite.setData('invulnerable', false);
            });
            return health <= 0;
        }
        return false;
    }
}

function preload() {
    this.load.on('progress', (value) => {
        console.log(`Loading progress: ${Math.round(value * 100)}%`);
        if (progressBar) {
            progressBar.scaleX = value;
        }
    });

    this.load.on('fileprogress', (file) => {
        console.log(`Loading file: ${file.key}`);
    });

    this.load.on('complete', () => {
        console.log('All files loaded successfully');
        if (progressScroll) {
            progressScroll.destroy();
            progressScroll = null;
        }
        if (progressBar) {
            progressBar.destroy();
            progressBar = null;
        }
        if (startScreenText) startScreenText.setText("Dragon's Hoard\nPress ENTER or Tap to Start");
        if (startButton) startButton.setVisible(true); // Показываем кнопку после загрузки
    });

    this.load.on('fileerror', (file) => {
        console.error(`Error loading file: ${file.key}`);
    });

    this.load.spritesheet('dragon', 'assets/sprites/dragon_spritesheet.png', { frameWidth: 64, frameHeight: 64 });
    this.load.image('treasure', 'assets/sprites/treasure_cartoon.png');
    this.load.spritesheet('knight', 'assets/sprites/knight_spritesheet.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('griffin', 'assets/sprites/griffin_spritesheet.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('fireball', 'assets/sprites/fireball_spritesheet.png', { frameWidth: 36, frameHeight: 24 });
    this.load.image('platform_tile', 'assets/sprites/platform_cartoon.png');
    this.load.image('crystal_bonus', 'assets/sprites/crystal_bonus_cartoon.png');
    this.load.image('coin', 'assets/sprites/coin.png');
    this.load.image('cave_bg', 'assets/backgrounds/cave_bg_cartoon.png');
    this.load.audio('fireball_sound', 'assets/sounds/fireball.mp3');
    this.load.audio('coin_steal', 'assets/sounds/coin_steal.mp3');
    this.load.audio('bonus_collect', 'assets/sounds/bonus.mp3');
}

function create() {
    gameWidth = this.scale.width;
    gameHeight = this.scale.height;

    // Создаем стартовый экран
    this.add.image(gameWidth / 2, gameHeight / 2, 'cave_bg').setDisplaySize(gameWidth, gameHeight);
    startScreenRect = this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, 0x000000, 0.5);
    startScreenText = this.add.text(gameWidth / 2 - 150, gameHeight / 2 - 100, 
        "Dragon's Hoard\nLoading...", 
        { fontFamily: 'MedievalSharp', fontSize: '50px', color: '#ffd700', align: 'center' });
    progressScroll = this.add.rectangle(gameWidth / 2, gameHeight / 2 + 50, gameWidth * 0.5, 40, 0x8b4513).setOrigin(0.5);
    progressBar = this.add.rectangle(gameWidth / 2 - (gameWidth * 0.25), gameHeight / 2 + 50, 0, 30, 0xffff00).setOrigin(0, 0.5);
    
    // Добавляем кнопку "Start" (пока скрыта до завершения загрузки)
    startButton = this.add.rectangle(gameWidth / 2, gameHeight / 2 + 150, 200, 80, 0x00ff00)
        .setInteractive()
        .setVisible(false);
    this.add.text(gameWidth / 2 - 40, gameHeight / 2 + 130, "Start", 
        { fontFamily: 'MedievalSharp', fontSize: '30px', color: '#000000' });
    startButton.on('pointerdown', startGame, this);

    // Инициализация игровых объектов
    platforms = createPlatforms(this, gameWidth, gameHeight);
    treasure = this.physics.add.staticSprite(gameWidth / 2, gameHeight * GAME_CONSTANTS.TREASURE_Y, 'treasure');
    treasure.setData('health', treasureHealth);

    uiElements = {
        hpText: this.add.text(gameWidth / 2 - 50, gameHeight * GAME_CONSTANTS.UI_HP_Y, `Treasure HP: ${treasureHealth}`, { fontSize: '20px', color: '#fff' }),
        scoreText: this.add.text(gameWidth * GAME_CONSTANTS.UI_SCORE_X, gameHeight * 0.033, 'Score: 0', { fontSize: '20px', color: '#fff' }),
        waveText: this.add.text(gameWidth * GAME_CONSTANTS.UI_SCORE_X, gameHeight * GAME_CONSTANTS.UI_WAVE_Y, 'Wave: 1', { fontSize: '20px', color: '#fff' }),
        dragonHpText: this.add.text(gameWidth * GAME_CONSTANTS.UI_DRAGON_HP_X - 50, gameHeight * 0.033, `Dragon HP: ${GAME_CONSTANTS.DRAGON_MAX_HEALTH}`, { fontSize: '20px', color: '#fff' })
    };

    fireballs = this.physics.add.group({ defaultKey: 'fireball', maxSize: GAME_CONSTANTS.MAX_FIREBALLS, gravityY: 0 });
    dragon = new Dragon(this, gameWidth / 2, gameHeight * GAME_CONSTANTS.DRAGON_START_Y, fireballs);

    this.anims.create({ key: 'dragon_idle', frames: this.anims.generateFrameNumbers('dragon', { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
    this.anims.create({ key: 'dragon_walk', frames: this.anims.generateFrameNumbers('dragon', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'knight_walk', frames: this.anims.generateFrameNumbers('knight', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'griffin_walk', frames: this.anims.generateFrameNumbers('griffin', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'fireball_fly', frames: this.anims.generateFrameNumbers('fireball', { start: 0, end: 2 }), frameRate: 15, repeat: -1 });

    cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-SPACE', () => dragon.shoot(), this);
    this.input.keyboard.on('keydown-R', restartGame, this);
    this.input.keyboard.on('keydown-ENTER', startGame, this);

    enemies = this.physics.add.group({ maxSize: GAME_CONSTANTS.MAX_ENEMIES });
    bonuses = this.physics.add.group({ maxSize: GAME_CONSTANTS.MAX_BONUSES });

    this.physics.add.collider(enemies, platforms);
    this.physics.add.overlap(enemies, treasure, stealCoin, null, this);
    this.physics.add.overlap(fireballs, enemies, hitEnemy, null, this);
    this.physics.add.overlap(dragon.sprite, bonuses, collectBonus, null, this);
    this.physics.add.overlap(dragon.sprite, enemies, dragonDeath, null, this);
    this.physics.add.collider(bonuses, platforms);

    // Мобильные кнопки управления
    if (!this.sys.game.device.os.desktop || this.sys.game.device.os.touch) { // Расширяем для всех сенсорных устройств
        const buttonSize = gameWidth * GAME_CONSTANTS.BUTTON_SIZE_FACTOR;
        let leftButton = this.add.rectangle(gameWidth * 0.125, gameHeight * 0.83, buttonSize, buttonSize, 0x6666ff).setInteractive();
        let rightButton = this.add.rectangle(gameWidth * 0.25, gameHeight * 0.83, buttonSize, buttonSize, 0x6666ff).setInteractive();
        let jumpButton = this.add.rectangle(gameWidth * 0.875, gameHeight * 0.83, buttonSize, buttonSize, 0x66ff66).setInteractive();
        let shootButton = this.add.rectangle(gameWidth * 0.75, gameHeight * 0.83, buttonSize, buttonSize, 0xff6666).setInteractive();

        leftButton.on('pointerdown', () => dragon.sprite.setVelocityX(-GAME_CONSTANTS.DRAGON_SPEED));
        leftButton.on('pointerup', () => dragon.sprite.setVelocityX(0));
        rightButton.on('pointerdown', () => dragon.sprite.setVelocityX(GAME_CONSTANTS.DRAGON_SPEED));
        rightButton.on('pointerup', () => dragon.sprite.setVelocityX(0));
        jumpButton.on('pointerdown', () => { if (dragon.sprite.body.touching.down) dragon.sprite.setVelocityY(GAME_CONSTANTS.DRAGON_JUMP); });
        shootButton.on('pointerdown', () => dragon.shoot(), this);

        leftButton.setVisible(false);
        rightButton.setVisible(false);
        jumpButton.setVisible(false);
        shootButton.setVisible(false);
    }

    hideGameElements.call(this);
    this.scale.on('resize', resize, this);
}

function update() {
    if (!isGameStarted) return;

    dragon.move(cursors);

    enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        let hasCoin = enemy.getData('hasCoin') || false;
        let spawnSide = enemy.getData('spawnSide') || 'left';
        let directionX = hasCoin ? (spawnSide === 'left' ? -GAME_CONSTANTS.ENEMY_SPEED : GAME_CONSTANTS.ENEMY_SPEED) : (treasure.x - enemy.x);

        if (!hasCoin && enemy.body.touching.down && Math.abs(enemy.x - treasure.x) > 50) {
            if (!enemy.jumpTimer) {
                enemy.jumpTimer = this.time.addEvent({
                    delay: Phaser.Math.Between(2000, 5000),
                    callback: () => {
                        if (enemy && enemy.active) {
                            if (enemy.texture.key === 'griffin') {
                                enemy.setVelocityY(-300);
                            } else {
                                enemy.setVelocityY(-150);
                            }
                        }
                    },
                    loop: true
                });
            }
        }

        enemy.setVelocityX(directionX > 0 ? GAME_CONSTANTS.ENEMY_SPEED : -GAME_CONSTANTS.ENEMY_SPEED);
        enemy.setScale(directionX > 0 ? 1 : -1, 1);
        enemy.anims.play(enemy.texture.key + '_walk', true);
        if (enemy.coinSprite) enemy.coinSprite.setPosition(enemy.x, enemy.y - 20);

        if (hasCoin && (enemy.x <= 0 || enemy.x >= gameWidth)) {
            treasure.setData('health', treasure.getData('health') - 1);
            if (enemy.jumpTimer) enemy.jumpTimer.remove();
            enemy.destroy();
            if (enemy.coinSprite) enemy.coinSprite.destroy();
        }
    });

    fireballs.children.each(fireball => { if (fireball.x < 0 || fireball.x > gameWidth) fireball.destroy(); });

    updateUI();

    if (treasure.getData('health') <= 0) gameOver.call(this, 'Treasure Lost');
    if (enemies.countActive() === 0 && treasure.getData('health') > 0 && isWaveInProgress) {
        isWaveInProgress = false;
        this.time.delayedCall(GAME_CONSTANTS.WAVE_PAUSE_DURATION, () => {
            waveCount++;
            spawnWave.call(this);
        }, [], this);
    }
}

function createPlatforms(scene, width, height) {
    let platforms = scene.physics.add.staticGroup();
    for (let x = 0; x < width; x += GAME_CONSTANTS.TILE_SIZE) {
        platforms.create(x + GAME_CONSTANTS.TILE_SIZE / 2, height - GAME_CONSTANTS.TILE_SIZE / 2, 'platform_tile').setDisplaySize(GAME_CONSTANTS.TILE_SIZE, GAME_CONSTANTS.TILE_SIZE).refreshBody();
    }
    for (let x = 0; x < 7 * GAME_CONSTANTS.TILE_SIZE; x += GAME_CONSTANTS.TILE_SIZE) {
        platforms.create(width * 0.15 - 3.5 * GAME_CONSTANTS.TILE_SIZE + x + GAME_CONSTANTS.TILE_SIZE / 2, height * 0.75 - GAME_CONSTANTS.TILE_SIZE / 2, 'platform_tile').setDisplaySize(GAME_CONSTANTS.TILE_SIZE, GAME_CONSTANTS.TILE_SIZE).refreshBody();
    }
    for (let x = 0; x < 8 * GAME_CONSTANTS.TILE_SIZE; x += GAME_CONSTANTS.TILE_SIZE) {
        platforms.create(width * 0.85 - 4 * GAME_CONSTANTS.TILE_SIZE + x + GAME_CONSTANTS.TILE_SIZE / 2, height * 0.75 - GAME_CONSTANTS.TILE_SIZE / 2, 'platform_tile').setDisplaySize(GAME_CONSTANTS.TILE_SIZE, GAME_CONSTANTS.TILE_SIZE).refreshBody();
    }
    for (let x = 0; x < 5 * GAME_CONSTANTS.TILE_SIZE; x += GAME_CONSTANTS.TILE_SIZE) {
        platforms.create(width * 0.1875 - 2.5 * GAME_CONSTANTS.TILE_SIZE + x + GAME_CONSTANTS.TILE_SIZE / 2, height * 0.5 - GAME_CONSTANTS.TILE_SIZE / 2, 'platform_tile').setDisplaySize(GAME_CONSTANTS.TILE_SIZE, GAME_CONSTANTS.TILE_SIZE).refreshBody();
    }
    for (let x = 0; x < 4 * GAME_CONSTANTS.TILE_SIZE; x += GAME_CONSTANTS.TILE_SIZE) {
        platforms.create(width * 0.8125 - 2 * GAME_CONSTANTS.TILE_SIZE + x + GAME_CONSTANTS.TILE_SIZE / 2, height * 0.5 - GAME_CONSTANTS.TILE_SIZE / 2, 'platform_tile').setDisplaySize(GAME_CONSTANTS.TILE_SIZE, GAME_CONSTANTS.TILE_SIZE).refreshBody();
    }
    return platforms;
}

function spawnWave() {
    isWaveInProgress = true;
    let enemyCount = Math.min(3 + Math.floor(Math.pow(waveCount, 1.2)), 15);
    let platformHeights = [gameHeight * 0.5 - 100, gameHeight * 0.75 - 100, gameHeight - 100];
    let enemiesToSpawn = [];

    for (let i = 0; i < enemyCount; i++) {
        let type = Math.random() < 0.5 ? 'knight' : 'griffin';
        let y = Phaser.Math.RND.pick(platformHeights);
        let x = Math.random() < 0.5 ? gameWidth * 0.0625 : gameWidth * 0.9375;
        enemiesToSpawn.push({ x, y, type, spawnSide: x < gameWidth / 2 ? 'left' : 'right' });
    }

    if (enemyCount > 5) {
        let spawnIndex = 0;
        this.time.addEvent({
            delay: GAME_CONSTANTS.ENEMY_SPAWN_DELAY,
            callback: () => {
                if (spawnIndex < enemiesToSpawn.length) {
                    let enemyData = enemiesToSpawn[spawnIndex];
                    spawnEnemy.call(this, enemyData.x, enemyData.y, enemyData.type, enemyData.spawnSide);
                    spawnIndex++;
                }
            },
            repeat: enemyCount - 1
        });
    } else {
        enemiesToSpawn.forEach(enemyData => spawnEnemy.call(this, enemyData.x, enemyData.y, enemyData.type, enemyData.spawnSide));
    }
}

function spawnEnemy(x, y, type, spawnSide) {
    let enemy = enemies.create(x, y, type);
    if (enemy) {
        enemy.setCollideWorldBounds(true);
        enemy.body.setSize(48, 48);
        enemy.setData('hasCoin', false);
        enemy.setData('spawnSide', spawnSide);
    }
}

function stealCoin(enemy, treasure) {
    if (!enemy.getData('hasCoin')) {
        enemy.setData('hasCoin', true);
        enemy.coinSprite = this.add.image(enemy.x, enemy.y - 20, 'coin').setScale(0.5);
        this.sound.get('coin_steal')?.play();
        enemy.setData('spawnSide', enemy.getData('spawnSide') === 'left' ? 'right' : 'left');
    }
}

function hitEnemy(fireball, enemy) {
    fireball.destroy();
    if (enemy.jumpTimer) enemy.jumpTimer.remove();
    enemy.destroy();
    if (enemy.coinSprite) enemy.coinSprite.destroy();
    score += 10;
    if (Math.random() < 0.2) spawnBonus(enemy.x, enemy.y);
}

function spawnBonus(x, y) {
    let bonus = bonuses.create(x, y, 'crystal_bonus');
    if (bonus) {
        bonus.setVelocityY(100);
    }
}

function collectBonus(dragonSprite, bonus) {
    bonus.destroy();
    dragonSprite.setVelocityX(dragonSprite.body.velocity.x * 1.5);
    this.sound.get('bonus_collect')?.play();
    this.time.delayedCall(5000, () => dragonSprite.setVelocityX(dragonSprite.body.velocity.x / 1.5));
}

function dragonDeath(dragonSprite, enemy) {
    if (dragon.takeDamage()) gameOver.call(this, 'Dragon Defeated');
}

function gameOver(message) {
    this.physics.pause();
    gameOverRect = this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, 0x000000, 0.7);
    gameOverText = this.add.text(gameWidth / 2 - 150, gameHeight / 2 - 50, 
        `${message}\nScore: ${score}\nWaves: ${waveCount}\nPress R to Restart`, 
        { fontSize: '40px', color: '#ff0000', align: 'center' });
}

function restartGame() {
    treasure.setData('health', GAME_CONSTANTS.INITIAL_TREASURE_HP);
    score = 0;
    waveCount = 0;
    dragon.sprite.setPosition(gameWidth / 2, gameHeight * GAME_CONSTANTS.DRAGON_START_Y);
    dragon.sprite.setData('health', GAME_CONSTANTS.DRAGON_MAX_HEALTH);
    dragon.sprite.setData('invulnerable', false);
    dragon.sprite.clearTint();
    dragon.sprite.setVelocity(0, 0);
    enemies.clear(true, true);
    fireballs.clear(true, true);
    bonuses.clear(true, true);

    if (gameOverText) gameOverText.destroy();
    if (gameOverRect) gameOverRect.destroy();
    gameOverText = null;
    gameOverRect = null;

    this.physics.resume();
    this.time.removeAllEvents();
    isGameStarted = false;
    isWaveInProgress = false;
    showStartScreen.call(this);
    hideGameElements.call(this);
}

function updateUI() {
    uiElements.hpText.setText(`Treasure HP: ${treasure.getData('health')}`);
    uiElements.scoreText.setText(`Score: ${score}`);
    uiElements.waveText.setText(`Wave: ${waveCount + 1}`);
    uiElements.dragonHpText.setText(`Dragon HP: ${dragon.sprite.getData('health')}`);
}

function resize(gameSize) {
    gameWidth = gameSize.width;
    gameHeight = gameSize.height;

    this.children.list.find(child => child.texture && child.texture.key === 'cave_bg')?.setPosition(gameWidth / 2, gameHeight / 2).setDisplaySize(gameWidth, gameHeight);
    
    platforms.getChildren().forEach(platform => {
        if (platform.y > gameHeight * 0.9) {
            platform.setPosition(platform.x, gameHeight - GAME_CONSTANTS.TILE_SIZE / 2);
        } else if (platform.y < gameHeight * 0.6 && platform.y > gameHeight * 0.7) {
            platform.setPosition(platform.x, gameHeight * 0.75 - GAME_CONSTANTS.TILE_SIZE / 2);
        } else if (platform.y < gameHeight * 0.6 && platform.y > gameHeight * 0.4) {
            platform.setPosition(platform.x, gameHeight * 0.5 - GAME_CONSTANTS.TILE_SIZE / 2);
        }
        platform.refreshBody();
    });

    treasure.setPosition(gameWidth / 2, gameHeight * GAME_CONSTANTS.TREASURE_Y);
    dragon.sprite.setPosition(gameWidth / 2, gameHeight * GAME_CONSTANTS.DRAGON_START_Y);
    uiElements.hpText.setPosition(gameWidth / 2 - 50, gameHeight * GAME_CONSTANTS.UI_HP_Y);
    uiElements.scoreText.setPosition(gameWidth * GAME_CONSTANTS.UI_SCORE_X, gameHeight * 0.033);
    uiElements.waveText.setPosition(gameWidth * GAME_CONSTANTS.UI_SCORE_X, gameHeight * GAME_CONSTANTS.UI_WAVE_Y);
    uiElements.dragonHpText.setPosition(gameWidth * GAME_CONSTANTS.UI_DRAGON_HP_X - 50, gameHeight * 0.033);

    if (!isGameStarted && startScreenRect) {
        startScreenRect.setPosition(gameWidth / 2, gameHeight / 2).setSize(gameWidth, gameHeight);
        startScreenText.setPosition(gameWidth / 2 - 150, gameHeight / 2 - 100);
        if (startButton) startButton.setPosition(gameWidth / 2, gameHeight / 2 + 150);
    }
}

function showStartScreen() {
    this.physics.pause();
    this.add.image(gameWidth / 2, gameHeight / 2, 'cave_bg').setDisplaySize(gameWidth, gameHeight);
    startScreenRect = this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, 0x000000, 0.5);
    startScreenText = this.add.text(gameWidth / 2 - 150, gameHeight / 2 - 100, 
        "Dragon's Hoard\nLoading...", 
        { fontFamily: 'MedievalSharp', fontSize: '50px', color: '#ffd700', align: 'center' });
    progressScroll = this.add.rectangle(gameWidth / 2, gameHeight / 2 + 50, gameWidth * 0.5, 40, 0x8b4513).setOrigin(0.5);
    progressBar = this.add.rectangle(gameWidth / 2 - (gameWidth * 0.25), gameHeight / 2 + 50, 0, 30, 0xffff00).setOrigin(0, 0.5);
}

function hideGameElements() {
    dragon.sprite.setVisible(false);
    uiElements.hpText.setVisible(false);
    uiElements.scoreText.setVisible(false);
    uiElements.waveText.setVisible(false);
    uiElements.dragonHpText.setVisible(false);

    if (!this.sys.game.device.os.desktop || this.sys.game.device.os.touch) {
        this.children.list.forEach(child => {
            if (child.type === 'Rectangle' && child.input && child !== startButton) child.setVisible(false);
        });
    }
}

function startGame() {
    if (isGameStarted || !this.load.isReady()) return;
    isGameStarted = true;
    
    if (startScreenText) {
        startScreenText.destroy();
        startScreenText = null;
    }
    if (startScreenRect) {
        startScreenRect.destroy();
        startScreenRect = null;
    }
    if (progressScroll) {
        progressScroll.destroy();
        progressScroll = null;
    }
    if (progressBar) {
        progressBar.destroy();
        progressBar = null;
    }
    if (startButton) {
        startButton.destroy();
        startButton = null;
    }

    dragon.sprite.setVisible(true);
    uiElements.hpText.setVisible(true);
    uiElements.scoreText.setVisible(true);
    uiElements.waveText.setVisible(true);
    uiElements.dragonHpText.setVisible(true);

    if (!this.sys.game.device.os.desktop || this.sys.game.device.os.touch) {
        this.children.list.forEach(child => {
            if (child.type === 'Rectangle' && child.input) child.setVisible(true);
        });
    }

    this.physics.resume();
    spawnWave.call(this);
}