function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.matchMedia && window.matchMedia("(max-width: 767px)").matches);
}

window.initMobileControls = function(scene) {
    if (!isMobileDevice()) return;

    virtualCursors = virtualCursors || { 
        left: { isDown: false }, 
        right: { isDown: false }, 
        up: { isDown: false },
        shoot: { isDown: false }
    };

    let joystick = null;
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
    }

    const buttonSize = gameWidth * GAME_CONSTANTS.BUTTON_SIZE_FACTOR;
    let leftButton = null, rightButton = null;
    if (!joystick) {
        leftButton = scene.add.circle(gameWidth * 0.125, gameHeight * 0.9, buttonSize / 1.7, 0xBABABA)
            .setInteractive()
            .setAlpha(0.7)
            .setDepth(1000);
        rightButton = scene.add.circle(gameWidth * 0.25, gameHeight * 0.9, buttonSize / 1.7, 0xBABABA)
            .setInteractive()
            .setAlpha(0.7)
            .setDepth(1000);

        leftButton.on('pointerdown', () => virtualCursors.left.isDown = true);
        leftButton.on('pointerup', () => virtualCursors.left.isDown = false);
        leftButton.on('pointerout', () => virtualCursors.left.isDown = false);

        rightButton.on('pointerdown', () => virtualCursors.right.isDown = true);
        rightButton.on('pointerup', () => virtualCursors.right.isDown = false);
        rightButton.on('pointerout', () => virtualCursors.right.isDown = false);
    }

    let jumpButton = scene.add.circle(gameWidth * 0.875, gameHeight * 0.9, buttonSize / 1.7, 0x66ff66)
        .setInteractive()
        .setAlpha(0.7)
        .setDepth(1000);
    jumpButton.on('pointerdown', () => virtualCursors.up.isDown = true);
    jumpButton.on('pointerup', () => virtualCursors.up.isDown = false);
    jumpButton.on('pointerout', () => virtualCursors.up.isDown = false);

    let shootButton = scene.add.circle(gameWidth * 0.75, gameHeight * 0.9, buttonSize / 1.7, 0xff6666)
        .setInteractive()
        .setAlpha(0.7)
        .setDepth(1000);
    let shootInterval = null;
    shootButton.on('pointerdown', () => {
        dragon.shoot();
        shootInterval = scene.time.addEvent({
            delay: 200,
            callback: () => dragon.shoot(),
            callbackScope: scene,
            loop: true
        });
    });
    shootButton.on('pointerup', () => {
        if (shootInterval) shootInterval.remove();
        shootInterval = null;
    });
    shootButton.on('pointerout', () => {
        if (shootInterval) shootInterval.remove();
        shootInterval = null;
    });

    if (joystick) {
        joystick.on('update', () => {
            const force = joystick.force;
            const angle = joystick.angle;
            virtualCursors.left.isDown = force > 20 && (angle > 135 || angle < -135);
            virtualCursors.right.isDown = force > 20 && (angle < 45 && angle > -45);
        });
    }

    scene.mobileControls = { 
        joystick, 
        leftButton,
        rightButton,
        jumpButton, 
        shootButton,
        shootInterval
    };

    scene.input.on('pointerdown', () => {
        if (gameOverText && gameOverText.visible) restartGame.call(scene);
    });

    let originalResize = resize;
    resize = function(gameSize) {
        originalResize.call(this, gameSize);
        if (scene.mobileControls) {
            if (scene.mobileControls.joystick) {
                scene.mobileControls.joystick.setPosition(gameWidth * 0.15, gameHeight * 0.85);
            } else {
                if (scene.mobileControls.leftButton) scene.mobileControls.leftButton.setPosition(gameWidth * 0.125, gameHeight * 0.9);
                if (scene.mobileControls.rightButton) scene.mobileControls.rightButton.setPosition(gameWidth * 0.25, gameHeight * 0.9);
            }
            scene.mobileControls.jumpButton.setPosition(gameWidth * 0.875, gameHeight * 0.9);
            scene.mobileControls.shootButton.setPosition(gameWidth * 0.75, gameHeight * 0.9);
        }
    };
};