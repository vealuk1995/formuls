// mobile.js
function isMobileDevice() {
    return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
}

window.initMobileControls = function(scene) {
    if (!isMobileDevice()) return;

    console.log("Mobile device detected, initializing touch controls...");
    const buttonSize = gameWidth * GAME_CONSTANTS.BUTTON_SIZE_FACTOR;

    let leftButton = scene.add.rectangle(gameWidth * 0.125, gameHeight * 0.83, buttonSize, buttonSize, 0x6666ff).setInteractive();
    let rightButton = scene.add.rectangle(gameWidth * 0.25, gameHeight * 0.83, buttonSize, buttonSize, 0x6666ff).setInteractive();
    let jumpButton = scene.add.rectangle(gameWidth * 0.875, gameHeight * 0.83, buttonSize, buttonSize, 0x66ff66).setInteractive();
    let shootButton = scene.add.rectangle(gameWidth * 0.75, gameHeight * 0.83, buttonSize, buttonSize, 0xff6666).setInteractive();

    let virtualCursors = { left: { isDown: false }, right: { isDown: false }, up: { isDown: false } };

    leftButton.on('pointerdown', () => { virtualCursors.left.isDown = true; dragon.move(virtualCursors); });
    leftButton.on('pointerup', () => { virtualCursors.left.isDown = false; dragon.move(virtualCursors); });
    leftButton.on('pointerout', () => { virtualCursors.left.isDown = false; dragon.move(virtualCursors); });

    rightButton.on('pointerdown', () => { virtualCursors.right.isDown = true; dragon.move(virtualCursors); });
    rightButton.on('pointerup', () => { virtualCursors.right.isDown = false; dragon.move(virtualCursors); });
    rightButton.on('pointerout', () => { virtualCursors.right.isDown = false; dragon.move(virtualCursors); });

    jumpButton.on('pointerdown', () => { virtualCursors.up.isDown = true; dragon.move(virtualCursors); virtualCursors.up.isDown = false; });

    shootButton.on('pointerdown', () => { dragon.shoot(); });

    scene.mobileButtons = { leftButton, rightButton, jumpButton, shootButton };

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