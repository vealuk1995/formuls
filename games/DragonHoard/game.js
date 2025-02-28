// Константы игры определяют основные параметры и настройки игрового процесса
const GAME_CONSTANTS = {
    DRAGON_SPEED: 160, // Скорость передвижения дракона по горизонтали (пикселей/сек), уменьшено на 20% от исходных 200
    DRAGON_JUMP: -450, // Сила прыжка дракона (отрицательное значение для движения вверх), уменьшено на 20% от исходных -562.5
    DRAGON_MAX_HEALTH: 3, // Максимальное здоровье дракона
    FIREBALL_SPEED: 400, // Скорость полета огненного шара (пикселей/сек), уменьшено на 20% от исходных 500
    INITIAL_TREASURE_HP: 100, // Начальное здоровье сокровища
    ENEMY_SPEED: 100, // Скорость передвижения врагов (пикселей/сек), уменьшено на 20% от исходных 300
    TILE_SIZE: 32, // Размер одной плитки платформы в пикселях
    GRAVITY_Y: 500, // Сила гравитации по оси Y (пикселей/сек^2), влияет на падение объектов
    MAX_ENEMIES: 15, // Максимальное количество врагов в игре одновременно
    MAX_FIREBALLS: 50, // Максимальное количество огненных шаров в игре одновременно
    MAX_BONUSES: 10, // Максимальное количество бонусов в игре одновременно
    DRAGON_START_Y: 0.83, // Начальная позиция дракона по оси Y относительно высоты экрана (83% от верха)
    TREASURE_Y: 0.92, // Позиция сокровища по оси Y относительно высоты экрана (92% от верха)
    UI_HP_Y: 0.08, // Позиция текста здоровья сокровища по оси Y (8% от верха)
    UI_SCORE_X: 0.025, // Позиция текста счета по оси X (2.5% от левого края)
    UI_WAVE_Y: 0.066, // Позиция текста волны по оси Y (6.6% от верха)
    UI_DRAGON_HP_X: 0.9, // Позиция текста здоровья дракона по оси X (90% от левого края)
    BUTTON_SIZE_FACTOR: 0.1, // Фактор размера кнопок управления для мобильных устройств (10% от ширины экрана)
    WAVE_PAUSE_DURATION: 5000, // Пауза между волнами врагов в миллисекундах (5 секунд)
    ENEMY_SPAWN_DELAY: 2500, // Задержка между появлением врагов в волне (2.5 секунды)
    ASPECT_RATIO: 16 / 9 // Соотношение сторон экрана игры (16:9)
};

// Конфигурация для инициализации Phaser
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
            debug: true
        }
    },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let dragon, treasure, platforms, enemies, fireballs, bonuses, cursors;
let score = 0, treasureHealth = GAME_CONSTANTS.INITIAL_TREASURE_HP, waveCount = 0;
let gameWidth, gameHeight, uiElements, gameOverText, gameOverRect, startScreenText, startScreenRect, progressBar, progressScroll, startButton;
let isGameStarted = false, isWaveInProgress = false;
let debugRects = [];

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
        this.debugRect = scene.add.rectangle(x, y, 64, 64, 0x800080, 0.5).setDepth(1000);
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

        this.debugRect.setPosition(this.sprite.body.x + 32, this.sprite.body.y + 32);
    }

    shoot() {
        if (!this.fireballs) return;
        let fireball = this.fireballs.get(this.sprite.x, this.sprite.y);
        if (fireball) {
            fireball.setActive(true).setVisible(true)
                .body.allowGravity = false;
            fireball.body.setSize(36, 24);
            fireball.setVelocityX(this.lastDirection * GAME_CONSTANTS.FIREBALL_SPEED)
                .setScale(this.lastDirection, 1)
                .anims.play('fireball_fly', true);
            this.scene.physics.add.collider(fireball, platforms, () => fireball.destroy());
            this.scene.sound.get('fireball_sound')?.play();
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
        this.debugRect.destroy();
    }
}

function preload() {
    console.log('Starting preload...');
    this.load.on('progress', value => {
        console.log(`Loading progress: ${Math.round(value * 100)}%`);
        if (progressBar) progressBar.scaleX = value;
    });

    this.load.on('fileprogress', file => console.log(`Loading file: ${file.key}`));
    this.load.on('complete', () => console.log('All files loaded successfully'));

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
    console.log('Starting create...');
    gameWidth = this.scale.width;
    gameHeight = this.scale.height;

    this.add.image(gameWidth / 2, gameHeight / 2, 'cave_bg').setDisplaySize(gameWidth, gameHeight);
    platforms = createPlatforms(this, gameWidth, gameHeight);
    treasure = this.physics.add.staticSprite(gameWidth / 2, gameHeight * GAME_CONSTANTS.TREASURE_Y, 'treasure')
        .setData('health', treasureHealth);

    startScreenRect = this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, 0x000000, 0.5);
    startScreenText = this.add.text(gameWidth / 2 - 150, gameHeight / 2 - 100, 
        "Dragon's Hoard\nLoading...", 
        { fontFamily: 'MedievalSharp', fontSize: '50px', color: '#ffd700', align: 'center' });
    progressScroll = this.add.rectangle(gameWidth / 2, gameHeight / 2 + 50, gameWidth * 0.5, 40, 0x8b4513).setOrigin(0.5);
    progressBar = this.add.rectangle(gameWidth / 2 - (gameWidth * 0.25), gameHeight / 2 + 50, 0, 30, 0xffff00).setOrigin(0, 0.5);

    // Создаем кнопку "Старт" и делаем её интерактивной для всех устройств
    startButton = this.add.rectangle(gameWidth / 2, gameHeight / 2 + 150, 200, 80, 0x00ff00)
        .setInteractive({ useHandCursor: true }) // Добавляем курсор руки и поддержку сенсорных событий
        .setVisible(false);
    this.add.text(gameWidth / 2 - 40, gameHeight / 2 + 130, "Start", 
        { fontFamily: 'MedievalSharp', fontSize: '30px', color: '#000000' });

    // Обработчики для мыши и сенсорных устройств
    startButton.on('pointerdown', () => startGame.call(this));
    startButton.on('pointerup', () => startGame.call(this)); // Дополнительно для сенсорных устройств

    this.load.once('complete', () => {
        startScreenText.setText("Dragon's Hoard\nPress ENTER or Tap to Start");
        startButton.setVisible(true);
    });

    uiElements = {
        hpText: this.add.text(gameWidth / 2 - 50, gameHeight * GAME_CONSTANTS.UI_HP_Y, `Treasure HP: ${treasureHealth}`, { fontSize: '20px', color: '#fff' }),
        scoreText: this.add.text(gameWidth * GAME_CONSTANTS.UI_SCORE_X, gameHeight * 0.033, 'Score: 0', { fontSize: '20px', color: '#fff' }),
        waveText: this.add.text(gameWidth * GAME_CONSTANTS.UI_SCORE_X, gameHeight * GAME_CONSTANTS.UI_WAVE_Y, 'Wave: 1', { fontSize: '20px', color: '#fff' }),
        dragonHpText: this.add.text(gameWidth * GAME_CONSTANTS.UI_DRAGON_HP_X - 50, gameHeight * 0.033, `Dragon HP: ${GAME_CONSTANTS.DRAGON_MAX_HEALTH}`, { fontSize: '20px', color: '#fff' })
    };

    fireballs = this.physics.add.group({ defaultKey: 'fireball', maxSize: GAME_CONSTANTS.MAX_FIREBALLS, gravityY: 0 });
    enemies = this.physics.add.group({ maxSize: GAME_CONSTANTS.MAX_ENEMIES });
    bonuses = this.physics.add.group({ maxSize: GAME_CONSTANTS.MAX_BONUSES });

    dragon = new Dragon(this, gameWidth / 2, gameHeight * GAME_CONSTANTS.DRAGON_START_Y, fireballs);

    this.anims.create({ key: 'dragon_idle', frames: this.anims.generateFrameNumbers('dragon', { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
    this.anims.create({ key: 'dragon_walk', frames: this.anims.generateFrameNumbers('dragon', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'knight_walk', frames: this.anims.generateFrameNumbers('knight', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'griffin_walk', frames: this.anims.generateFrameNumbers('griffin', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'fireball_fly', frames: this.anims.generateFrameNumbers('fireball', { start: 0, end: 2 }), frameRate: 15, repeat: -1 });

    cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-SPACE', () => dragon.shoot(), this);
    this.input.keyboard.on('keydown-R', () => restartGame.call(this));
    this.input.keyboard.on('keydown-ENTER', () => startGame.call(this));

    this.physics.add.collider(enemies, platforms);
    this.physics.add.overlap(enemies, treasure, stealCoin, null, this);
    this.physics.add.overlap(fireballs, enemies, hitEnemy, null, this);
    this.physics.add.overlap(dragon.sprite, bonuses, collectBonus, null, this);
    this.physics.add.overlap(dragon.sprite, enemies, dragonDeath, null, this);
    this.physics.add.collider(bonuses, platforms);

    hideGameElements.call(this);
    this.scale.on('resize', resize, this);
    console.log('Create finished.');
}

function update() {
    if (!isGameStarted) return;

    dragon.move(cursors);

    enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        let hasCoin = enemy.getData('hasCoin') || false;
        let spawnSide = enemy.getData('spawnSide') || 'left';

        if (hasCoin) {
            enemy.body.setAllowGravity(false);
            enemy.body.setVelocity(0, 0);
            if (enemy.platformCollider) {
                this.physics.world.removeCollider(enemy.platformCollider);
                enemy.platformCollider = null;
            }
            enemy.setY(gameHeight * GAME_CONSTANTS.TREASURE_Y - 48);
            enemy.setVelocityX(spawnSide === 'left' ? -GAME_CONSTANTS.ENEMY_SPEED : GAME_CONSTANTS.ENEMY_SPEED)
                .setScale(spawnSide === 'left' ? -1 : 1, 1);
        } else {
            enemy.body.setAllowGravity(true);
            if (!enemy.platformCollider) {
                enemy.platformCollider = this.physics.add.collider(enemy, platforms);
            }
            let directionX = treasure.x - enemy.x;
            enemy.setVelocityX(directionX > 0 ? GAME_CONSTANTS.ENEMY_SPEED : -GAME_CONSTANTS.ENEMY_SPEED)
                .setScale(directionX > 0 ? 1 : -1, 1);
        }

        enemy.anims.play(enemy.texture.key + '_walk', true);
        if (enemy.coinSprite) enemy.coinSprite.setPosition(enemy.x, enemy.y - 20);
        if (enemy.debugRect) enemy.debugRect.setPosition(enemy.x, enemy.y);

        if (!hasCoin && enemy.body.touching.down && Math.abs(enemy.x - treasure.x) > 50 && !enemy.jumpTimer) {
            enemy.jumpTimer = this.time.addEvent({
                delay: Phaser.Math.Between(2000, 5000),
                callback: () => {
                    if (enemy && enemy.active) enemy.setVelocityY(enemy.texture.key === 'griffin' ? -300 : -150);
                },
                loop: true
            });
        }

        if (hasCoin && (enemy.x <= 0 || enemy.x >= gameWidth)) {
            treasure.setData('health', treasure.getData('health') - 1);
            if (enemy.jumpTimer) enemy.jumpTimer.remove();
            enemy.destroy();
            if (enemy.coinSprite) enemy.coinSprite.destroy();
            if (enemy.debugRect) enemy.debugRect.destroy();
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
        });
    }
}

function createPlatforms(scene, width, height) {
    let platforms = scene.physics.add.staticGroup();
    const tileSize = GAME_CONSTANTS.TILE_SIZE;

    for (let x = 0; x < width; x += tileSize) {
        let platform = platforms.create(x + tileSize / 2, height - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
        debugRects.push(platform.debugRect);
    }

    for (let x = 0; x < 7 * tileSize; x += tileSize) {
        let platform = platforms.create(width * 0.15 - 3.5 * tileSize + x + tileSize / 2, height * 0.75 - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
        debugRects.push(platform.debugRect);
    }

    for (let x = 0; x < 8 * tileSize; x += tileSize) {
        let platform = platforms.create(width * 0.85 - 4 * tileSize + x + tileSize / 2, height * 0.75 - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
        debugRects.push(platform.debugRect);
    }

    for (let x = 0; x < 5 * tileSize; x += tileSize) {
        let platform = platforms.create(width * 0.1875 - 2.5 * tileSize + x + tileSize / 2, height * 0.5 - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
        debugRects.push(platform.debugRect);
    }

    for (let x = 0; x < 4 * tileSize; x += tileSize) {
        let platform = platforms.create(width * 0.8125 - 2 * tileSize + x + tileSize / 2, height * 0.5 - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
        debugRects.push(platform.debugRect);
    }

    for (let x = 0; x < 6 * tileSize; x += tileSize) {
        let platform = platforms.create(width * 0.5 - 3 * tileSize + x + tileSize / 2, height * 0.625 - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
        debugRects.push(platform.debugRect);
    }

    platforms.getChildren().forEach(platform => {
        if (!platform.texture || platform.texture.key === '__MISSING') {
            console.warn(`Platform at (${platform.x}, ${platform.y}) has no texture, using fallback.`);
            platform.setTexture(null).setFillStyle(0xff0000);
        }
    });

    console.log('Platforms created:', platforms.getChildren().map(p => `x: ${p.x}, y: ${p.y}`));
    return platforms;
}

function spawnWave() {
    isWaveInProgress = true;
    let enemyCount = Math.min(3 + waveCount, 5);
    let platformHeights = [gameHeight * 0.5 - 100, gameHeight * 0.75 - 100, gameHeight - 100];
    let enemiesToSpawn = [];

    for (let i = 0; i < enemyCount; i++) {
        let type = Math.random() < 0.5 ? 'knight' : 'griffin';
        let y = Phaser.Math.RND.pick(platformHeights);
        let x = Math.random() < 0.5 ? gameWidth * 0.0625 : gameWidth * 0.9375;
        enemiesToSpawn.push({ x, y, type, spawnSide: x < gameWidth / 2 ? 'left' : 'right' });
    }

    let spawnIndex = 0;
    this.time.addEvent({
        delay: GAME_CONSTANTS.ENEMY_SPAWN_DELAY,
        callback: () => {
            if (spawnIndex < enemiesToSpawn.length) {
                spawnEnemy.call(this, enemiesToSpawn[spawnIndex].x, enemiesToSpawn[spawnIndex].y, enemiesToSpawn[spawnIndex].type, enemiesToSpawn[spawnIndex].spawnSide);
                spawnIndex++;
            }
        },
        repeat: enemyCount - 1
    });
}

function spawnEnemy(x, y, type, spawnSide) {
    let enemy = enemies.get(x, y, type);
    if (enemy) {
        enemy.setActive(true).setVisible(true)
            .setCollideWorldBounds(true);
        enemy.body.setSize(48, 48);
        enemy.setData('hasCoin', false);
        enemy.setData('spawnSide', spawnSide);
        enemy.platformCollider = this.physics.add.collider(enemy, platforms);
        enemy.debugRect = this.add.rectangle(x, y, 48, 48, 0xff0000, 0.5).setDepth(1000);
        debugRects.push(enemy.debugRect);
    }
}

function stealCoin(enemy, treasure) {
    if (!enemy.getData('hasCoin')) {
        enemy.setData('hasCoin', true);
        enemy.coinSprite = this.add.image(enemy.x, enemy.y - 20, 'coin').setScale(0.5);
        this.sound.get('coin_steal')?.play();
    }
}

function hitEnemy(fireball, enemy) {
    fireball.destroy();
    if (enemy.jumpTimer) enemy.jumpTimer.remove();
    enemy.destroy();
    if (enemy.coinSprite) enemy.coinSprite.destroy();
    if (enemy.debugRect) enemy.debugRect.destroy();
    score += 10;
    if (Math.random() < 0.2) spawnBonus(enemy.x, enemy.y);
}

function spawnBonus(x, y) {
    let bonus = bonuses.get(x, y, 'crystal_bonus');
    if (bonus) {
        bonus.setActive(true).setVisible(true)
            .setVelocityY(100);
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
    this.scene.restart();
    treasureHealth = GAME_CONSTANTS.INITIAL_TREASURE_HP;
    score = 0;
    waveCount = 0;
    isGameStarted = false;
    isWaveInProgress = false;
    debugRects = [];
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

    this.children.list.find(child => child.texture && child.texture.key === 'cave_bg')
        ?.setPosition(gameWidth / 2, gameHeight / 2)
        .setDisplaySize(gameWidth, gameHeight);

    platforms.getChildren().forEach(platform => {
        if (platform.y > gameHeight * 0.9) platform.setPosition(platform.x, gameHeight - GAME_CONSTANTS.TILE_SIZE / 2);
        else if (platform.y < gameHeight * 0.6 && platform.y > gameHeight * 0.7) platform.setPosition(platform.x, gameHeight * 0.75 - GAME_CONSTANTS.TILE_SIZE / 2);
        else if (platform.y < gameHeight * 0.6 && platform.y > gameHeight * 0.4) platform.setPosition(platform.x, gameHeight * 0.5 - GAME_CONSTANTS.TILE_SIZE / 2);
        platform.refreshBody();
        if (platform.debugRect) platform.debugRect.setPosition(platform.x, platform.y);
    });

    treasure.setPosition(gameWidth / 2, gameHeight * GAME_CONSTANTS.TREASURE_Y);
    dragon.sprite.setPosition(gameWidth / 2, gameHeight * GAME_CONSTANTS.DRAGON_START_Y);
    dragon.debugRect.setPosition(dragon.sprite.x, dragon.sprite.y);
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

function hideGameElements() {
    dragon.sprite.setVisible(false);
    uiElements.hpText.setVisible(false);
    uiElements.scoreText.setVisible(false);
    uiElements.waveText.setVisible(false);
    uiElements.dragonHpText.setVisible(false);
}

function startGame() {
    if (isGameStarted || !this.load.isReady()) return;
    isGameStarted = true;

    if (this.sound.context.state === 'suspended') {
        this.sound.context.resume();
    }

    if (startScreenText) startScreenText.destroy();
    if (startScreenRect) startScreenRect.destroy();
    if (progressScroll) progressScroll.destroy();
    if (progressBar) progressBar.destroy();
    if (startButton) startButton.destroy();

    dragon.sprite.setVisible(true);
    uiElements.hpText.setVisible(true);
    uiElements.scoreText.setVisible(true);
    uiElements.waveText.setVisible(true);
    uiElements.dragonHpText.setVisible(true);

    this.physics.resume();
    spawnWave.call(this);

    // Вызываем функцию из mobile.js для добавления кнопок управления
    if (typeof window.initMobileControls === 'function') {
        window.initMobileControls(this);
    }
}