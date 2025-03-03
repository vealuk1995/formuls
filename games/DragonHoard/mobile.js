function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.matchMedia && window.matchMedia("(max-width: 767px)").matches);
}

window.initMobileControls = function(scene) {
    console.log("initMobileControls called, isMobile:", isMobileDevice());
    if (!isMobileDevice()) return;

    console.log("Mobile device detected, initializing controls...");
    
    // Используем глобальный virtualCursors из game.js
    virtualCursors = virtualCursors || { 
        left: { isDown: false }, 
        right: { isDown: false }, 
        up: { isDown: false },
        shoot: { isDown: false }
    };

    // Инициализация виртуального джойстика
    let joystick;
    if (scene.plugins.get('rexVirtualJoystick')) {
        joystick = scene.plugins.get('rexVirtualJoystick').add(scene, {
            x: gameWidth * 0.15,
            y: gameHeight * 0.85,
            radius: gameWidth * 0.1,
            base: scene.add.circle(0, 0, gameWidth * 0.1, 0x888888, 0.5).setDepth(1000),
            thumb: scene.add.circle(0, 0, gameWidth * 0.05, 0xcccccc, 0.8).setDepth(1001),
            dir: '8dir',
            forceMin: 16,
            enable: true
        });
        console.log("Joystick initialized successfully");
    } else {
        console.warn("rexVirtualJoystick plugin not available, falling back to buttons");
    }

    // Кнопки как запасной вариант, если джойстик не работает
    const buttonSize = gameWidth * GAME_CONSTANTS.BUTTON_SIZE_FACTOR;
    let leftButton, rightButton;
    if (!joystick) {
        leftButton = scene.add.circle(gameWidth * 0.125, gameHeight * 0.9, buttonSize / 1.7, 0xBABABA)
            .setInteractive()
            .setAlpha(0.7)
            .setDepth(1000);
        rightButton = scene.add.circle(gameWidth * 0.25, gameHeight * 0.9, buttonSize / 1.7, 0xBABABA)
            .setInteractive()
            .setAlpha(0.7)
            .setDepth(1000);

        // Обработка кнопок влево/вправо с удержанием
        leftButton.on('pointerdown', () => {
            virtualCursors.left.isDown = true;
            console.log("Left button pressed");
        });
        leftButton.on('pointerup', () => {
            virtualCursors.left.isDown = false;
            console.log("Left button released");
        });
        leftButton.on('pointerout', () => {
            virtualCursors.left.isDown = false;
            console.log("Left button pointer out");
        });

        rightButton.on('pointerdown', () => {
            virtualCursors.right.isDown = true;
            console.log("Right button pressed");
        });
        rightButton.on('pointerup', () => {
            virtualCursors.right.isDown = false;
            console.log("Right button released");
        });
        rightButton.on('pointerout', () => {
            virtualCursors.right.isDown = false;
            console.log("Right button pointer out");
        });
    }

    // Кнопка прыжка с удержанием
    let jumpButton = scene.add.circle(gameWidth * 0.875, gameHeight * 0.9, buttonSize / 1.7, 0x66ff66)
        .setInteractive()
        .setAlpha(0.7)
        .setDepth(1000);
    
    jumpButton.on('pointerdown', () => {
        virtualCursors.up.isDown = true;
        console.log("Jump button pressed");
    });
    jumpButton.on('pointerup', () => {
        virtualCursors.up.isDown = false;
        console.log("Jump button released");
    });
    jumpButton.on('pointerout', () => {
        virtualCursors.up.isDown = false;
        console.log("Jump button pointer out");
    });

    // Кнопка выстрела с удержанием
    let shootButton = scene.add.circle(gameWidth * 0.75, gameHeight * 0.9, buttonSize / 1.7, 0xff6666)
        .setInteractive()
        .setAlpha(0.7)
        .setDepth(1000);

        shootButton.on('pointerdown', () => {
            virtualCursors.shoot.isDown = true; // Устанавливаем состояние стрельбы
            console.log("Shoot button pressed");
        });
        shootButton.on('pointerup', () => {
            virtualCursors.shoot.isDown = false;
            console.log("Shoot button released");
        });
        shootButton.on('pointerout', () => {
            virtualCursors.shoot.isDown = false;
            console.log("Shoot button pointer out");
        });

    let shootInterval = null;
    shootButton.on('pointerdown', () => {
        dragon.shoot();
        shootInterval = scene.time.addEvent({
            delay: 200,
            callback: () => dragon.shoot(),
            callbackScope: scene,
            loop: true
        });
        console.log("Shoot button pressed");
    });
    shootButton.on('pointerup', () => {
        if (shootInterval) {
            shootInterval.remove();
            shootInterval = null;
        }
        console.log("Shoot button released");
    });
    shootButton.on('pointerout', () => {
        if (shootInterval) {
            shootInterval.remove();
            shootInterval = null;
        }
        console.log("Shoot button pointer out");
    });

    // Обработка джойстика
    if (joystick) {
        joystick.on('update', () => {
            const force = joystick.force;
            const angle = joystick.angle;
            virtualCursors.left.isDown = force > 20 && (angle > 135 || angle < -135);
            virtualCursors.right.isDown = force > 20 && (angle < 45 && angle > -45);
        });
    }

    // Сохранение мобильных элементов
    scene.mobileControls = { 
        joystick: joystick || null, 
        leftButton: leftButton || null,
        rightButton: rightButton || null,
        jumpButton: jumpButton, 
        shootButton: shootButton 
    };

    // Обработчик рестарта по тапу
    scene.input.on('pointerdown', () => {
        console.log("Tap detected, gameOverText:", gameOverText, "visible:", gameOverText?.visible);
        if (gameOverText && gameOverText.visible) {
            restartGame.call(scene);
        }
    });

    // Обновление позиций при изменении размера
    let originalResize = resize;
    resize = function(gameSize) {
        originalResize.call(this, gameSize);
        if (scene.mobileControls) {
            if (scene.mobileControls.joystick) {
                scene.mobileControls.joystick.setPosition(gameWidth * 0.15, gameHeight * 0.85);
            } else {
                if (scene.mobileControls.leftButton) scene.mobileControls.leftButton.setPosition(gameWidth * 0.05, gameHeight * 0.85);
                if (scene.mobileControls.rightButton) scene.mobileControls.rightButton.setPosition(gameWidth * 0.25, gameHeight * 0.85);
            }
            scene.mobileControls.jumpButton.setPosition(gameWidth * 0.875, gameHeight * 0.83);
            scene.mobileControls.shootButton.setPosition(gameWidth * 0.75, gameHeight * 0.83);
        }
    };
};