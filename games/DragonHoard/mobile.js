// Проверяем, является ли устройство мобильным
function isMobileDevice() {
    return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
}

// Инициализация мобильной поддержки
function initMobileSupport(scene) {
    if (!isMobileDevice()) return; // Если не мобильное устройство, ничего не делаем

    console.log("Mobile device detected, initializing touch controls...");

    // Добавляем обработчик сенсорного события для кнопки "Старт"
    startButton.on('pointerup', () => {
        console.log("Start button tapped on mobile");
        window.startGame(scene); // Вызываем глобальную функцию startGame
    });

    // Создаем сенсорные кнопки управления
    const buttonSize = gameWidth * GAME_CONSTANTS.BUTTON_SIZE_FACTOR;
    
    let leftButton = scene.add.rectangle(gameWidth * 0.125, gameHeight * 0.83, buttonSize, buttonSize, 0x6666ff)
        .setInteractive()
        .setVisible(false); // Скрываем до начала игры
    let rightButton = scene.add.rectangle(gameWidth * 0.25, gameHeight * 0.83, buttonSize, buttonSize, 0x6666ff)
        .setInteractive()
        .setVisible(false);
    let jumpButton = scene.add.rectangle(gameWidth * 0.875, gameHeight * 0.83, buttonSize, buttonSize, 0x66ff66)
        .setInteractive()
        .setVisible(false);
    let shootButton = scene.add.rectangle(gameWidth * 0.75, gameHeight * 0.83, buttonSize, buttonSize, 0xff6666)
        .setInteractive()
        .setVisible(false);

    // Обработчики событий для кнопок
    leftButton.on('pointerdown', () => {
        dragon.sprite.setVelocityX(-GAME_CONSTANTS.DRAGON_SPEED);
    });
    leftButton.on('pointerup', () => {
        dragon.sprite.setVelocityX(0);
    });
    leftButton.on('pointerout', () => {
        dragon.sprite.setVelocityX(0); // Останавливаем движение, если палец ушел за пределы кнопки
    });

    rightButton.on('pointerdown', () => {
        dragon.sprite.setVelocityX(GAME_CONSTANTS.DRAGON_SPEED);
    });
    rightButton.on('pointerup', () => {
        dragon.sprite.setVelocityX(0);
    });
    rightButton.on('pointerout', () => {
        dragon.sprite.setVelocityX(0);
    });

    jumpButton.on('pointerdown', () => {
        if (dragon.sprite.body.touching.down) {
            dragon.sprite.setVelocityY(GAME_CONSTANTS.DRAGON_JUMP);
        }
    });

    shootButton.on('pointerdown', () => {
        dragon.shoot();
    });

    // Обновляем функцию startGame для показа кнопок на мобильных устройствах
    const originalStartGame = window.startGame;
    window.startGame = function(scene) {
        originalStartGame(scene); // Вызываем оригинальную функцию
        if (isMobileDevice()) {
            // Показываем кнопки после старта игры
            leftButton.setVisible(true);
            rightButton.setVisible(true);
            jumpButton.setVisible(true);
            shootButton.setVisible(true);
        }
    };
}

// Инициализируем мобильную поддержку после загрузки сцены
document.addEventListener('DOMContentLoaded', () => {
    const scene = game.scene.scenes[0]; // Получаем первую сцену
    initMobileSupport(scene);
});