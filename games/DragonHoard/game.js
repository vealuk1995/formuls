// Константы игры: основные параметры игрового процесса
const GAME_CONSTANTS = {
    DRAGON_SPEED: 160,              // Скорость движения дракона по горизонтали (пикселей/сек)
    DRAGON_JUMP: -450,              // Сила прыжка дракона (отрицательное для движения вверх)
    DRAGON_MAX_HEALTH: 3,           // Максимальное здоровье дракона
    FIREBALL_SPEED: 400,            // Скорость полета огненного шара
    INITIAL_TREASURE_HP: 100,       // Начальное здоровье сокровища
    ENEMY_SPEED: 100,               // Скорость движения врагов
    TILE_SIZE: 32,                  // Размер плитки платформы (пикселей)
    GRAVITY_Y: 500,                 // Сила гравитации по оси Y
    MAX_ENEMIES: 15,                // Максимальное количество врагов одновременно
    MAX_FIREBALLS: 50,              // Максимальное количество огненных шаров
    MAX_BONUSES: 10,                // Максимальное количество бонусов
    MAX_ARROWS: 20,                 // Максимальное количество стрел лучников
    DRAGON_START_Y: 0.83,           // Начальная позиция дракона по Y (83% от верха экрана)
    TREASURE_Y: 0.92,               // Позиция сокровища по Y (92% от верха)
    UI_HP_Y: 0.08,                  // Позиция текста здоровья сокровища по Y
    UI_SCORE_X: 0.025,              // Позиция текста счета по X
    UI_WAVE_Y: 0.066,               // Позиция текста волны по Y
    UI_DRAGON_HP_X: 0.9,            // Позиция текста здоровья дракона по X
    BUTTON_SIZE_FACTOR: 0.1,        // Фактор размера кнопок для мобильных устройств
    WAVE_PAUSE_DURATION: 3000,      // Пауза между волнами (3 секунды)
    ENEMY_SPAWN_DELAY: 2000,        // Задержка между спавном врагов (1 секунда)
    ASPECT_RATIO: 16 / 9,           // Соотношение сторон экрана
    BONUS_HP_RESTORE: 10,           // Восстановление здоровья сокровища при сборе бонуса
    BONUS_LIFE_RESTORE: 1,          // Добавление жизни дракону при сборе бонуса
    TREASURE_DAMAGE_RADIUS: 50,     // Радиус урона сокровищу от врагов
    TREASURE_HP_LOSS_RATE: 100,     // Частота уменьшения здоровья сокровища (1 секунда)
    ARCHER_ARROW_SPEED: 300,        // Скорость полета стрелы лучника
    ARCHER_SHOOT_DELAY: 2000        // Задержка между выстрелами лучника (2 секунды)
};

// Конфигурация Phaser
const config = {
    type: Phaser.WEBGL,             // Используем WebGL для рендеринга
    parent: 'game-container',       // ID контейнера в HTML
    width: 1280,                    // Базовая ширина экрана
    height: 720,                    // Базовая высота экрана
    scale: {
        mode: Phaser.Scale.FIT,     // Адаптивное масштабирование
        autoCenter: Phaser.Scale.CENTER_BOTH // Центрирование
    },
    physics: {
        default: 'arcade',          // Аркадная физика
        arcade: {
            gravity: { y: GAME_CONSTANTS.GRAVITY_Y }, // Гравитация по Y
            debug:false           // Режим отладки (можно переключать)
        }
    },
    scene: { preload, create, update } // Основные функции сцены
};

const game = new Phaser.Game(config);

// Глобальные переменные
let dragon, treasure, platforms, enemies, fireballs, bonuses, arrows, cursors;
let score = 0, treasureHealth = GAME_CONSTANTS.INITIAL_TREASURE_HP, waveCount = 0;
let gameWidth, gameHeight, uiElements, gameOverText, gameOverRect, startScreenText, startScreenRect, progressBar, progressScroll, startButton;
let isGameStarted = false, isWaveInProgress = false, isLoaded = false;
let debugRects = []; // Массив для хранения отладочных прямоугольников
let wavePauseText;
let treasureDamageTimer;
let waveCountdownTimer;

// Класс дракона
class Dragon {
    constructor(scene, x, y, fireballs) {
        this.scene = scene; // Ссылка на сцену
        this.fireballs = fireballs; // Группа огненных шаров
        this.sprite = scene.physics.add.sprite(x, y, 'dragon', 0)
            .setBounce(0.2) // Легкий отскок при падении
            .setCollideWorldBounds(true); // Ограничение границами мира
        this.sprite.body.setSize(64, 64); // Размер физического тела
        this.sprite.setData('health', GAME_CONSTANTS.DRAGON_MAX_HEALTH); // Начальное здоровье
        this.sprite.setData('invulnerable', false); // Флаг неуязвимости
        this.lastDirection = 1; // Последнее направление движения
        scene.physics.add.collider(this.sprite, platforms); // Столкновение с платформами
        // Отладочный прямоугольник (только если debug включен)
        if (this.scene.physics.config.debug) {
            this.debugRect = scene.add.rectangle(x, y, 64, 64, 0x800080, 0.5).setDepth(1000);
            debugRects.push(this.debugRect);
        }
    }

    // Управление движением дракона
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

        // Обновляем позицию отладочного прямоугольника, если он существует
        if (this.debugRect) this.debugRect.setPosition(this.sprite.body.x + 32, this.sprite.body.y + 32);
    }

    // Стрельба огненным шаром
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
            fireball.body.setOffset(this.lastDirection === -1 ? 36 : 0, 0);
            this.scene.physics.add.collider(fireball, platforms, () => fireball.destroy());
            if (this.scene.sound.get('fireball_sound')) this.scene.sound.get('fireball_sound').play();
        }
    }

    // Получение урона
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

    // Уничтожение дракона
    destroy() {
        this.sprite.destroy();
        if (this.debugRect) this.debugRect.destroy();
    }
}

// Загрузка ресурсов
function preload() {
    console.log('Starting preload...');
    this.load.on('progress', value => {
        console.log(`Loading progress: ${Math.round(value * 100)}%`);
        if (progressBar) progressBar.scaleX = value;
    });
    this.load.on('fileprogress', file => console.log(`Loading file: ${file.key}`));
    this.load.on('complete', () => {
        console.log('All files loaded successfully');
        isLoaded = true;
    });
    this.load.on('fileerror', file => console.error(`Failed to load file: ${file.key}`));

    // Загрузка спрайтов и звуков
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

// Создание игровой сцены
function create() {
    console.log('Starting create...');
    gameWidth = this.scale.width;
    gameHeight = this.scale.height;

    this.add.image(gameWidth / 2, gameHeight / 2, 'cave_bg').setDisplaySize(gameWidth, gameHeight); // Фон пещеры
    platforms = createPlatforms(this, gameWidth, gameHeight); // Создание платформ
    treasure = this.physics.add.staticSprite(gameWidth / 2, gameHeight * GAME_CONSTANTS.TREASURE_Y, 'treasure')
        .setData('health', treasureHealth); // Сокровище

    // Элементы начального экрана
    startScreenRect = this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, 0x000000, 0.5);
    startScreenText = this.add.text(gameWidth / 2 - 150, gameHeight / 2 - 100,
        "Dragon's Hoard\nLoading...",
        { fontFamily: 'MedievalSharp', fontSize: '50px', color: '#ffd700', align: 'center' });
    progressScroll = this.add.rectangle(gameWidth / 2, gameHeight / 2 + 50, gameWidth * 0.5, 40, 0x8b4513).setOrigin(0.5);
    progressBar = this.add.rectangle(gameWidth / 2 - (gameWidth * 0.25), gameHeight / 2 + 50, 0, 30, 0xffff00).setOrigin(0, 0.5);

    startButton = this.add.rectangle(gameWidth / 2, gameHeight / 2 + 150, 200, 80, 0x00ff00)
        .setInteractive({ useHandCursor: true })
        .setVisible(false);
    this.add.text(gameWidth / 2 - 40, gameHeight / 2 + 130, "Start",
        { fontFamily: 'MedievalSharp', fontSize: '30px', color: '#000000' });

    startButton.on('pointerdown', startGame, this);
    startButton.on('pointerup', startGame, this);

    this.load.once('complete', () => {
        startScreenText.setText("Dragon's Hoard\nPress ENTER or Tap to Start");
        startButton.setVisible(true);
    });

    // UI элементы
    uiElements = {
        hpText: this.add.text(gameWidth / 2 - 50, gameHeight * GAME_CONSTANTS.UI_HP_Y, `Treasure HP: ${treasureHealth}`, { fontSize: '20px', color: '#fff' }),
        scoreText: this.add.text(gameWidth * GAME_CONSTANTS.UI_SCORE_X, gameHeight * 0.033, 'Score: 0', { fontSize: '20px', color: '#fff' }),
        waveText: this.add.text(gameWidth * GAME_CONSTANTS.UI_SCORE_X, gameHeight * GAME_CONSTANTS.UI_WAVE_Y, 'Wave: 1', { fontSize: '20px', color: '#fff' }),
        dragonHpText: this.add.text(gameWidth * GAME_CONSTANTS.UI_DRAGON_HP_X - 50, gameHeight * 0.033, `Dragon HP: ${GAME_CONSTANTS.DRAGON_MAX_HEALTH}`, { fontSize: '20px', color: '#fff' })
    };

    wavePauseText = this.add.text(gameWidth / 2 - 150, gameHeight / 2, '',
        { fontFamily: 'MedievalSharp', fontSize: '40px', color: '#ffd700', align: 'center' })
        .setVisible(false);

    // Создание групп объектов
    fireballs = this.physics.add.group({ defaultKey: 'fireball', maxSize: GAME_CONSTANTS.MAX_FIREBALLS, gravityY: 0 });
    enemies = this.physics.add.group({ maxSize: GAME_CONSTANTS.MAX_ENEMIES });
    bonuses = this.physics.add.group({ maxSize: GAME_CONSTANTS.MAX_BONUSES });
    arrows = this.physics.add.group({ defaultKey: 'arrow', maxSize: GAME_CONSTANTS.MAX_ARROWS, gravityY: 0 });

    dragon = new Dragon(this, gameWidth / 2, gameHeight * GAME_CONSTANTS.DRAGON_START_Y, fireballs);

    // Создание анимаций
    this.anims.create({ key: 'dragon_idle', frames: this.anims.generateFrameNumbers('dragon', { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
    this.anims.create({ key: 'dragon_walk', frames: this.anims.generateFrameNumbers('dragon', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'knight_walk', frames: this.anims.generateFrameNumbers('knight', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'griffin_walk', frames: this.anims.generateFrameNumbers('griffin', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'archer_walk', frames: this.anims.generateFrameNumbers('archer', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'fireball_fly', frames: this.anims.generateFrameNumbers('fireball', { start: 0, end: 2 }), frameRate: 15, repeat: -1 });

    cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-SPACE', () => dragon.shoot(), this);
    this.input.keyboard.on('keydown-R', () => restartGame.call(this));
    this.input.keyboard.on('keydown-ENTER', () => startGame.call(this));

    // Настройка физических взаимодействий
    this.physics.add.collider(enemies, platforms);
    this.physics.add.overlap(enemies, treasure, stealCoin, null, this);
    this.physics.add.overlap(fireballs, enemies, hitEnemy, null, this);
    this.physics.add.overlap(dragon.sprite, bonuses, collectBonus, null, this);
    this.physics.add.overlap(dragon.sprite, enemies, dragonDeath, null, this);
    this.physics.add.overlap(dragon.sprite, arrows, arrowHitDragon, null, this);
    this.physics.add.collider(bonuses, platforms);

    treasureDamageTimer = this.time.addEvent({
        delay: GAME_CONSTANTS.TREASURE_HP_LOSS_RATE,
        callback: decreaseTreasureHealth,
        callbackScope: this,
        loop: true,
        paused: true
    });

    hideGameElements.call(this);
    this.scale.on('resize', resize, this);
    console.log('Create finished.');
}

// Обновление состояния игры
function update() {
    if (!isGameStarted) return;

    dragon.move(cursors); // Управление драконом всегда активно

    if (isWaveInProgress) {
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
    }

    fireballs.children.each(fireball => {
        if (fireball.x < 0 || fireball.x > gameWidth) fireball.destroy();
    });

    arrows.children.each(arrow => {
        if (arrow.x < 0 || arrow.x > gameWidth) arrow.destroy();
    });

    updateUI();

    if (treasure.getData('health') <= 0) gameOver.call(this, 'Treasure Lost');

    if (enemies.countActive() === 0 && treasure.getData('health') > 0 && isWaveInProgress) {
        isWaveInProgress = false;
        startWavePause.call(this);
    }
}

// Создание платформ
function createPlatforms(scene, width, height) {
    let platforms = scene.physics.add.staticGroup();
    const tileSize = GAME_CONSTANTS.TILE_SIZE;

    // Нижний уровень (пол)
    for (let x = 0; x < width; x += tileSize) {
        let platform = platforms.create(x + tileSize / 2, height - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        // Отладочный прямоугольник только при включенном debug
        if (scene.physics.config.debug) {
            platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
            debugRects.push(platform.debugRect);
        }
    }

    // Левая платформа 75%
    for (let x = 0; x < 7 * tileSize; x += tileSize) {
        let platform = platforms.create(width * 0.15 - 3.5 * tileSize + x + tileSize / 2, height * 0.75 - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        if (scene.physics.config.debug) {
            platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
            debugRects.push(platform.debugRect);
        }
    }

    // Правая платформа 75%
    for (let x = 0; x < 8 * tileSize; x += tileSize) {
        let platform = platforms.create(width * 0.85 - 4 * tileSize + x + tileSize / 2, height * 0.75 - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        if (scene.physics.config.debug) {
            platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
            debugRects.push(platform.debugRect);
        }
    }

    // Левая платформа 50%
    for (let x = 0; x < 5 * tileSize; x += tileSize) {
        let platform = platforms.create(width * 0.1875 - 2.5 * tileSize + x + tileSize / 2, height * 0.5 - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        if (scene.physics.config.debug) {
            platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
            debugRects.push(platform.debugRect);
        }
    }

    // Правая платформа 50%
    for (let x = 0; x < 4 * tileSize; x += tileSize) {
        let platform = platforms.create(width * 0.8125 - 2 * tileSize + x + tileSize / 2, height * 0.5 - tileSize / 2, 'platform_tile')
            .setDisplaySize(tileSize, tileSize)
            .refreshBody();
        if (scene.physics.config.debug) {
            platform.debugRect = scene.add.rectangle(platform.x, platform.y, tileSize, tileSize, 0xffff00, 0.5).setDepth(1000);
            debugRects.push(platform.debugRect);
        }
    }

    // Центральная платформа 62.5%
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

    console.log('Platforms created:', platforms.getChildren().map(p => `x: ${p.x}, y: ${p.y}`));
    return platforms;
}

// Создание волны врагов
function spawnWave() {
    isWaveInProgress = true;
    let enemyCount = Math.min(3 + waveCount * 2, 10);
    let platformHeights = [gameHeight * 0.5 - 100, gameHeight * 0.75 - 100, gameHeight - 100];
    let enemiesToSpawn = [];

    for (let i = 0; i < enemyCount; i++) {
        let type = Math.random() < 0.5 ? 'knight' : 'griffin';
        let y = Phaser.Math.RND.pick(platformHeights);
        let x = Math.random() < 0.5 ? gameWidth * 0.0625 : gameWidth * 0.9375;
        enemiesToSpawn.push({ x, y, type, spawnSide: x < gameWidth / 2 ? 'left' : 'right' });
    }

    // Добавление лучников
    if (waveCount === 2) {
        enemiesToSpawn.push({
            x: gameWidth * 0.5,
            y: gameHeight * 0.625 - 100,
            type: 'archer',
            spawnSide: 'center',
            isArcher: true
        });
    } else if (waveCount === 5) {
        enemiesToSpawn.push({
            x: gameWidth * 0.15,
            y: gameHeight * 0.75 - 100,
            type: 'archer',
            spawnSide: 'left',
            isArcher: true
        });
        enemiesToSpawn.push({
            x: gameWidth * 0.85,
            y: gameHeight * 0.75 - 100,
            type: 'archer',
            spawnSide: 'right',
            isArcher: true
        });
    } else if (waveCount >= 8) {
        enemiesToSpawn.push({
            x: gameWidth * 0.1875,
            y: gameHeight * 0.5 - 100,
            type: 'archer',
            spawnSide: 'left',
            isArcher: true
        });
        enemiesToSpawn.push({
            x: gameWidth * 0.8125,
            y: gameHeight * 0.5 - 100,
            type: 'archer',
            spawnSide: 'right',
            isArcher: true
        });
        enemiesToSpawn.push({
            x: gameWidth * 0.15,
            y: gameHeight * 0.75 - 100,
            type: 'archer',
            spawnSide: 'left',
            isArcher: true
        });
        enemiesToSpawn.push({
            x: gameWidth * 0.85,
            y: gameHeight * 0.75 - 100,
            type: 'archer',
            spawnSide: 'right',
            isArcher: true
        });
    }

    let spawnIndex = 0;
    this.time.addEvent({
        delay: GAME_CONSTANTS.ENEMY_SPAWN_DELAY,
        callback: () => {
            if (spawnIndex < enemiesToSpawn.length) {
                spawnEnemy.call(this, enemiesToSpawn[spawnIndex].x, enemiesToSpawn[spawnIndex].y, 
                    enemiesToSpawn[spawnIndex].type, enemiesToSpawn[spawnIndex].spawnSide, 
                    enemiesToSpawn[spawnIndex].isArcher);
                spawnIndex++;
            }
        },
        repeat: enemiesToSpawn.length - 1
    });
}

// Создание одного врага
function spawnEnemy(x, y, type, spawnSide, isArcher = false) {
    let enemy = enemies.get(x, y, type);
    if (enemy) {
        enemy.setActive(true).setVisible(true)
            .setCollideWorldBounds(true);
        enemy.body.setSize(48, 48);
        enemy.setData('hasCoin', false);
        enemy.setData('spawnSide', spawnSide);
        enemy.setData('isArcher', isArcher);
        enemy.platformCollider = this.physics.add.collider(enemy, platforms);
        // Отладочный прямоугольник только при включенном debug
        if (this.physics.config.debug) {
            enemy.debugRect = this.add.rectangle(x, y, 48, 48, 0xff0000, 0.5).setDepth(1000);
            debugRects.push(enemy.debugRect);
        }
    }
}

// Стрельба лучника
function shootArrow(enemy) {
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

// Попадание стрелы в дракона
function arrowHitDragon(dragonSprite, arrow) {
    arrow.destroy();
    if (dragon.takeDamage()) gameOver.call(this, 'Dragon Defeated');
}

// Враг крадет монету
function stealCoin(enemy, treasure) {
    if (!enemy.getData('hasCoin') && !enemy.getData('isArcher')) {
        enemy.setData('hasCoin', true);
        enemy.coinSprite = this.add.image(enemy.x, enemy.y - 20, 'coin').setScale(0.5);
        if (this.sound.get('coin_steal')) this.sound.get('coin_steal').play();
    }
}

// Уничтожение врага огненным шаром
function hitEnemy(fireball, enemy) {
    fireball.destroy();
    if (enemy.jumpTimer) enemy.jumpTimer.remove();
    if (enemy.shootTimer) enemy.shootTimer.remove();
    enemy.destroy();
    if (enemy.coinSprite) enemy.coinSprite.destroy();
    if (enemy.debugRect) enemy.debugRect.destroy();
    score += 10;
    if (Math.random() < 0.2) spawnBonus(enemy.x, enemy.y);
}

// Создание бонуса
function spawnBonus(x, y) {
    let bonus = bonuses.get(x, y, 'crystal_bonus');
    if (bonus) {
        bonus.setActive(true).setVisible(true)
            .setVelocityY(100);
    }
}

// Сбор бонуса
function collectBonus(dragonSprite, bonus) {
    if (bonus.getData('isWaveBonus')) {
        treasureHealth = Math.min(GAME_CONSTANTS.INITIAL_TREASURE_HP, treasure.getData('health') + GAME_CONSTANTS.BONUS_HP_RESTORE);
        treasure.setData('health', treasureHealth);
        let dragonHealth = Math.min(GAME_CONSTANTS.DRAGON_MAX_HEALTH, dragon.sprite.getData('health') + GAME_CONSTANTS.BONUS_LIFE_RESTORE);
        dragon.sprite.setData('health', dragonHealth);
    } else {
        dragonSprite.setVelocityX(dragonSprite.body.velocity.x * 1.5);
        this.time.delayedCall(5000, () => dragonSprite.setVelocityX(dragonSprite.body.velocity.x / 1.5));
    }
    bonus.destroy();
    if (this.sound.get('bonus_collect')) this.sound.get('bonus_collect').play();
}

// Смерть дракона от врага
function dragonDeath(dragonSprite, enemy) {
    if (dragon.takeDamage()) gameOver.call(this, 'Dragon Defeated');
}

// Конец игры
function gameOver(message) {
    this.physics.pause();
    gameOverRect = this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, 0x000000, 0.7);
    gameOverText = this.add.text(gameWidth / 2 - 150, gameHeight / 2 - 50,
        `${message}\nScore: ${score}\nWaves: ${waveCount}\nPress R to Restart`,
        { fontSize: '40px', color: '#ff0000', align: 'center' });
}

// Перезапуск игры
function restartGame() {
    this.scene.restart();
    treasureHealth = GAME_CONSTANTS.INITIAL_TREASURE_HP;
    score = 0;
    waveCount = 0;
    isGameStarted = false;
    isWaveInProgress = false;
    isLoaded = false;
    debugRects.forEach(rect => rect.destroy()); // Уничтожаем все отладочные прямоугольники
    debugRects = [];
    enemies.clear(true, true);
    fireballs.clear(true, true);
    bonuses.clear(true, true);
    arrows.clear(true, true);
    treasureDamageTimer.paused = true;
    if (waveCountdownTimer) waveCountdownTimer.remove();
}

// Обновление интерфейса
function updateUI() {
    uiElements.hpText.setText(`Treasure HP: ${treasure.getData('health')}`);
    uiElements.scoreText.setText(`Score: ${score}`);
    uiElements.waveText.setText(`Wave: ${waveCount + 1}`);
    uiElements.dragonHpText.setText(`Dragon HP: ${dragon.sprite.getData('health')}`);
}

// Адаптация размеров экрана
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
    if (dragon.debugRect) dragon.debugRect.setPosition(dragon.sprite.x, dragon.sprite.y);
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

// Скрытие игровых элементов перед стартом
function hideGameElements() {
    dragon.sprite.setVisible(false);
    uiElements.hpText.setVisible(false);
    uiElements.scoreText.setVisible(false);
    uiElements.waveText.setVisible(false);
    uiElements.dragonHpText.setVisible(false);
}

// Старт игры
function startGame() {
    if (isGameStarted || !isLoaded) return;
    console.log('Starting game...');
    isGameStarted = true;

    if (this.sound.context.state === 'suspended') this.sound.context.resume();

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
    treasureDamageTimer.paused = false;
    spawnWave.call(this);
    if (typeof window.initMobileControls === 'function') window.initMobileControls(this);
}

// Пауза между волнами с отсчетом
function startWavePause() {
    treasureDamageTimer.paused = true;

    const bonusX = gameWidth * 0.1875 + 2 * GAME_CONSTANTS.TILE_SIZE;
    const bonusY = gameHeight * 0.5 - GAME_CONSTANTS.TILE_SIZE - 50;
    spawnWaveBonus.call(this, bonusX, bonusY);

    let countdown = Math.floor(GAME_CONSTANTS.WAVE_PAUSE_DURATION / 1000);
    wavePauseText.setText(`Wave ${waveCount + 1} Cleared!\nNext wave in ${countdown}...`)
        .setVisible(true);

    waveCountdownTimer = this.time.addEvent({
        delay: 1000,
        callback: () => {
            countdown--;
            if (countdown > 0) {
                wavePauseText.setText(`Wave ${waveCount + 1} Cleared!\nNext wave in ${countdown}...`);
            } else {
                wavePauseText.setVisible(false);
                treasureDamageTimer.paused = false;
                waveCount++;
                spawnWave.call(this);
                waveCountdownTimer.remove();
            }
        },
        callbackScope: this,
        repeat: countdown - 1
    });
}

// Создание бонуса после волны
function spawnWaveBonus(x, y) {
    let bonus = bonuses.get(x, y, 'crystal_bonus');
    if (bonus) {
        bonus.setActive(true).setVisible(true)
            .setVelocityY(100)
            .setData('isWaveBonus', true);
    }
}

// Уменьшение здоровья сокровища
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
