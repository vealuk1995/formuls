// Конфигурация игры Phaser
const config = {
    type: Phaser.AUTO, // Автоматический выбор рендера: WebGL или Canvas, в зависимости от браузера
    width: 800, // Ширина игрового экрана в пикселях
    height: 600, // Высота игрового экрана в пикселях
    physics: {
        default: 'arcade', // Используем физический движок Arcade для простоты
        arcade: {
            gravity: { y: 500 }, // Гравитация по оси Y (вниз), влияет на объекты с физикой
            debug: false // Отключение отладочных линий (границы объектов не видны)
        }
    },
    scene: {
        preload: preload, // Функция загрузки ресурсов (вызывается первой)
        create: create, // Функция создания объектов (вызывается второй)
        update: update // Функция обновления каждого кадра (вызывается постоянно)
    }
};

// Инициализация игры с заданной конфигурацией
const game = new Phaser.Game(config);

// Глобальные переменные для доступа из всех функций
let dragon; // Спрайт дракона (игрок)
let treasure; // Спрайт сокровищ (объект для защиты)
let platforms; // Группа статичных платформ
let enemies; // Группа врагов (рыцари и воры)
let fireballs; // Группа огненных шаров (снаряды дракона)
let bonuses; // Группа бонусов (кристаллы скорости)
let cursors; // Объект для управления клавишами
let score = 0; // Счёт игрока (очки за уничтожение врагов)
let treasureHealth = 100; // Здоровье сокровищ (уменьшается при атаке врагов)
let lastDirection = 1; // Последнее направление движения дракона (1 = вправо, -1 = влево)

function preload() {
    // Логирование начала загрузки ресурсов для отладки
    console.log('Starting resource loading...');
    
    // Загрузка изображений для игры
    this.load.image('dragon', 'assets/sprites/dragon_cartoon.png'); // Спрайт дракона
    this.load.image('treasure', 'assets/sprites/treasure_cartoon.png'); // Спрайт сокровищ
    this.load.image('knight', 'assets/sprites/knight_cartoon.png'); // Спрайт рыцаря
    this.load.image('thief', 'assets/sprites/thief_cartoon.png'); // Спрайт вора
    this.load.image('fireball', 'assets/sprites/fireball_cartoon.png'); // Спрайт огненного шара
    this.load.image('platform', 'assets/sprites/platform_cartoon.png'); // Спрайт платформы
    this.load.image('crystal_bonus', 'assets/sprites/crystal_bonus_cartoon.png'); // Спрайт бонуса
    this.load.image('cave_bg', 'assets/backgrounds/cave_bg_cartoon.png'); // Фон пещеры

    // Событие: все ресурсы загружены успешно
    this.load.on('complete', () => console.log('All resources loaded successfully!'));
    // Событие: каждый отдельный ресурс загружен
    this.load.on('filecomplete', (key) => console.log(`Loaded: ${key}`));
    // Событие: ошибка загрузки ресурса (для отладки)
    this.load.on('loaderror', (file) => console.error(`Error loading: ${file.key}`));
}

function create() {
    // Добавление фонового изображения пещеры (центр экрана: 400, 300)
    this.add.image(400, 300, 'cave_bg');

    // Создание группы статичных платформ
    platforms = this.physics.add.staticGroup();
    // Нижняя платформа: ширина 800 px, высота 32 px, полный экран
    platforms.create(400, 600, 'platform').setDisplaySize(800, 32).refreshBody();
    // Левая средняя платформа: ширина 224 px, высота 32 px
    platforms.create(120, 450, 'platform').setDisplaySize(224, 32).refreshBody();
    // Правая средняя платформа: ширина 256 px, высота 32 px
    platforms.create(680, 450, 'platform').setDisplaySize(256, 32).refreshBody();
    // Левая верхняя платформа: ширина 160 px, высота 32 px
    platforms.create(150, 300, 'platform').setDisplaySize(160, 32).refreshBody();
    // Правая верхняя платформа: ширина 128 px, высота 32 px
    platforms.create(650, 300, 'platform').setDisplaySize(128, 32).refreshBody();

    // Создание сокровищ как статичного объекта с физикой
    treasure = this.physics.add.staticSprite(400, 550, 'treasure');
    treasure.setData('health', treasureHealth); // Установка начального здоровья сокровищ
    // Текст для отображения здоровья сокровищ
    this.add.text(350, 50, 'Treasure HP: 100', { fontSize: '20px', color: '#fff' }).setName('hpText');

    // Текст для отображения очков
    this.add.text(20, 20, 'Score: 0', { fontSize: '20px', color: '#fff' }).setName('scoreText');

    // Создание дракона как динамического объекта с физикой
    dragon = this.physics.add.sprite(400, 500, 'dragon');
    dragon.setBounce(0.2); // Лёгкий отскок при падении
    dragon.setCollideWorldBounds(true); // Дракон не выходит за границы экрана
    this.physics.add.collider(dragon, platforms); // Столкновение дракона с платформами

    // Настройка управления клавишами стрелками
    cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-SPACE', shoot, this); // Стрельба по нажатию пробела
    this.input.keyboard.on('keydown-R', restartGame, this); // Рестарт по нажатию R

    // Создание группы огненных шаров (без гравитации)
    fireballs = this.physics.add.group({ defaultKey: 'fireball', maxSize: 50, gravityY: 0 });
    // Создание группы врагов
    enemies = this.physics.add.group();
    // Создание группы бонусов
    bonuses = this.physics.add.group();

    // Настройка столкновений и пересечений
    this.physics.add.collider(enemies, platforms); // Враги сталкиваются с платформами
    this.physics.add.overlap(enemies, treasure, damageTreasure, null, this); // Враги наносят урон сокровищам
    this.physics.add.overlap(fireballs, enemies, hitEnemy, null, this); // Огненные шары уничтожают врагов
    this.physics.add.overlap(dragon, bonuses, collectBonus, null, this); // Дракон собирает бонусы
    this.physics.add.overlap(dragon, enemies, dragonDeath, null, this); // Смерть дракона при касании врага
    this.physics.add.collider(bonuses, platforms); // Бонусы сталкиваются с платформами и не падают сквозь

    // Таймер для спавна врагов каждые 2 секунды
    this.time.addEvent({ delay: 2000, callback: spawnEnemy, callbackScope: this, loop: true });

    // Настройка мобильного управления для устройств без клавиатуры
    if (!this.sys.game.device.os.desktop) {
        // Кнопка влево: синий прямоугольник
        let leftButton = this.add.rectangle(100, 500, 80, 80, 0x6666ff).setInteractive();
        // Кнопка вправо: синий прямоугольник
        let rightButton = this.add.rectangle(200, 500, 80, 80, 0x6666ff).setInteractive();
        // Кнопка прыжка: зелёный прямоугольник
        let jumpButton = this.add.rectangle(700, 500, 80, 80, 0x66ff66).setInteractive();
        // Кнопка стрельбы: красный прямоугольник
        let shootButton = this.add.rectangle(600, 500, 80, 80, 0xff6666).setInteractive();

        leftButton.on('pointerdown', () => dragon.setVelocityX(-200)); // Движение влево
        leftButton.on('pointerup', () => dragon.setVelocityX(0)); // Остановка при отпускании
        rightButton.on('pointerdown', () => dragon.setVelocityX(200)); // Движение вправо
        rightButton.on('pointerup', () => dragon.setVelocityX(0)); // Остановка при отпускании
        jumpButton.on('pointerdown', () => { if (dragon.body.touching.down) dragon.setVelocityY(-400); }); // Прыжок
        shootButton.on('pointerdown', shoot, this); // Стрельба
    }
}

function update() {
    // Управление движением и поворотом дракона
    if (cursors.left.isDown) {
        dragon.setVelocityX(-200); // Движение влево со скоростью 200
        lastDirection = -1; // Обновление направления для стрельбы
        dragon.setScale(-1, 1); // Поворот влево (зеркальное отражение по X)
        console.log('Dragon facing left'); // Отладка поворота
    } else if (cursors.right.isDown) {
        dragon.setVelocityX(200); // Движение вправо со скоростью 200
        lastDirection = 1; // Обновление направления для стрельбы
        dragon.setScale(1, 1); // Поворот вправо (нормальное положение)
        console.log('Dragon facing right'); // Отладка поворота
    } else {
        dragon.setVelocityX(0); // Остановка горизонтального движения
    }

    // Прыжок дракона, только если он касается платформы
    if (cursors.up.isDown && dragon.body.touching.down) {
        dragon.setVelocityY(-400); // Движение вверх со скоростью 400
    }

    // Движение врагов к сокровищам
    enemies.getChildren().forEach(enemy => {
        let directionX = treasure.x - enemy.x; // Направление по X к сокровищам
        let directionY = treasure.y - enemy.y; // Направление по Y к сокровищам
        enemy.setVelocityX(directionX > 0 ? 100 : -100); // Движение вправо или влево
        // Воры могут двигаться по вертикали, если далеко от сокровищ
        if (enemy.texture.key === 'thief' && Math.abs(enemy.y - treasure.y) > 50) {
            enemy.setVelocityY(directionY > 0 ? 50 : -50); // Движение вверх или вниз
        }
    });

    // Обновление текста здоровья сокровищ и очков
    this.children.getByName('hpText').setText(`Treasure HP: ${treasure.getData('health')}`);
    this.children.getByName('scoreText').setText(`Score: ${score}`);

    // Проверка конца игры: если здоровье сокровищ <= 0
    if (treasure.getData('health') <= 0) {
        this.physics.pause(); // Остановка физики
        // Отображение текста "Game Over" с подсказкой о рестарте
        this.add.text(300, 300, 'Game Over\nPress R to Restart', { fontSize: '40px', color: '#ff0000', align: 'center' });
    }
}

// Функция стрельбы огненными шарами
function shoot() {
    let fireball = fireballs.get(dragon.x, dragon.y); // Получение огненного шара из группы
    if (fireball) { // Если шар доступен
        fireball.setActive(true).setVisible(true); // Активация и отображение
        fireball.body.allowGravity = false; // Отключение гравитации для шара
        fireball.setVelocityX(lastDirection * 500); // Полёт в направлении последнего движения
        // Уничтожение шара при столкновении с платформой
        this.physics.add.collider(fireball, platforms, () => fireball.destroy());
    }
}

// Урон сокровищам от врагов
function damageTreasure(enemy, treasure) {
    treasure.setData('health', treasure.getData('health') - 1); // Уменьшение здоровья на 1
    enemy.destroy(); // Уничтожение врага после нанесения урона
}

// Уничтожение врага огненным шаром
function hitEnemy(fireball, enemy) {
    fireball.destroy(); // Уничтожение огненного шара
    enemy.destroy(); // Уничтожение врага
    score += 10; // Добавление 10 очков
    if (Math.random() < 0.2) spawnBonus(enemy.x, enemy.y); // 20% шанс появления бонуса
}

// Смерть дракона при касании врага
function dragonDeath(dragon, enemy) {
    this.physics.pause(); // Остановка физики
    dragon.setTint(0xff0000); // Красный оттенок для дракона (визуальный эффект смерти)
    // Отображение текста "Game Over" с подсказкой о рестарте
    this.add.text(300, 300, 'Game Over\nPress R to Restart', { fontSize: '40px', color: '#ff0000', align: 'center' });
}

// Спавн врага
function spawnEnemy() {
    let type = Math.random() < 0.5 ? 'knight' : 'thief'; // Случайный выбор: рыцарь или вор
    let platformY = Phaser.Math.RND.pick([300, 450, 600]); // Случайная платформа по высоте
    let side = Math.random() < 0.5 ? 50 : 750; // Случайная сторона (лево или право)
    let enemy = enemies.create(side, platformY - 20, type); // Создание врага над платформой
    enemy.setCollideWorldBounds(true); // Враг не выходит за границы экрана
}

// Спавн бонуса
function spawnBonus(x, y) {
    let bonus = bonuses.create(x, y, 'crystal_bonus'); // Создание кристалла-бонуса
    bonus.setVelocityY(100); // Падение вниз со скоростью 100
}

// Сбор бонуса драконом
function collectBonus(dragon, bonus) {
    bonus.destroy(); // Уничтожение бонуса
    dragon.setVelocityX(dragon.body.velocity.x * 1.5); // Увеличение скорости дракона в 1.5 раза
    // Возврат нормальной скорости через 5 секунд
    this.time.delayedCall(5000, () => dragon.setVelocityX(dragon.body.velocity.x / 1.5));
}

// Перезапуск игры
function restartGame() {
    treasure.setData('health', 100); // Сброс здоровья сокровищ
    score = 0; // Сброс очков
    dragon.setPosition(400, 500); // Возврат дракона в начальную позицию
    dragon.clearTint(); // Удаление красного оттенка
    dragon.setVelocity(0, 0); // Остановка движения дракона
    dragon.setScale(1, 1); // Сброс поворота дракона (смотрит вправо)
    enemies.clear(true, true); // Удаление всех врагов
    fireballs.clear(true, true); // Удаление всех огненных шаров
    bonuses.clear(true, true); // Удаление всех бонусов
    
    // Удаление текста "Game Over"
    this.children.list.forEach(child => {
        if (child.type === 'Text' && child.text.includes('Game Over')) {
            child.destroy(); // Уничтожение объекта текста
        }
    });
    
    this.physics.resume(); // Возобновление физики
    this.time.removeAllEvents(); // Удаление всех таймеров
    // Создание нового таймера для спавна врагов
    this.time.addEvent({ delay: 2000, callback: spawnEnemy, callbackScope: this, loop: true });
}