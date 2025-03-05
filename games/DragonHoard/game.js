// game.js
const GAME_CONSTANTS = {
    DRAGON_SPEED: 160,
    DRAGON_JUMP: -450,
    DRAGON_MAX_HEALTH: 3,
    FIREBALL_SPEED: 400,
    INITIAL_TREASURE_HP: 100,
    ENEMY_SPEED: 100,
    TILE_SIZE: 32,
    GRAVITY_Y: 500,
    MAX_ENEMIES: 30,
    MAX_FIREBALLS: 50,
    MAX_BONUSES: 10,
    MAX_ARROWS: 20,
    DRAGON_START_Y: 0.83,
    TREASURE_Y: 0.92,
    UI_HP_Y: 0.08,
    UI_SCORE_X: 0.025,
    UI_WAVE_Y: 0.066,
    UI_DRAGON_HP_X: 0.9,
    ENEMY_SPAWN_DELAY: 1000,
    ASPECT_RATIO: 16 / 9,
    BONUS_HP_RESTORE: 10,
    BONUS_LIFE_RESTORE: 1,
    TREASURE_DAMAGE_RADIUS: 50,
    TREASURE_HP_LOSS_RATE: 300,
    ARCHER_ARROW_SPEED: 300,
    ARCHER_SHOOT_DELAY: 2000,
    WAVE_PREPARATION_TIME: 5000,
    ENEMY_SPAWN_INTERVAL: 1000,
    MIN_ENEMY_SPACING: 60,
    MIN_DRAGON_ENEMY_DISTANCE: 60
};

const config = {
    type: Phaser.WEBGL,
    parent: 'game-container',
    width: 1280,
    height: 720,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { y: GAME_CONSTANTS.GRAVITY_Y }, debug: false } },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let dragon, treasure, platforms, enemies, fireballs, bonuses, arrows, cursors;
let score = 0, treasureHealth = GAME_CONSTANTS.INITIAL_TREASURE_HP;
let gameWidth, gameHeight, uiElements, gameOverText, gameOverRect, debugRects = [];
let treasureDamageTimer, waveNumber = 0, waveText, waveTimer, startScreen;
let gameStarted = false, enemiesToSpawn = [], spawnQueueTimer;
let isMusicEnabled = true;  // Фоновая музыка включена по умолчанию
let isSoundEnabled = true;  // Звуковые эффекты включены по умолчанию

function isMobileDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

class Dragon {
    constructor(scene, x, y, fireballs) {
        this.scene = scene;
        this.fireballs = fireballs;
        this.sprite = scene.physics.add.sprite(x, y, 'dragon', 0)
            .setBounce(0.2)
            .setCollideWorldBounds(true);
        this.sprite.body.setSize(64, 64);
        this.sprite.setData('health', GAME_CONSTANTS.DRAGON_MAX_HEALTH);
        this.sprite.setData('invulnerable', false);
        this.lastDirection = 1;
        scene.physics.add.collider(this.sprite, platforms);
        if (this.scene.physics.config.debug) {
            this.debugRect = scene.add.rectangle(x, y, 64, 64, 0x800080, 0.5).setDepth(1000);
            debugRects.push(this.debugRect);
        }
        this.shootInterval = null;
    }
    shoot() {
        if (!this.fireballs || this.fireballs.countActive(true) >= GAME_CONSTANTS.MAX_FIREBALLS) return;

        const fireSingleShot = () => {
            let fireball = this.fireballs.get(this.sprite.x, this.sprite.y);
            if (fireball) {
                fireball.setActive(true).setVisible(true)
                    .body.allowGravity = false;
                fireball.body.setSize(36, 24);
                fireball.setVelocityX(this.lastDirection * GAME_CONSTANTS.FIREBALL_SPEED)
                    .setScale(this.lastDirection, 1)
                    .anims.play('fireball_fly', true);
                fireball.body.setOffset(this.lastDirection === -1 ? 36 : 0, 0);
                if (isSoundEnabled) this.scene.sound.play('fireball_sound'); // Учитываем состояние звука
            }
        };

        if (!this.shootInterval) {
            fireSingleShot();
            this.shootInterval = this.scene.time.addEvent({
                delay: 200,
                callback: fireSingleShot,
                callbackScope: this,
                loop: true
            });
        }
    }
    stopShooting() {
        if (this.shootInterval) {
            this.shootInterval.remove();
            this.shootInterval = null;
        }
    }
    move(cursors) {
        const virtualControls = this.scene.virtualControls || { left: false, right: false };
    
        if (cursors.left.isDown || virtualControls.left) {
            this.sprite.setVelocityX(-GAME_CONSTANTS.DRAGON_SPEED);
            this.lastDirection = -1;
            this.sprite.setScale(-1, 1).anims.play('dragon_walk', true);
            this.sprite.body.setOffset(64, 0);
        } else if (cursors.right.isDown || virtualControls.right) {
            this.sprite.setVelocityX(GAME_CONSTANTS.DRAGON_SPEED);
            this.lastDirection = 1;
            this.sprite.setScale(1, 1).anims.play('dragon_walk', true);
            this.sprite.body.setOffset(0, 0);
        } else {
            this.sprite.setVelocityX(0).anims.play('dragon_idle', true);
        }
    
        // Прыжок остался на клавиатуре или через виртуальную кнопку
    
        if (this.debugRect) this.debugRect.setPosition(this.sprite.body.x + 32, this.sprite.body.y + 32);
    }


    takeDamage() {
        if (!this.sprite.getData('invulnerable')) {
            let health = this.sprite.getData('health') - 1;
            this.sprite.setData('health', health)
                .setData('invulnerable', true)
                .setTint(0xff0000);
                if (isSoundEnabled) this.scene.sound.play('damage_sound'); // Учитываем состояние звука
            this.scene.time.delayedCall(1000, () => {
                this.sprite.clearTint().setData('invulnerable', false);
            });
            return health <= 0;
        }
        return false;
    }
    destroy() {
        this.sprite.destroy();
        if (this.debugRect) this.debugRect.destroy();
    }
}

class VirtualButton {
    constructor(scene, x, y, key, callback, scale = 1, tintPressed = 0xaaaaaa, isToggle = false) {
        this.scene = scene;
        this.callback = callback;
        this.isPressed = false;
        this.isToggle = isToggle;

        this.button = scene.add.image(x, y, key)
            .setScale(scale)
            .setInteractive()
            .setDepth(1000);

        if (this.isToggle) {
            this.button.on('pointerup', () => {
                this.callback();
            });
        } else {
            // Используем Set для отслеживания всех активных указателей
            this.activePointers = new Set();

            this.button.on('pointerdown', (pointer) => {
                this.activePointers.add(pointer.id);
                this.isPressed = true;
                this.button.setTint(tintPressed);
                this.callback(true);
            });

            this.button.on('pointerup', (pointer) => {
                this.activePointers.delete(pointer.id);
                if (this.activePointers.size === 0) {
                    this.isPressed = false;
                    this.button.clearTint();
                    this.callback(false);
                }
            });

            this.button.on('pointerout', (pointer) => {
                this.activePointers.delete(pointer.id);
                if (this.activePointers.size === 0 && this.isPressed) {
                    this.isPressed = false;
                    this.button.clearTint();
                    this.callback(false);
                }
            });
        }
    }

    setVisible(visible) {
        this.button.setVisible(visible);
    }

    setTexture(texture) {
        this.button.setTexture(texture);
    }

    destroy() {
        this.button.destroy();
    }
}


function preload() {
    console.log('Starting preload...');
    this.load.on('progress', value => console.log(`Loading progress: ${Math.round(value * 100)}%`));
    this.load.on('fileprogress', file => console.log(`Loading file: ${file.key}`));
    this.load.on('complete', () => console.log('All files loaded successfully'));
    this.load.on('fileerror', file => console.error(`Failed to load file: ${file.key}`));

    this.load.spritesheet('dragon', 'assets/sprites/dragon_spritesheet.png', { frameWidth: 64, frameHeight: 64 });
    this.load.image('treasure', 'assets/sprites/treasure_cartoon.png');
    this.load.spritesheet('knight', 'assets/sprites/knight_spritesheet.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('griffin', 'assets/sprites/griffin_spritesheet.png', { frameWidth: 48, frameHeight: 48 });

    this.load.spritesheet('archer', 'assets/sprites/archer_spritesheet.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('bow', 'assets/sprites/bow_spritesheet.png', { frameWidth: 32, frameHeight: 32 }); // Новый спрайтшит для лука

    this.load.spritesheet('fireball', 'assets/sprites/fireball_spritesheet.png', { frameWidth: 36, frameHeight: 24 });
    this.load.image('arrow', 'assets/sprites/arrow.png');
    this.load.image('platform_tile', 'assets/sprites/platform_cartoon.png');
    this.load.image('crystal_bonus', 'assets/sprites/crystal_bonus_cartoon.png');
    this.load.image('coin', 'assets/sprites/coin.png');
    this.load.image('cave_bg', 'assets/backgrounds/cave_bg_cartoon.png');


    this.load.audio('fireball_sound', 'assets/sounds/fireball.wav');
    this.load.audio('coin_steal', 'assets/sounds/coin_steal.wav');
    this.load.audio('bonus_collect', 'assets/sounds/bonus.wav');
    this.load.audio('arrow_shot', 'assets/sounds/arrow_shot.wav');
    this.load.audio('jump_sound', 'assets/sounds/jump.wav');
    this.load.audio('damage_sound', 'assets/sounds/damage.wav');
    this.load.audio('wave_start', 'assets/sounds/wave_start.wav');
    this.load.audio('enemy_death', 'assets/sounds/enemy_death.wav');


    this.load.audio('background_music', 'assets/sounds/background_music.mp3');

    this.load.image('left_button', 'assets/sprites/left.png');
    this.load.image('right_button', 'assets/sprites/right.png');
    this.load.image('jump_button', 'assets/sprites/jump.png');
    this.load.image('fire_button', 'assets/sprites/fire.png');
    this.load.image('music_on', 'assets/sprites/music_on.png');
    this.load.image('music_off', 'assets/sprites/music_off.png');
    this.load.image('sound_on', 'assets/sprites/sound_on.png');
    this.load.image('sound_off', 'assets/sprites/sound_off.png');
}

function create() {
    console.log('Starting create...');
    gameWidth = this.scale.width;
    gameHeight = this.scale.height;

    if (!this.anims.exists('dragon_idle')) {
        this.anims.create({ key: 'dragon_idle', frames: this.anims.generateFrameNumbers('dragon', { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
        this.anims.create({ key: 'dragon_walk', frames: this.anims.generateFrameNumbers('dragon', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'knight_walk', frames: this.anims.generateFrameNumbers('knight', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'griffin_walk', frames: this.anims.generateFrameNumbers('griffin', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });

        this.anims.create({ key: 'archer_walk', frames: this.anims.generateFrameNumbers('archer', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'bow_idle', frames: this.anims.generateFrameNumbers('bow', { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
        this.anims.create({ key: 'bow_shoot', frames: this.anims.generateFrameNumbers('bow', { start: 1, end: 3 }), frameRate: 15, repeat: 0 });

        this.anims.create({ key: 'fireball_fly', frames: this.anims.generateFrameNumbers('fireball', { start: 0, end: 2 }), frameRate: 15, repeat: -1 });
    }

    this.sound.add('fireball_sound', { volume: 0.5 });
    this.sound.add('coin_steal', { volume: 0.5 });
    this.sound.add('bonus_collect', { volume: 0.5 });
    this.sound.add('arrow_shot', { volume: 0.5 });
    this.sound.add('jump_sound', { volume: 0.5 });
    this.sound.add('damage_sound', { volume: 0.5 });
    this.sound.add('wave_start', { volume: 0.5 });
    this.sound.add('damage_sound', { volume: 0.5 });
    this.backgroundMusic = this.sound.add('background_music', { volume: 0.3, loop: true });

    startScreen = this.add.group();
    startScreen.add(this.add.text(gameWidth / 2, gameHeight / 2 - 50, 'Dragon\'s Hoard', {
        fontFamily: 'VinqueRg',
        fontSize: '180px',
        color: '#ffd700',
        stroke: '#8b4513',
        strokeThickness: 12,
        shadow: { offsetX: 16, offsetY: 16, color: '#000', blur: 5, stroke: true, fill: true }
    }).setOrigin(0.5));

const startText = this.add.text(gameWidth / 2, gameHeight / 2 + 50,
        isMobileDevice() ? 'Click to start' : 'Press ENTER to Start',
        {
            fontFamily: 'MedievalSharp',
            fontSize: '40px',
            color: '#ffffff',
            stroke: '#8b4513',
            strokeThickness: 3,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 3, stroke: true, fill: true }
        }).setOrigin(0.5).setInteractive();
    startScreen.add(startText);

    const fullscreenText = this.add.text(gameWidth / 2, gameHeight / 2 + 180, 'Fullscreen (Press F)', {
        fontFamily: 'MedievalSharp',
        fontSize: '30px',
        color: '#ffffff',
        stroke: '#8b4513',
        strokeThickness: 2
    }).setOrigin(0.5).setInteractive();
    startScreen.add(fullscreenText);



    const musicToggle = this.add.text(gameWidth / 2, gameHeight / 2 + 100, `Music: ${isMusicEnabled ? 'ON' : 'OFF'} (Press M)`, {
        fontFamily: 'MedievalSharp',
        fontSize: '30px',
        color: '#ffffff',
        stroke: '#8b4513',
        strokeThickness: 2
    }).setOrigin(0.5).setInteractive();
    startScreen.add(musicToggle);

    const soundToggle = this.add.text(gameWidth / 2, gameHeight / 2 + 140, `Sound: ${isSoundEnabled ? 'ON' : 'OFF'} (Press S)`, {
        fontFamily: 'MedievalSharp',
        fontSize: '30px',
        color: '#ffffff',
        stroke: '#8b4513',
        strokeThickness: 2
    }).setOrigin(0.5).setInteractive();
    startScreen.add(soundToggle);

    startText.on('pointerup', () => {
        if (!gameStarted) startGame.call(this);
    });

    startText.on('pointerup', () => {
        if (!gameStarted) startGame.call(this);
    });

    fullscreenText.on('pointerup', () => {
        if (!this.scale.isFullscreen) {
            this.scale.startFullscreen();
        } else {
            this.scale.stopFullscreen();
        }
        fullscreenText.setText(isMobileDevice() ?
            `Fullscreen: ${this.scale.isFullscreen ? 'ON' : 'OFF'}` :
            `Fullscreen: ${this.scale.isFullscreen ? 'ON' : 'OFF'} (Press F)`);
    });

    musicToggle.on('pointerup', () => {
        toggleMusic(this);
        musicToggle.setText(`Music: ${isMusicEnabled ? 'ON' : 'OFF'} ${isMobileDevice() ? '' : '(Press M)'}`);
    });

    soundToggle.on('pointerup', () => {
        isSoundEnabled = !isSoundEnabled;
        soundToggle.setText(`Sound: ${isSoundEnabled ? 'ON' : 'OFF'} ${isMobileDevice() ? '' : '(Press S)'}`);
    });

    // Обработка клавиатуры (только для ПК)
    if (!isMobileDevice()) {
        this.input.keyboard.on('keydown-M', () => {
            toggleMusic(this);
            musicToggle.setText(`Music: ${isMusicEnabled ? 'ON' : 'OFF'} (Press M)`);
        });

        this.input.keyboard.on('keydown-S', () => {
            isSoundEnabled = !isSoundEnabled;
            soundToggle.setText(`Sound: ${isSoundEnabled ? 'ON' : 'OFF'} (Press S)`);
        });

        this.input.keyboard.once('keydown-ENTER', () => startGame.call(this), this);

        this.input.keyboard.on('keydown-F', () => {
            if (!this.scale.isFullscreen) {
                this.scale.startFullscreen();
            } else {
                this.scale.stopFullscreen();
            }
            fullscreenText.setText(`Fullscreen: ${this.scale.isFullscreen ? 'ON' : 'OFF'} (Press F)`);
        });
    }

    this.scale.on('resize', resize, this);
}

function toggleMusic(scene) {
    isMusicEnabled = !isMusicEnabled;
    if (isMusicEnabled && gameStarted) {
        scene.backgroundMusic.play();
    } else if (!isMusicEnabled && gameStarted) {
        scene.backgroundMusic.stop();
    }
}

function startGame() {
    if (gameStarted) return;
    gameStarted = true;
    startScreen.clear(true, true);

    let scene = this;

    scene.add.image(gameWidth / 2, gameHeight / 2, 'cave_bg').setDisplaySize(gameWidth, gameHeight);
    platforms = createPlatforms(scene, gameWidth, gameHeight);
    treasure = scene.physics.add.staticSprite(gameWidth / 2, gameHeight * GAME_CONSTANTS.TREASURE_Y, 'treasure')
        .setData('health', treasureHealth);

        fireballs = scene.physics.add.group({ defaultKey: 'fireball', maxSize: GAME_CONSTANTS.MAX_FIREBALLS, gravityY: 0 });
        enemies = scene.physics.add.group({ maxSize: GAME_CONSTANTS.MAX_ENEMIES });
        bonuses = scene.physics.add.group({ maxSize: GAME_CONSTANTS.MAX_BONUSES });
        arrows = scene.physics.add.group({ defaultKey: 'arrow', maxSize: GAME_CONSTANTS.MAX_ARROWS, gravityY: 0 });
        dragon = new Dragon(scene, gameWidth / 2, gameHeight * GAME_CONSTANTS.DRAGON_START_Y, fireballs);
    

    uiElements = {
        hpText: scene.add.text(gameWidth / 2 - 70, gameHeight * GAME_CONSTANTS.UI_HP_Y, `Treasure HP: ${treasureHealth}`, {
            fontFamily: 'MedievalSharp',
            fontSize: '28px',
            color: '#ffffff',
            stroke: '#8b4513',
            strokeThickness: 2,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 2, stroke: true, fill: true }
        }),
        scoreText: scene.add.text(gameWidth * GAME_CONSTANTS.UI_SCORE_X, gameHeight * 0.033, 'Score: 0', {
            fontFamily: 'MedievalSharp',
            fontSize: '28px',
            color: '#ffd700',
            stroke: '#8b4513',
            strokeThickness: 2,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 2, stroke: true, fill: true }
        }),
        dragonHpText: scene.add.text(gameWidth * GAME_CONSTANTS.UI_DRAGON_HP_X - 70, gameHeight * 0.033, `Dragon HP: ${GAME_CONSTANTS.DRAGON_MAX_HEALTH}`, {
            fontFamily: 'MedievalSharp',
            fontSize: '28px',
            color: '#ffffff',
            stroke: '#8b4513',
            strokeThickness: 2,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 2, stroke: true, fill: true }
        }),
        waveText: scene.add.text(gameWidth / 2, gameHeight * GAME_CONSTANTS.UI_WAVE_Y, '', {
            fontFamily: 'MedievalSharp',
            fontSize: '32px',
            color: '#ffd700',
            stroke: '#8b4513',
            strokeThickness: 3,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 3, stroke: true, fill: true }
        }).setOrigin(0.5)
    };


    this.virtualButtons = {};

    if (isMobileDevice()) {
        const buttonSize = gameWidth * 0.1;
        const padding = buttonSize * 0.3;
        let scaleButton = 1.7;

        this.virtualButtons = {
            left: new VirtualButton(
                this,
                buttonSize * 0.5 + padding,
                gameHeight - buttonSize * 0.5 - padding,
                'left_button',
                (pressed) => this.virtualControls.left = pressed,scaleButton
            ),
            right: new VirtualButton(
                this,
                buttonSize * 1.5 + padding * 2,
                gameHeight - buttonSize * 0.5 - padding,
                'right_button',
                (pressed) => this.virtualControls.right = pressed,scaleButton
            ),
            jump: new VirtualButton(
                this,
                gameWidth - buttonSize * 1.5 - padding * 2,
                gameHeight - buttonSize * 0.5 - padding,
                'jump_button',
                (pressed) => this.virtualControls.jump = pressed,scaleButton
            ),
            fire: new VirtualButton(
                this,
                gameWidth - buttonSize * 0.5 - padding,
                gameHeight - buttonSize * 0.5 - padding,
                'fire_button',
                (pressed) => this.virtualControls.fire = pressed,scaleButton
            ),
            music: new VirtualButton(
                this,
                gameWidth - buttonSize * 0.5 - padding,
                buttonSize * 0.5 + padding,
                isMusicEnabled ? 'music_on' : 'music_off',
                () => {
                    toggleMusic(this);
                    this.virtualButtons.music.setTexture(isMusicEnabled ? 'music_on' : 'music_off');
                },
                buttonSize / 100,
                0xaaaaaa,
                true
            ),
            sound: new VirtualButton(
                this,
                gameWidth - buttonSize * 1.5 - padding * 2,
                buttonSize * 0.5 + padding,
                isSoundEnabled ? 'sound_on' : 'sound_off',
                () => {
                    isSoundEnabled = !isSoundEnabled;
                    this.virtualButtons.sound.setTexture(isSoundEnabled ? 'sound_on' : 'sound_off');
                },
                buttonSize / 100,
                0xaaaaaa,
                true
            )
        };

        this.virtualControls = { left: false, right: false, jump: false, fire: false };
    }

    cursors = scene.input.keyboard.createCursorKeys();
    scene.input.keyboard.on('keydown-SPACE', () => dragon.shoot(), scene);
    scene.input.keyboard.on('keydown-R', () => restartGame.call(scene));

    scene.input.keyboard.on('keydown-F', () => {
        if (!scene.scale.isFullscreen) {
            scene.scale.startFullscreen();
        } else {
            scene.scale.stopFullscreen();
        }
    });

    scene.physics.add.collider(enemies, platforms);
    scene.physics.add.overlap(enemies, treasure, stealCoin, null, scene);
    scene.physics.add.overlap(fireballs, enemies, hitEnemy, null, scene);
    scene.physics.add.overlap(dragon.sprite, bonuses, collectBonus, null, scene);
    scene.physics.add.overlap(dragon.sprite, enemies, dragonDeath, null, scene);
    scene.physics.add.overlap(dragon.sprite, arrows, arrowHitDragon, null, scene);
    scene.physics.add.collider(bonuses, platforms);

    treasureDamageTimer = scene.time.addEvent({
        delay: GAME_CONSTANTS.TREASURE_HP_LOSS_RATE,
        callback: decreaseTreasureHealth,
        callbackScope: scene,
        loop: true
    });

    if (isMusicEnabled) scene.backgroundMusic.play();

    startNextWave.call(scene);
    console.log('Game started.');
}

function update() {
    if (!gameStarted || !dragon) return; // Проверка на старт игры и существование dragon

    dragon.move(cursors);


    if ((cursors.up.isDown || (this.virtualControls && this.virtualControls.jump)) && dragon.sprite.body.touching.down) {
        dragon.sprite.setVelocityY(GAME_CONSTANTS.DRAGON_JUMP);
        if (isSoundEnabled) this.sound.play('jump_sound');
        if (this.virtualControls) this.virtualControls.jump = false; // Сбрасываем только для мобильных
    }

    // Стрельба для мобильных устройств и клавиатуры
    if (cursors.space.isDown || (this.virtualControls && this.virtualControls.fire)) {
        dragon.shoot();
    } else {
        dragon.stopShooting();
    }


    enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        let hasCoin = enemy.getData('hasCoin') || false;
        let spawnSide = enemy.getData('spawnSide') || 'left';
        let isArcher = enemy.getData('isArcher') || false;

        if (isArcher) {
            enemy.setVelocityX(0).anims.play('archer_walk', true);
            // Обновляем позицию лука, только если он существует
            if (enemy.bow) {
                enemy.bow.setPosition(enemy.x, enemy.y - 10); // Лук следует за лучником
            }
            if (!enemy.shootTimer) {
                enemy.shootTimer = this.time.addEvent({
                    delay: GAME_CONSTANTS.ARCHER_SHOOT_DELAY,
                    callback: () => shootArrow.call(this, enemy),
                    callbackScope: this,
                    loop: true
                });
            }
        } else if (hasCoin) {
            enemy.body.setAllowGravity(false);
            enemy.body.setVelocity(0, 0);
            if (enemy.platformCollider) {
                this.physics.world.removeCollider(enemy.platformCollider);
                enemy.platformCollider = null;
            }
            enemy.setY(gameHeight * GAME_CONSTANTS.TREASURE_Y - 48);
            enemy.setVelocityX(spawnSide === 'left' ? -GAME_CONSTANTS.ENEMY_SPEED : GAME_CONSTANTS.ENEMY_SPEED)
                .setScale(spawnSide === 'left' ? -1 : 1, 1);
            enemy.body.setOffset(spawnSide === 'left' ? 48 : 0, 0);
            if (enemy.x < 0 || enemy.x > gameWidth) enemy.destroy();
        } else {
            enemy.body.setAllowGravity(true);
            if (!enemy.platformCollider) {
                enemy.platformCollider = this.physics.add.collider(enemy, platforms);
            }
            let directionX = treasure.x - enemy.x;
            enemy.setVelocityX(directionX > 0 ? GAME_CONSTANTS.ENEMY_SPEED : -GAME_CONSTANTS.ENEMY_SPEED)
                .setScale(directionX > 0 ? 1 : -1, 1);
            enemy.body.setOffset(directionX < 0 ? 48 : 0, 0);
            enemy.anims.play(enemy.texture.key + '_walk', true);
        }
        if (enemy.debugRect) enemy.debugRect.setPosition(enemy.body.x + 24, enemy.body.y + 24);
    });

    fireballs.children.each(fireball => {
        if (fireball.x < 0 || fireball.x > gameWidth) fireball.destroy();
    });

    arrows.children.each(arrow => {
        if (arrow.x < 0 || arrow.x > gameWidth) arrow.destroy();
    });

    updateUI.call(this);

    if (waveTimer && waveTimer.getRemaining() > 0) {
        uiElements.waveText.setText(`Wave ${waveNumber} starts in ${Math.ceil(waveTimer.getRemaining() / 1000)}`);
    } else if (enemies.countActive(true) === 0 && enemiesToSpawn.length === 0 && !waveTimer) {
        console.log(`Wave ${waveNumber} completed, starting next wave...`);
        startNextWave.call(this);
    }

    if (treasure.getData('health') <= 0) gameOver.call(this, 'Treasure Lost');
}

function createPlatforms(scene, width, height) {
    let platforms = scene.physics.add.staticGroup();
    const tileSize = GAME_CONSTANTS.TILE_SIZE;

    for (let x = 0; x < width; x += tileSize) {
        let platform = platforms.create(x + tileSize / 2, height - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        if (scene.physics.config.debug) {
            platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
            debugRects.push(platform.debugRect);
        }
    }

    for (let x = 0; x < 9 * tileSize; x += tileSize) {
        let platform = platforms.create(width * 0.15 - 3.5 * tileSize + x + tileSize / 2, height * 0.75 - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        if (scene.physics.config.debug) {
            platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
            debugRects.push(platform.debugRect);
        }
    }

    for (let x = 0; x < 8 * tileSize; x += tileSize) {
        let platform = platforms.create(width * 0.85 - 4 * tileSize + x + tileSize / 2, height * 0.75 - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        if (scene.physics.config.debug) {
            platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
            debugRects.push(platform.debugRect);
        }
    }

    for (let x = 0; x < 5 * tileSize; x += tileSize) {
        let platform = platforms.create(width * 0.1875 - 2.5 * tileSize + x + tileSize / 2, height * 0.46 - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        if (scene.physics.config.debug) {
            platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
            debugRects.push(platform.debugRect);
        }
    }

    for (let x = 0; x < 4 * tileSize; x += tileSize) {
        let platform = platforms.create(width * 0.8125 - 2 * tileSize + x + tileSize / 2, height * 0.45 - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        if (scene.physics.config.debug) {
            platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
            debugRects.push(platform.debugRect);
        }
    }

    for (let x = 0; x < 6 * tileSize; x += tileSize) {
        let platform = platforms.create(width * 0.5 - 3 * tileSize + x + tileSize / 2, height * 0.6 - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        if (scene.physics.config.debug) {
            platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
            debugRects.push(platform.debugRect);
        }
    }

    platforms.getChildren().forEach(platform => {
        if (!platform.texture || platform.texture.key === '__MISSING') {
            console.warn(`Platform at (${platform.x}, ${platform.y}) has no texture, using fallback.`);
            platform.setTexture(null).setFillStyle(0xff0000);
        }
    });

    console.log('Platforms created:', platforms.getChildren().length);
    return platforms;
}

function startNextWave() {
    if (waveTimer) return;
    waveNumber++;
    console.log(`Preparing wave ${waveNumber}`);
    uiElements.waveText.setText(`Wave ${waveNumber} incoming...`);

    spawnBonus.call(this, gameWidth * 0.5, gameHeight * 0.625 - 50);

    waveTimer = this.time.delayedCall(GAME_CONSTANTS.WAVE_PREPARATION_TIME, () => {
        console.log(`Starting wave ${waveNumber}`);
        uiElements.waveText.setText(`Wave ${waveNumber}`);
        if (isSoundEnabled) this.sound.play('wave_start'); // Учитываем состояние звука
        spawnWave.call(this);
        waveTimer = null;
    }, [], this);
}

function spawnWave() {
    if (enemies.countActive(true) >= GAME_CONSTANTS.MAX_ENEMIES) {
        console.error(`Wave ${waveNumber}: Enemy limit reached (${GAME_CONSTANTS.MAX_ENEMIES})`);
        return;
    }

    let enemyCount = Math.min(waveNumber + 1, 30);
    enemiesToSpawn = [];
    let platformHeights = [gameHeight * 0.5 - 100, gameHeight * 0.75 - 100, gameHeight - 100];
    let spawnPositions = [];

    console.log(`Spawning ${enemyCount} enemies for wave ${waveNumber}`);

    for (let i = 0; i < enemyCount; i++) {
        let type = Phaser.Math.RND.pick(['knight', 'griffin']);
        let y = Phaser.Math.RND.pick(platformHeights);
        let x, spawnSide, attempts = 0;

        do {
            x = Math.random() < 0.5 ? gameWidth * 0.0625 + Phaser.Math.Between(-50, 50) : gameWidth * 0.9375 + Phaser.Math.Between(-50, 50);
            spawnSide = x < gameWidth / 2 ? 'left' : 'right';
            attempts++;
            if (attempts > 20) break;
        } while (
            spawnPositions.some(pos => Phaser.Math.Distance.Between(x, y, pos.x, pos.y) < GAME_CONSTANTS.MIN_ENEMY_SPACING) ||
            Phaser.Math.Distance.Between(x, y, dragon.sprite.x, dragon.sprite.y) < GAME_CONSTANTS.MIN_DRAGON_ENEMY_DISTANCE
        );

        if (attempts <= 20) {
            spawnPositions.push({ x, y });
            enemiesToSpawn.push({ x, y, type, spawnSide, isArcher: false });
        } else {
            console.warn(`Could not find valid spawn position for enemy ${i + 1} in wave ${waveNumber}`);
        }
    }

    if (waveNumber >= 3) {
        let archerX = gameWidth * 0.5;
        if (
            !spawnPositions.some(pos => Phaser.Math.Distance.Between(archerX, gameHeight * 0.625 - 100, pos.x, pos.y) < GAME_CONSTANTS.MIN_ENEMY_SPACING) &&
            Phaser.Math.Distance.Between(archerX, gameHeight * 0.625 - 100, dragon.sprite.x, dragon.sprite.y) >= GAME_CONSTANTS.MIN_DRAGON_ENEMY_DISTANCE
        ) {
            enemiesToSpawn.push({ x: archerX, y: gameHeight * 0.625 - 100, type: 'archer', spawnSide: 'center', isArcher: true });
            spawnPositions.push({ x: archerX, y: gameHeight * 0.625 - 100 });
        }
    }

    if (waveNumber >= 6) {
        let leftX = gameWidth * 0.1875;
        let rightX = gameWidth * 0.8125;
        if (
            !spawnPositions.some(pos => Phaser.Math.Distance.Between(leftX, gameHeight * 0.5 - 100, pos.x, pos.y) < GAME_CONSTANTS.MIN_ENEMY_SPACING) &&
            Phaser.Math.Distance.Between(leftX, gameHeight * 0.5 - 100, dragon.sprite.x, dragon.sprite.y) >= GAME_CONSTANTS.MIN_DRAGON_ENEMY_DISTANCE
        ) {
            enemiesToSpawn.push({ x: leftX, y: gameHeight * 0.5 - 100, type: 'archer', spawnSide: 'left', isArcher: true });
            spawnPositions.push({ x: leftX, y: gameHeight * 0.5 - 100 });
        }
        if (
            !spawnPositions.some(pos => Phaser.Math.Distance.Between(rightX, gameHeight * 0.5 - 100, pos.x, pos.y) < GAME_CONSTANTS.MIN_ENEMY_SPACING) &&
            Phaser.Math.Distance.Between(rightX, gameHeight * 0.5 - 100, dragon.sprite.x, dragon.sprite.y) >= GAME_CONSTANTS.MIN_DRAGON_ENEMY_DISTANCE
        ) {
            enemiesToSpawn.push({ x: rightX, y: gameHeight * 0.5 - 100, type: 'archer', spawnSide: 'right', isArcher: true });
            spawnPositions.push({ x: rightX, y: gameHeight * 0.5 - 100 });
        }
    }

    if (waveNumber >= 9) {
        let leftLowX = gameWidth * 0.15;
        let rightLowX = gameWidth * 0.85;
        if (
            !spawnPositions.some(pos => Phaser.Math.Distance.Between(leftLowX, gameHeight * 0.75 - 100, pos.x, pos.y) < GAME_CONSTANTS.MIN_ENEMY_SPACING) &&
            Phaser.Math.Distance.Between(leftLowX, gameHeight * 0.75 - 100, dragon.sprite.x, dragon.sprite.y) >= GAME_CONSTANTS.MIN_DRAGON_ENEMY_DISTANCE
        ) {
            enemiesToSpawn.push({ x: leftLowX, y: gameHeight * 0.75 - 100, type: 'archer', spawnSide: 'left', isArcher: true });
            spawnPositions.push({ x: leftLowX, y: gameHeight * 0.75 - 100 });
        }
        if (
            !spawnPositions.some(pos => Phaser.Math.Distance.Between(rightLowX, gameHeight * 0.75 - 100, pos.x, pos.y) < GAME_CONSTANTS.MIN_ENEMY_SPACING) &&
            Phaser.Math.Distance.Between(rightLowX, gameHeight * 0.75 - 100, dragon.sprite.x, dragon.sprite.y) >= GAME_CONSTANTS.MIN_DRAGON_ENEMY_DISTANCE
        ) {
            enemiesToSpawn.push({ x: rightLowX, y: gameHeight * 0.75 - 100, type: 'archer', spawnSide: 'right', isArcher: true });
            spawnPositions.push({ x: rightLowX, y: gameHeight * 0.75 - 100 });
        }
    }

    if (enemiesToSpawn.length <= 3) {
        enemiesToSpawn.forEach(enemy => spawnEnemy.call(this, enemy.x, enemy.y, enemy.type, enemy.spawnSide, enemy.isArcher));
        enemiesToSpawn = [];
    } else if (enemiesToSpawn.length > 0) {
        if (spawnQueueTimer) spawnQueueTimer.remove();
        spawnQueueTimer = this.time.addEvent({
            delay: GAME_CONSTANTS.ENEMY_SPAWN_INTERVAL,
            callback: spawnNextEnemy,
            callbackScope: this,
            loop: true
        });
    }
}

function spawnNextEnemy() {
    if (enemiesToSpawn.length > 0 && enemies.countActive(true) < GAME_CONSTANTS.MAX_ENEMIES) {
        let enemy = enemiesToSpawn.shift();
        spawnEnemy.call(this, enemy.x, enemy.y, enemy.type, enemy.spawnSide, enemy.isArcher);
    } else if (enemies.countActive(true) === 0 && enemiesToSpawn.length === 0) {
        if (spawnQueueTimer) {
            spawnQueueTimer.remove();
            spawnQueueTimer = null;
        }
        startNextWave.call(this);
    }
}

function spawnEnemy(x, y, type, spawnSide, isArcher = false) {
    if (enemies.countActive(true) >= GAME_CONSTANTS.MAX_ENEMIES) return;
    let enemy = enemies.get(x, y, type);
    if (enemy) {
        enemy.setActive(true).setVisible(true)
            .setCollideWorldBounds(true);
        enemy.body.setSize(48, 48);
        enemy.setData('hasCoin', false);
        enemy.setData('spawnSide', spawnSide);
        enemy.setData('isArcher', isArcher);
        enemy.platformCollider = this.physics.add.collider(enemy, platforms);

        if (isArcher) {
            // Создаем лук как отдельный объект
            enemy.bow = this.add.sprite(x, y - 10, 'bow'); // Позиция лука чуть выше центра лучника
            enemy.bow.setOrigin(0.3, 0.3); // Центрируем точку вращения
            enemy.bow.anims.play('bow_idle', true); // Лук в состоянии покоя
            enemy.bow.setDepth(enemy.depth + 1); // Лук поверх лучника
        }

        if (!isArcher && type !== 'archer') {
            const jumpDelay = type === 'griffin' ? Phaser.Math.Between(1000, 2000) : Phaser.Math.Between(3000, 5000);
            enemy.jumpTimer = this.time.addEvent({
                delay: jumpDelay,
                callback: () => {
                    if (enemy.active && enemy.body.touching.down && !enemy.getData('hasCoin')) {
                        const jumpVelocity = type === 'griffin' ? -350 : -250;
                        enemy.setVelocityY(jumpVelocity);
                    }
                },
                callbackScope: this,
                loop: true
            });
        }

        if (this.physics.config.debug) {
            enemy.debugRect = this.add.rectangle(x, y, 48, 48, 0xff0000, 0.5).setDepth(1000);
            debugRects.push(enemy.debugRect);
        }
        console.log(`Spawned ${type} at (${x}, ${y}), active enemies: ${enemies.countActive(true)}`);
    }
}

function shootArrow(enemy) {
    if (!enemy.active || arrows.countActive(true) >= GAME_CONSTANTS.MAX_ARROWS || !enemy.bow) return;

    // Направление лука в сторону дракона
    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, dragon.sprite.x, dragon.sprite.y);
    enemy.bow.setRotation(angle); // Вращаем лук в сторону дракона

    // Проверяем, есть ли активный таймер стрельбы
    if (!enemy.isShooting) {
        enemy.isShooting = true;

        // Воспроизводим анимацию натяжения лука
        enemy.bow.anims.play('bow_shoot', true);

        // Задержка перед выстрелом, чтобы анимация завершилась
        this.time.delayedCall(300, () => {
            if (!enemy.active || !enemy.bow) { // Проверка перед выстрелом
                enemy.isShooting = false;
                return;
            }
            let arrow = arrows.get(enemy.x, enemy.y - 20);
            if (arrow) {
                arrow.setActive(true).setVisible(true)
                    .body.setAllowGravity(false);
                const directionX = dragon.sprite.x - enemy.x;
                const directionY = dragon.sprite.y - enemy.y;
                const velocityX = Math.cos(angle) * GAME_CONSTANTS.ARCHER_ARROW_SPEED;
                const velocityY = Math.sin(angle) * GAME_CONSTANTS.ARCHER_ARROW_SPEED;
                arrow.setVelocity(velocityX, velocityY)
                    .setRotation(angle);
                if (isSoundEnabled) this.sound.play('arrow_shot');
            }
            if (enemy.bow) { // Дополнительная проверка
                enemy.bow.anims.play('bow_idle', true); // Возвращаем лук в состояние покоя
            }
            enemy.isShooting = false;
        }, [], this);
    }
}

function arrowHitDragon(dragonSprite, arrow) {
    arrow.destroy();
    if (dragon.takeDamage()) gameOver.call(this, 'Dragon Defeated');
}

function stealCoin(enemy, treasure) {
    if (!enemy.active || enemy.getData('hasCoin') || enemy.getData('isArcher')) return;
    enemy.setData('hasCoin', true);
    enemy.coinSprite = this.add.image(enemy.x, enemy.y - 20, 'coin').setScale(0.5);
    if (isSoundEnabled) this.sound.play('coin_steal');
}

function hitEnemy(fireball, enemy) {
    fireball.destroy();
    if (enemy.jumpTimer) {
        enemy.jumpTimer.remove();
        enemy.jumpTimer = null;
    }
    if (enemy.shootTimer) {
        enemy.shootTimer.remove();
        enemy.shootTimer = null;
    }
    if (enemy.platformCollider) {
        this.physics.world.removeCollider(enemy.platformCollider);
        enemy.platformCollider = null;
    }
    if (enemy.coinSprite) enemy.coinSprite.destroy();
    if (enemy.bow) {
        enemy.bow.destroy();
        enemy.bow = null; // Явно устанавливаем null после уничтожения
    }
    if (enemy.debugRect) enemy.debugRect.destroy();
    if (isSoundEnabled) this.sound.play('enemy_death');
    enemy.destroy();
    score += 10;
    if (Math.random() < 0.2) spawnBonus(enemy.x, enemy.y);
    console.log(`Enemy destroyed, active enemies: ${enemies.countActive(true)}`);
}
function spawnBonus(x, y) {
    if (bonuses.countActive(true) >= GAME_CONSTANTS.MAX_BONUSES) return;
    let bonus = bonuses.get(x, y, 'crystal_bonus');
    if (bonus) {
        bonus.setActive(true).setVisible(true)
            .setVelocityY(100)
            .setData('isWaveBonus', true);
    }
}

function collectBonus(dragonSprite, bonus) {
    treasureHealth = Math.min(GAME_CONSTANTS.INITIAL_TREASURE_HP, treasure.getData('health') + GAME_CONSTANTS.BONUS_HP_RESTORE);
    treasure.setData('health', treasureHealth);
    let dragonHealth = Math.min(GAME_CONSTANTS.DRAGON_MAX_HEALTH, dragon.sprite.getData('health') + GAME_CONSTANTS.BONUS_LIFE_RESTORE);
    dragon.sprite.setData('health', dragonHealth);
    bonus.destroy();
    if (isSoundEnabled) this.sound.play('bonus_collect');
}

function dragonDeath(dragonSprite, enemy) {
    if (dragon.takeDamage()) gameOver.call(this, 'Dragon Defeated');
}

function gameOver(message) {
    this.physics.pause();
    if (spawnQueueTimer) spawnQueueTimer.remove();
    if (treasureDamageTimer) treasureDamageTimer.remove();
    enemies.getChildren().forEach(enemy => {
        if (enemy.shootTimer) enemy.shootTimer.remove();
        if (enemy.jumpTimer) enemy.jumpTimer.remove();
    });

    if (isMusicEnabled) this.backgroundMusic.stop(); // Останавливаем музыку только если она включена


    gameOverRect = this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, 0x000000, 0.7).setDepth(1000);
    gameOverText = this.add.text(gameWidth / 2, gameHeight / 2,
        `${message}\nWave: ${waveNumber}\nScore: ${score}\nPress R to Restart`,
        {
            fontFamily: 'MedievalSharp',
            fontSize: '60px',
            color: '#ff0000',
            align: 'center',
            stroke: '#ffd700',
            strokeThickness: 6,
            shadow: { offsetX: 3, offsetY: 3, color: '#000', blur: 5, stroke: true, fill: true }
        }).setOrigin(0.5).setDepth(1001);

        if (isMobileDevice()) {
            this.input.once('pointerup', () => {
                restartGame.call(this);
            });
        }

}

function restartGame() {
    // Останавливаем все звуки
    this.sound.stopAll();

    // Очищаем таймеры и коллайдеры врагов
    enemies.getChildren().forEach(enemy => {
        if (enemy.jumpTimer) enemy.jumpTimer.remove();
        if (enemy.shootTimer) enemy.shootTimer.remove();
        if (enemy.platformCollider) this.physics.world.removeCollider(enemy.platformCollider);
        if (enemy.bow) enemy.bow.destroy();
    });

    // Уничтожаем дракона
    if (dragon) {
        dragon.destroy();
        dragon = null;
    }

    // Очищаем группы
    enemies.clear(true, true);
    fireballs.clear(true, true);
    bonuses.clear(true, true);
    arrows.clear(true, true);

    // Очищаем платформы
    if (platforms) {
        platforms.clear(true, true);
        platforms = null;
    }

    // Очищаем виртуальные кнопки
    if (this.virtualButtons) {
        Object.values(this.virtualButtons).forEach(button => button.destroy());
        this.virtualButtons = null;
    }

    // Очищаем UI элементы
    if (uiElements) {
        Object.values(uiElements).forEach(element => element.destroy());
        uiElements = null;
    }

    // Очищаем отладочные прямоугольники
    debugRects.forEach(rect => rect.destroy());
    debugRects = [];

    // Сбрасываем глобальные переменные
    treasureHealth = GAME_CONSTANTS.INITIAL_TREASURE_HP;
    score = 0;
    waveNumber = 0;
    gameStarted = false;
    enemiesToSpawn = [];
    waveTimer = null;
    spawnQueueTimer = null;

    // Перезапускаем сцену
    this.scene.restart();
}
function updateUI() {
    uiElements.hpText.setText(`Treasure HP: ${treasure.getData('health')}`);
    uiElements.scoreText.setText(`Score: ${score}`);
    uiElements.dragonHpText.setText(`Dragon HP: ${dragon.sprite.getData('health')}`);
}

function resize(gameSize) {
    gameWidth = gameSize.width;
    gameHeight = gameSize.height;

    this.children.list.find(child => child.texture && child.texture.key === 'cave_bg')
        ?.setPosition(gameWidth / 2, gameHeight / 2)
        .setDisplaySize(gameWidth, gameHeight);

    if (!gameStarted) {
        startScreen.getChildren().forEach(child => {
            if (child.type === 'Text') {
                if (child.text.includes('Dragon\'s Hoard')) child.setPosition(gameWidth / 2, gameHeight / 2 - 50);
                else if (child.text.includes('Press ENTER') || child.text.includes('Click to start')) child.setPosition(gameWidth / 2, gameHeight / 2 + 50);
                else if (child.text.includes('Music')) child.setPosition(gameWidth / 2, gameHeight / 2 + 100);
                else if (child.text.includes('Sound')) child.setPosition(gameWidth / 2, gameHeight / 2 + 140);
                else if (child.text.includes('Fullscreen')) child.setPosition(gameWidth / 2, gameHeight / 2 + 180);
            }
        });
        return;
    }

    if (platforms) {
        platforms.clear(true, true);
        platforms = createPlatforms(this, gameWidth, gameHeight);
    }

    treasure.setPosition(gameWidth / 2, gameHeight * GAME_CONSTANTS.TREASURE_Y);
    dragon.sprite.setPosition(gameWidth / 2, gameHeight * GAME_CONSTANTS.DRAGON_START_Y);
    if (dragon.debugRect) dragon.debugRect.setPosition(dragon.sprite.x, dragon.sprite.y);
    uiElements.hpText.setPosition(gameWidth / 2 - 70, gameHeight * GAME_CONSTANTS.UI_HP_Y);
    uiElements.scoreText.setPosition(gameWidth * GAME_CONSTANTS.UI_SCORE_X, gameHeight * 0.033);
    uiElements.dragonHpText.setPosition(gameWidth * GAME_CONSTANTS.UI_DRAGON_HP_X - 70, gameHeight * 0.033);
    uiElements.waveText.setPosition(gameWidth / 2, gameHeight * GAME_CONSTANTS.UI_WAVE_Y);

    if (this.virtualButtons && isMobileDevice()) {
        const buttonSize = gameWidth * 0.1;
        const padding = buttonSize * 0.2;

        this.virtualButtons.left.button.setPosition(buttonSize * 0.5 + padding, gameHeight - buttonSize * 0.5 - padding);
        this.virtualButtons.right.button.setPosition(buttonSize * 1.5 + padding * 2, gameHeight - buttonSize * 0.5 - padding);
        this.virtualButtons.jump.button.setPosition(gameWidth - buttonSize * 1.5 - padding * 2, gameHeight - buttonSize * 0.5 - padding);
        this.virtualButtons.fire.button.setPosition(gameWidth - buttonSize * 0.5 - padding, gameHeight - buttonSize * 0.5 - padding);
        this.virtualButtons.music.button.setPosition(gameWidth - buttonSize * 0.5 - padding, buttonSize * 0.5 + padding);
        this.virtualButtons.sound.button.setPosition(gameWidth - buttonSize * 1.5 - padding * 2, buttonSize * 0.5 + padding);

        Object.values(this.virtualButtons).forEach(button => button.button.setScale(buttonSize / 100));
    }
}
function decreaseTreasureHealth() {
    let enemiesNearTreasure = 0;

    // Подсчитываем врагов в радиусе сокровища
    enemies.getChildren().forEach(enemy => {
        if (!enemy.active || enemy.getData('hasCoin')) return; // Пропускаем неактивных или убегающих с монетой
        const distance = Phaser.Math.Distance.Between(treasure.x, treasure.y, enemy.x, enemy.y);
        if (distance < GAME_CONSTANTS.TREASURE_DAMAGE_RADIUS) {
            enemiesNearTreasure++;
        }
    });

    // Уменьшаем здоровье сокровища на количество врагов рядом
    if (enemiesNearTreasure > 0) {
        treasureHealth = Math.max(0, treasure.getData('health') - enemiesNearTreasure);
        treasure.setData('health', treasureHealth);
    }
}