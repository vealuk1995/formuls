// Проверяем, является ли устройство мобильным
function isMobileDevice() {
    return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
}

// Функция инициализации сенсорных кнопок управления
window.initMobileControls = function(scene) {
    if (!isMobileDevice()) return; // Если не мобильное устройство, ничего не делаем

    console.log("Mobile device detected, initializing touch controls...");

    const buttonSize = gameWidth * GAME_CONSTANTS.BUTTON_SIZE_FACTOR;

    // Создаем сенсорные кнопки управления
    let leftButton = scene.add.rectangle(gameWidth * 0.125, gameHeight * 0.83, buttonSize, buttonSize, 0x6666ff)
        .setInteractive();
    let rightButton = scene.add.rectangle(gameWidth * 0.25, gameHeight * 0.83, buttonSize, buttonSize, 0x6666ff)
        .setInteractive();
    let jumpButton = scene.add.rectangle(gameWidth * 0.875, gameHeight * 0.83, buttonSize, buttonSize, 0x66ff66)
        .setInteractive();
    let shootButton = scene.add.rectangle(gameWidth * 0.75, gameHeight * 0.83, buttonSize, buttonSize, 0xff6666)
        .setInteractive();

    // Обработчики событий для кнопок
    leftButton.on('pointerdown', () => {
        dragon.sprite.setVelocityX(-GAME_CONSTANTS.DRAGON_SPEED);
    });
    leftButton.on('pointerup', () => {
        dragon.sprite.setVelocityX(0);
    });
    leftButton.on('pointerout', () => {
        dragon.sprite.setVelocityX(0);
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
};