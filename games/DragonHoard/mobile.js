// mobile.js
function isMobileDevice() {
    return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
}

window.initMobileControls = function(scene) {
    if (!isMobileDevice()) return;

    console.log("Mobile device detected, initializing joystick controls...");
    
    // Инициализация виртуального джойстика
    scene.joystick = scene.plugins.get('rexVirtualJoystick').add(scene, {
        x: gameWidth * 0.15,
        y: gameHeight * 0.85,
        radius: gameWidth * 0.1,
        base: scene.add.circle(0, 0, gameWidth * 0.1, 0x888888, 0.5),
        thumb: scene.add.circle(0, 0, gameWidth * 0.05, 0xcccccc, 0.8),
        dir: '8dir', // 8-направленный джойстик
        forceMin: 16,
        enable: true
    });

    // Кнопка прыжка
    const buttonSize = gameWidth * GAME_CONSTANTS.BUTTON_SIZE_FACTOR;
    let jumpButton = scene.add.circle(gameWidth * 0.875, gameHeight * 0.83, buttonSize/2, 0x66ff66)
        .setInteractive()
        .setAlpha(0.7);
    
    // Кнопка выстрела
    let shootButton = scene.add.circle(gameWidth * 0.75, gameHeight * 0.83, buttonSize/2, 0xff6666)
        .setInteractive()
        .setAlpha(0.7);

    // Виртуальные курсоры для совместимости с существующей логикой
    let virtualCursors = { 
        left: { isDown: false }, 
        right: { isDown: false }, 
        up: { isDown: false }
    };

    // Обработка событий джойстика
    scene.joystick.on('update', () => {
        const force = scene.joystick.force;
        const angle = scene.joystick.angle;
        
        virtualCursors.left.isDown = force > 20 && (angle > 135 || angle < -135);
        virtualCursors.right.isDown = force > 20 && (angle < 45 && angle > -45);
        dragon.move(virtualCursors);
    });

    // Обработка кнопки прыжка
    jumpButton.on('pointerdown', () => { 
        virtualCursors.up.isDown = true; 
        dragon.move(virtualCursors); 
        virtualCursors.up.isDown = false; 
    });

    // Обработка кнопки выстрела
    shootButton.on('pointerdown', () => { 
        dragon.shoot(); 
    });

    // Сохранение мобильных элементов
    scene.mobileControls = { 
        joystick: scene.joystick, 
        jumpButton: jumpButton, 
        shootButton: shootButton 
    };

    // Добавление рестарта по тапу на экран смерти
    scene.input.on('pointerdown', () => {
        if (gameOverText && gameOverText.visible) {
            restartGame.call(scene);
        }
    });

    // Обновление позиций при изменении размера
    let originalResize = resize;
    resize = function(gameSize) {
        originalResize.call(this, gameSize);
        if (scene.mobileControls) {
            scene.mobileControls.joystick.setPosition(gameWidth * 0.15, gameHeight * 0.85);
            scene.mobileControls.jumpButton.setPosition(gameWidth * 0.875, gameHeight * 0.83);
            scene.mobileControls.shootButton.setPosition(gameWidth * 0.75, gameHeight * 0.83);
        }
    };
};