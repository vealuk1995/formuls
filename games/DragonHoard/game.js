const GAME_CONSTANTS = {
    DRAGON_SPEED: 160,
    DRAGON_JUMP: -450,
    DRAGON_MAX_HEALTH: 3,
    FIREBALL_SPEED: 400,
    INITIAL_TREASURE_HP: 100,
    ENEMY_SPEED: 100,
    TILE_SIZE: 32,
    GRAVITY_Y: 500,
    MAX_ENEMIES: 15,
    MAX_FIREBALLS: 50,
    MAX_BONUSES: 10,
    MAX_ARROWS: 20,
    DRAGON_START_Y: 0.83,
    TREASURE_Y: 0.92,
    UI_HP_Y: 0.08,
    UI_SCORE_X: 0.025,
    UI_WAVE_Y: 0.066,
    UI_DRAGON_HP_X: 0.9,
    BUTTON_SIZE_FACTOR: 0.1,
    ENEMY_SPAWN_DELAY: 2000,
    ASPECT_RATIO: 16 / 9,
    BONUS_HP_RESTORE: 10,
    BONUS_LIFE_RESTORE: 1,
    TREASURE_DAMAGE_RADIUS: 50,
    TREASURE_HP_LOSS_RATE: 1000,
    ARCHER_ARROW_SPEED: 300,
    ARCHER_SHOOT_DELAY: 2000,
    WAVE_PREPARATION_TIME: 5000,
    ENEMY_SPAWN_INTERVAL: 1000,
    MIN_ENEMY_SPACING: 60
};

const config = {
    type: Phaser.WEBGL,
    parent: 'game-container',
    width: 1280,
    height: 720,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { y: GAME_CONSTANTS.GRAVITY_Y }, debug: false } },
    scene: { preload, create, update },
    input: {
        touch: true, // Включаем поддержку касаний
        activePointers: 4 // Максимум 4 одновременных касания
    }
};

const game = new Phaser.Game(config);

let dragon, treasure, platforms, enemies, fireballs, bonuses, arrows, cursors, virtualCursors;
let score = 0, treasureHealth = GAME_CONSTANTS.INITIAL_TREASURE_HP;
let gameWidth, gameHeight, uiElements, gameOverText, gameOverRect, debugRects = [];
let treasureDamageTimer, waveNumber = 0, waveText, waveTimer, startScreen;
let gameStarted = false, enemiesToSpawn = [], spawnQueueTimer;

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
    }

    move(cursors) {
        if (cursors.left.isDown) {
            this.sprite.setVelocityX(-GAME_CONSTANTS.DRAGON_SPEED);
            this.lastDirection = -1;
            this.sprite.setScale(-1, 1).anims.play('dragon_walk', true);
            this.sprite.body.setOffset(64, 0);
        } else if (cursors.right.isDown) {
            this.sprite.setVelocityX(GAME_CONSTANTS.DRAGON_SPEED);
            this.lastDirection = 1;
            this.sprite.setScale(1, 1).anims.play('dragon_walk', true);
            this.sprite.body.setOffset(0, 0);
        } else {
            this.sprite.setVelocityX(0).anims.play('dragon_idle', true);
        }

        if (cursors.up.isDown && this.sprite.body.touching.down) {
            this.sprite.setVelocityY(GAME_CONSTANTS.DRAGON_JUMP);
        }

        if (this.debugRect) this.debugRect.setPosition(this.sprite.body.x + 32, this.sprite.body.y + 32);
    }

    shoot() {
        if (!this.fireballs || this.fireballs.countActive(true) >= GAME_CONSTANTS.MAX_FIREBALLS) return;
        let fireball = this.fireballs.get(this.sprite.x, this.sprite.y);
        if (fireball) {
            fireball.setActive(true).setVisible(true)
                .body.allowGravity = false;
            fireball.body.setSize(36, 24);
            fireball.setVelocityX(this.lastDirection * GAME_CONSTANTS.FIREBALL_SPEED)
                .setScale(this.lastDirection, 1)
                .anims.play('fireball_fly', true);
            fireball.body.setOffset(this.lastDirection === -1 ? 36 : 0, 0);
            this.scene.physics.add.collider(fireball, platforms, () => fireball.destroy());
            if (this.scene.sound.get('fireball_sound')) this.scene.sound.get('fireball_sound').play();
        }
    }

    takeDamage() {
        if (!this.sprite.getData('invulnerable')) {
            let health = this.sprite.getData('health') - 1;
            this.sprite.setData('health', health)
                .setData('invulnerable', true)
                .setTint(0xff0000);
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

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.matchMedia && window.matchMedia("(max-width: 767px)").matches);
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
    this.load.spritesheet('fireball', 'assets/sprites/fireball_spritesheet.png', { frameWidth: 36, frameHeight: 24 });
    this.load.image('arrow', 'assets/sprites/arrow.png');
    this.load.image('platform_tile', 'assets/sprites/platform_cartoon.png');
    this.load.image('crystal_bonus', 'assets/sprites/crystal_bonus_cartoon.png');
    this.load.image('coin', 'assets/sprites/coin.png');
    this.load.image('cave_bg', 'assets/backgrounds/cave_bg_cartoon.png');
    this.load.audio('fireball_sound', 'assets/sounds/fireball.mp3');
    this.load.audio('coin_steal', 'assets/sounds/coin_steal.mp3');
    this.load.audio('bonus_collect', 'assets/sounds/bonus.mp3');
    this.load.audio('arrow_shot', 'assets/sounds/arrow_shot.mp3');
}

function create() {
    console.log('Starting create...');
    gameWidth = this.scale.width;
    gameHeight = this.scale.height;

    if (!this.plugins.get('rexVirtualJoystick')) {
        console.warn('rexVirtualJoystick plugin not found');
    } else {
        console.log('rexVirtualJoystick plugin loaded successfully');
    }

    if (!this.anims.exists('dragon_idle')) {
        this.anims.create({ key: 'dragon_idle', frames: this.anims.generateFrameNumbers('dragon', { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
        this.anims.create({ key: 'dragon_walk', frames: this.anims.generateFrameNumbers('dragon', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'knight_walk', frames: this.anims.generateFrameNumbers('knight', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'griffin_walk', frames: this.anims.generateFrameNumbers('griffin', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'archer_walk', frames: this.anims.generateFrameNumbers('archer', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'fireball_fly', frames: this.anims.generateFrameNumbers('fireball', { start: 0, end: 2 }), frameRate: 15, repeat: -1 });
    }

    startScreen = this.add.group();
    startScreen.add(this.add.text(gameWidth / 2, gameHeight / 2 + 100, 'Tap to Start Fullscreen', { fontFamily: 'MedievalSharp', fontSize: '20px', color: '#fff' }).setOrigin(0.5));
    if (isMobileDevice()) {
        this.input.once('pointerdown', () => {
            console.log("Start game tap detected");
            document.documentElement.requestFullscreen().catch(err => console.log("Fullscreen failed:", err));
            startGame.call(this);
        }, this);
    }    startScreen.add(this.add.text(gameWidth / 2, gameHeight / 2 - 50, 'Dragon\'s Hoard', {
        fontFamily: 'VinqueRg',
        fontSize: '180px', // Увеличиваем размер шрифта
        color: '#ffd700',
        stroke: '#8b4513', // Добавляем коричневую обводку
        strokeThickness: 12,
        shadow: { offsetX: 16, offsetY: 16, color: '#000', blur: 5, stroke: true, fill: true } // Тень для красоты
    }).setOrigin(0.5));
    startScreen.add(this.add.text(gameWidth / 2, gameHeight / 2 + 50, 'Press ENTER or Tap to Start', {
        fontFamily: 'MedievalSharp',
        fontSize: '40px', // Увеличиваем размер шрифта
        color: '#ffffff',
        stroke: '#8b4513',
        strokeThickness: 3,
        shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 3, stroke: true, fill: true }
    }).setOrigin(0.5));

    this.input.keyboard.once('keydown-ENTER', () => startGame.call(this), this);
    if (isMobileDevice()) {
        this.input.once('pointerdown', () => {
            console.log("Start game tap detected");
            startGame.call(this);
        }, this);
    }

    this.scale.on('resize', resize, this);
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

        uiElements = {
            hpText: scene.add.text(gameWidth / 2 - 70, gameHeight * GAME_CONSTANTS.UI_HP_Y, `Treasure HP: ${treasureHealth}`, {
                fontFamily: 'MedievalSharp',
                fontSize: '28px', // Увеличенный размер
                color: '#ffffff',
                stroke: '#8b4513', // Коричневая обводка
                strokeThickness: 2,
                shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 2, stroke: true, fill: true }
            }),
            scoreText: scene.add.text(gameWidth * GAME_CONSTANTS.UI_SCORE_X, gameHeight * 0.033, 'Score: 0', {
                fontFamily: 'MedievalSharp',
                fontSize: '28px',
                color: '#ffd700', // Золотой цвет
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
                fontSize: '32px', // Чуть больше для волны
                color: '#ffd700',
                stroke: '#8b4513',
                strokeThickness: 3,
                shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 3, stroke: true, fill: true }
            }).setOrigin(0.5)
        };
    fireballs = scene.physics.add.group({ defaultKey: 'fireball', maxSize: GAME_CONSTANTS.MAX_FIREBALLS, gravityY: 0 });
    enemies = scene.physics.add.group({ maxSize: GAME_CONSTANTS.MAX_ENEMIES });
    bonuses = scene.physics.add.group({ maxSize: GAME_CONSTANTS.MAX_BONUSES });
    arrows = scene.physics.add.group({ defaultKey: 'arrow', maxSize: GAME_CONSTANTS.MAX_ARROWS, gravityY: 0 });

    dragon = new Dragon(scene, gameWidth / 2, gameHeight * GAME_CONSTANTS.DRAGON_START_Y, fireballs);

    cursors = scene.input.keyboard.createCursorKeys();
    scene.input.keyboard.on('keydown-SPACE', () => dragon.shoot(), scene);
    scene.input.keyboard.on('keydown-R', () => restartGame.call(scene));

    // Инициализация virtualCursors для мобильных устройств
    virtualCursors = { 
        left: { isDown: false }, 
        right: { isDown: false }, 
        up: { isDown: false },
        shoot: { isDown: false }
    };

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

    startNextWave.call(scene);
    if (typeof window.initMobileControls === 'function') window.initMobileControls(scene);
    console.log('Game started.');
}

function update() {
    if (!gameStarted) return;

    // Выбор управления в зависимости от устройства
    if (isMobileDevice() && virtualCursors) {
        dragon.move(virtualCursors);
        if (virtualCursors.shoot.isDown) { // Стрельба в update
            dragon.shoot();
        }
    } else {
        dragon.move(cursors);
        if (cursors.space.isDown) { // Для десктопа
            dragon.shoot();
        }
    }

    enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        let hasCoin = enemy.getData('hasCoin') || false;
        let spawnSide = enemy.getData('spawnSide') || 'left';
        let isArcher = enemy.getData('isArcher') || false;

        if (isArcher) {
            enemy.setVelocityX(0).anims.play('archer_walk', true);
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

    for (let x = 0; x < 7 * tileSize; x += tileSize) {
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
        let platform = platforms.create(width * 0.1875 - 2.5 * tileSize + x + tileSize / 2, height * 0.5 - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        if (scene.physics.config.debug) {
            platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
            debugRects.push(platform.debugRect);
        }
    }

    for (let x = 0; x < 4 * tileSize; x += tileSize) {
        let platform = platforms.create(width * 0.8125 - 2 * tileSize + x + tileSize / 2, height * 0.5 - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        if (scene.physics.config.debug) {
            platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
            debugRects.push(platform.debugRect);
        }
    }

    for (let x = 0; x < 6 * tileSize; x += tileSize) {
        let platform = platforms.create(width * 0.5 - 3 * tileSize + x + tileSize / 2, height * 0.625 - tileSize / 2, 'platform_tile')
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
        spawnWave.call(this);
        waveTimer = null;
    }, [], this);
}

function spawnWave() {
    if (enemies.countActive(true) >= GAME_CONSTANTS.MAX_ENEMIES) {
        console.error(`Wave ${waveNumber}: Enemy limit reached (${GAME_CONSTANTS.MAX_ENEMIES})`);
        return;
    }

    let enemyCount = Math.min(waveNumber + 1, 10);
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
            if (attempts > 10) break;
        } while (spawnPositions.some(pos => Phaser.Math.Distance.Between(x, y, pos.x, pos.y) < GAME_CONSTANTS.MIN_ENEMY_SPACING));
        if (attempts <= 10) {
            spawnPositions.push({ x, y });
            enemiesToSpawn.push({ x, y, type, spawnSide, isArcher: false });
        }
    }

    if (waveNumber >= 3) {
        let archerX = gameWidth * 0.5;
        if (!spawnPositions.some(pos => Phaser.Math.Distance.Between(archerX, gameHeight * 0.625 - 100, pos.x, pos.y) < GAME_CONSTANTS.MIN_ENEMY_SPACING)) {
            enemiesToSpawn.push({ x: archerX, y: gameHeight * 0.625 - 100, type: 'archer', spawnSide: 'center', isArcher: true });
            spawnPositions.push({ x: archerX, y: gameHeight * 0.625 - 100 });
        }
    }
    if (waveNumber >= 6) {
        let leftX = gameWidth * 0.1875;
        let rightX = gameWidth * 0.8125;
        if (!spawnPositions.some(pos => Phaser.Math.Distance.Between(leftX, gameHeight * 0.5 - 100, pos.x, pos.y) < GAME_CONSTANTS.MIN_ENEMY_SPACING)) {
            enemiesToSpawn.push({ x: leftX, y: gameHeight * 0.5 - 100, type: 'archer', spawnSide: 'left', isArcher: true });
            spawnPositions.push({ x: leftX, y: gameHeight * 0.5 - 100 });
        }
        if (!spawnPositions.some(pos => Phaser.Math.Distance.Between(rightX, gameHeight * 0.5 - 100, pos.x, pos.y) < GAME_CONSTANTS.MIN_ENEMY_SPACING)) {
            enemiesToSpawn.push({ x: rightX, y: gameHeight * 0.5 - 100, type: 'archer', spawnSide: 'right', isArcher: true });
            spawnPositions.push({ x: rightX, y: gameHeight * 0.5 - 100 });
        }
    }
    if (waveNumber >= 9) {
        let leftLowX = gameWidth * 0.15;
        let rightLowX = gameWidth * 0.85;
        if (!spawnPositions.some(pos => Phaser.Math.Distance.Between(leftLowX, gameHeight * 0.75 - 100, pos.x, pos.y) < GAME_CONSTANTS.MIN_ENEMY_SPACING)) {
            enemiesToSpawn.push({ x: leftLowX, y: gameHeight * 0.75 - 100, type: 'archer', spawnSide: 'left', isArcher: true });
            spawnPositions.push({ x: leftLowX, y: gameHeight * 0.75 - 100 });
        }
        if (!spawnPositions.some(pos => Phaser.Math.Distance.Between(rightLowX, gameHeight * 0.75 - 100, pos.x, pos.y) < GAME_CONSTANTS.MIN_ENEMY_SPACING)) {
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
        if (this.physics.config.debug) {
            enemy.debugRect = this.add.rectangle(x, y, 48, 48, 0xff0000, 0.5).setDepth(1000);
            debugRects.push(enemy.debugRect);
        }
        console.log(`Spawned ${type} at (${x}, ${y}), active enemies: ${enemies.countActive(true)}`);
    }
}

function shootArrow(enemy) {
    if (!enemy.active || arrows.countActive(true) >= GAME_CONSTANTS.MAX_ARROWS) return;
    let arrow = arrows.get(enemy.x, enemy.y - 20);
    if (arrow) {
        arrow.setActive(true).setVisible(true)
            .body.setAllowGravity(false);
        const directionX = dragon.sprite.x - enemy.x;
        const directionY = dragon.sprite.y - enemy.y;
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, dragon.sprite.x, dragon.sprite.y);
        const velocityX = Math.cos(angle) * GAME_CONSTANTS.ARCHER_ARROW_SPEED;
        const velocityY = Math.sin(angle) * GAME_CONSTANTS.ARCHER_ARROW_SPEED;
        arrow.setVelocity(velocityX, velocityY)
            .setRotation(angle);
        if (this.sound.get('arrow_shot')) this.sound.get('arrow_shot').play();
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
    if (this.sound.get('coin_steal')) this.sound.get('coin_steal').play();
}

function hitEnemy(fireball, enemy) {
    fireball.destroy();
    if (enemy.jumpTimer) enemy.jumpTimer.remove();
    if (enemy.shootTimer) {
        enemy.shootTimer.remove();
        enemy.shootTimer = null;
    }
    if (enemy.platformCollider) {
        this.physics.world.removeCollider(enemy.platformCollider);
        enemy.platformCollider = null;
    }
    if (enemy.coinSprite) enemy.coinSprite.destroy();
    if (enemy.debugRect) enemy.debugRect.destroy();
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
    if (this.sound.get('bonus_collect')) this.sound.get('bonus_collect').play();
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
    });
    gameOverRect = this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, 0x000000, 0.7).setDepth(1000);
    gameOverText = this.add.text(gameWidth / 2, gameHeight / 2, // Центрируем по горизонтали и вертикали
        `${message}\nWave: ${waveNumber}\nScore: ${score}\nTap to Restart (or press R)`,
        {
            fontFamily: 'MedievalSharp',
            fontSize: '60px', // Увеличенный размер
            color: '#ff0000', // Красный цвет
            align: 'center', // Центрирование текста
            stroke: '#ffd700', // Золотая обводка
            strokeThickness: 6,
            shadow: { offsetX: 3, offsetY: 3, color: '#000', blur: 5, stroke: true, fill: true } // Тень для эффекта
        }).setOrigin(0.5) // Устанавливаем центр текста как точку отсчёта
        .setDepth(1001);
}

function restartGame() {
    this.scene.restart();
    treasureHealth = GAME_CONSTANTS.INITIAL_TREASURE_HP;
    score = 0;
    waveNumber = 0;
    gameStarted = false;
    debugRects.forEach(rect => rect.destroy());
    debugRects = [];
    enemies.clear(true, true);
    fireballs.clear(true, true);
    bonuses.clear(true, true);
    arrows.clear(true, true);
    enemiesToSpawn = [];
    waveTimer = null;
    spawnQueueTimer = null;
    virtualCursors = null; // Сбрасываем virtualCursors при рестарте
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
            if (child.type === 'Text') child.setPosition(gameWidth / 2, child.y === gameHeight / 2 - 50 ? gameHeight / 2 - 50 : gameHeight / 2 + 50);
            else child.setPosition(gameWidth / 2, gameHeight / 2).setDisplaySize(gameWidth, gameHeight);
        });
        return;
    }

    platforms.getChildren().forEach(platform => {
        if (platform.y > gameHeight * 0.9) platform.setPosition(platform.x, gameHeight - GAME_CONSTANTS.TILE_SIZE / 2);
        else if (platform.y < gameHeight * 0.6 && platform.y > gameHeight * 0.7) platform.setPosition(platform.x, gameHeight * 0.75 - GAME_CONSTANTS.TILE_SIZE / 2);
        else if (platform.y < gameHeight * 0.6 && platform.y > gameHeight * 0.4) platform.setPosition(platform.x, gameHeight * 0.5 - GAME_CONSTANTS.TILE_SIZE / 2);
        platform.refreshBody();
        if (platform.debugRect) platform.debugRect.setPosition(platform.x, platform.y);
    });

    treasure.setPosition(gameWidth / 2, gameHeight * GAME_CONSTANTS.TREASURE_Y);
    dragon.sprite.setPosition(gameWidth / 2, gameHeight * GAME_CONSTANTS.DRAGON_START_Y);
    if (dragon.debugRect) dragon.debugRect.setPosition(dragon.sprite.x, dragon.sprite.y);
    uiElements.hpText.setPosition(gameWidth / 2 - 50, gameHeight * GAME_CONSTANTS.UI_HP_Y);
    uiElements.scoreText.setPosition(gameWidth * GAME_CONSTANTS.UI_SCORE_X, gameHeight * 0.033);
    uiElements.dragonHpText.setPosition(gameWidth * GAME_CONSTANTS.UI_DRAGON_HP_X - 50, gameHeight * 0.033);
    uiElements.waveText.setPosition(gameWidth / 2, gameHeight * GAME_CONSTANTS.UI_WAVE_Y);
}

function decreaseTreasureHealth() {
    let treasureDamaged = false;
    enemies.getChildren().forEach(enemy => {
        if (!enemy.active || enemy.getData('hasCoin')) return;
        const distance = Phaser.Math.Distance.Between(treasure.x, treasure.y, enemy.x, enemy.y);
        if (distance < GAME_CONSTANTS.TREASURE_DAMAGE_RADIUS) {
            treasureDamaged = true;
        }
    });
    if (treasureDamaged) {
        treasureHealth = Math.max(0, treasure.getData('health') - 1);
        treasure.setData('health', treasureHealth);
    }
}