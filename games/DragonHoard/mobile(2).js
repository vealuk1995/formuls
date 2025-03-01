// Проверяем, является ли устройство мобильным
function isMobileDevice() {
    return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
}

// Функция инициализации сенсорных кнопок управления
window.initMobileControls = function(scene) {
    if (!isMobileDevice()) return; // Выходим, если не мобильное устройство

    console.log("Mobile device detected, initializing touch controls...");

    const buttonSize = gameWidth * GAME_CONSTANTS.BUTTON_SIZE_FACTOR;

    // Создаем кнопки управления
    let leftButton = scene.add.rectangle(gameWidth * 0.125, gameHeight * 0.83, buttonSize, buttonSize, 0x6666ff)
        .setInteractive();
    let rightButton = scene.add.rectangle(gameWidth * 0.25, gameHeight * 0.83, buttonSize, buttonSize, 0x6666ff)
        .setInteractive();
    let jumpButton = scene.add.rectangle(gameWidth * 0.875, gameHeight * 0.83, buttonSize, buttonSize, 0x66ff66)
        .setInteractive();
    let shootButton = scene.add.rectangle(gameWidth * 0.75, gameHeight * 0.83, buttonSize, buttonSize, 0xff6666)
        .setInteractive();

    // Переменные для эмуляции клавиш
    let virtualCursors = { left: { isDown: false }, right: { isDown: false }, up: { isDown: false } };

    // Обработчики для движения влево
    leftButton.on('pointerdown', () => {
        virtualCursors.left.isDown = true;
        dragon.move(virtualCursors); // Используем общую функцию движения
    });
    leftButton.on('pointerup', () => {
        virtualCursors.left.isDown = false;
        dragon.move(virtualCursors);
    });
    leftButton.on('pointerout', () => {
        virtualCursors.left.isDown = false;
        dragon.move(virtualCursors);
    });

    // Обработчики для движения вправо
    rightButton.on('pointerdown', () => {
        virtualCursors.right.isDown = true;
        dragon.move(virtualCursors);
    });
    rightButton.on('pointerup', () => {
        virtualCursors.right.isDown = false;
        dragon.move(virtualCursors);
    });
    rightButton.on('pointerout', () => {
        virtualCursors.right.isDown = false;
        dragon.move(virtualCursors);
    });

    // Обработчик прыжка
    jumpButton.on('pointerdown', () => {
        virtualCursors.up.isDown = true;
        dragon.move(virtualCursors);
        virtualCursors.up.isDown = false; // Сбрасываем после прыжка
    });

    // Обработчик стрельбы
    shootButton.on('pointerdown', () => {
        dragon.shoot();
    });

    // Сохраняем ссылки на кнопки для обновления при изменении размера
    scene.mobileButtons = { leftButton, rightButton, jumpButton, shootButton };

    // Обновляем функцию resize для мобильных кнопок
    let originalResize = resize;
    resize = function(gameSize) {
        originalResize.call(this, gameSize);
        if (scene.mobileButtons) {
            scene.mobileButtons.leftButton.setPosition(gameWidth * 0.125, gameHeight * 0.83);
            scene.mobileButtons.rightButton.setPosition(gameWidth * 0.25, gameHeight * 0.83);
            scene.mobileButtons.jumpButton.setPosition(gameWidth * 0.875, gameHeight * 0.83);
            scene.mobileButtons.shootButton.setPosition(gameWidth * 0.75, gameHeight * 0.83);
        }
    };
};