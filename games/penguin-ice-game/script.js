const gameContainer = document.getElementById('game-container');
const penguin = document.getElementById('penguin');
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('high-score');
const gameOverScreen = document.getElementById('game-over');
const finalScore = document.getElementById('final-score');
const restartButton = document.getElementById('restart');
const upgradeJump = document.getElementById('upgrade-jump');
const upgradeSpeed = document.getElementById('upgrade-speed');
const jumpSound = document.getElementById('jump-sound');
const collectSound = document.getElementById('collect-sound');
const slipSound = document.getElementById('slip-sound');
const breakSound = document.getElementById('break-sound');

let score = 0;
let highScore = localStorage.getItem('highScore') || 0;
highScoreDisplay.textContent = `Лучший: ${highScore}`;
let gameSpeed = 2;
let crackWidth = window.innerWidth * 0.05; // Относительная ширина трещины
let isJumping = false;
let gameOver = false;
let upgrades = {
    jumpHeight: 1,
    speedBoost: 0
};

// Динамическая высота прыжка
function getJumpHeight() {
    return Math.min(35 + upgrades.jumpHeight * 5, 50) * window.innerHeight / 100; // vh в px
}

// Управление
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isJumping && !gameOver) jump();
});

document.addEventListener('click', () => {
    if (!isJumping && !gameOver) jump();
});

gameContainer.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!isJumping && !gameOver) jump();
});

function jump() {
    isJumping = true;
    penguin.classList.add('jumping');
    jumpSound.play();
    const jumpHeight = getJumpHeight();
    const jumpDuration = 0.6 / (1 + upgrades.speedBoost);
    penguin.style.animation = `jump ${jumpDuration}s`;
    penguin.style.bottom = `${jumpHeight}px`;
    setTimeout(() => {
        penguin.style.animation = '';
        penguin.style.bottom = '15vh';
        penguin.classList.remove('jumping');
        isJumping = false;
    }, jumpDuration * 1000);
}

// Генерация льдин
function createIce() {
    const ice = document.createElement('div');
    ice.classList.add('ice');
    let iceWidth = Math.random() * (window.innerWidth * 0.2) + (window.innerWidth * 0.1); // 10-30% ширины экрана
    ice.style.width = `${iceWidth}px`;
    ice.style.left = '100%';

    const type = Math.random();
    if (type < 0.2) ice.classList.add('slippery');
    else if (type < 0.4) ice.classList.add('fragile');

    gameContainer.appendChild(ice);

    if (Math.random() < 0.3) {
        const fish = document.createElement('div');
        fish.classList.add('fish');
        fish.style.left = `${Math.random() * (iceWidth - window.innerWidth * 0.02)}px`; // Относительно льдины
        ice.appendChild(fish);
    }

    const crack = document.createElement('div');
    crack.classList.add('crack');
    crack.style.width = `${crackWidth}px`;
    crack.style.left = `${parseInt(ice.style.left) + iceWidth}px`;
    gameContainer.appendChild(crack);

    let icePosition = window.innerWidth;
    function moveIce() {
        if (gameOver) return;

        icePosition -= gameSpeed + upgrades.speedBoost;
        ice.style.left = `${icePosition}px`;
        crack.style.left = `${icePosition + iceWidth}px`;

        if (checkCollision(penguin, crack)) {
            endGame();
            return;
        }

        if (ice.querySelector('.fish') && checkCollision(penguin, ice.querySelector('.fish'))) {
            score += 50;
            collectSound.play();
            ice.querySelector('.fish').remove();
        }

        if (checkCollision(penguin, ice)) {
            if (ice.classList.contains('slippery') && !ice.dataset.slipped) {
                slipSound.play();
                ice.dataset.slipped = true;
                gameSpeed *= 1.5;
                setTimeout(() => gameSpeed /= 1.5, 2000);
            }
            if (ice.classList.contains('fragile') && !ice.dataset.broken) {
                breakSound.play();
                ice.dataset.broken = true;
                ice.style.animation = 'break 0.5s forwards';
                setTimeout(() => ice.remove(), 500);
            }
        }

        if (icePosition > -iceWidth) {
            requestAnimationFrame(moveIce);
        } else {
            ice.remove();
            crack.remove();
        }
    }
    moveIce();
}

// Проверка столкновения
function checkCollision(obj1, obj2) {
    const rect1 = obj1.getBoundingClientRect();
    const rect2 = obj2.getBoundingClientRect();
    return rect1.bottom > rect2.top &&
           rect1.top < rect2.bottom &&
           rect1.right > rect2.left &&
           rect1.left < rect2.right;
}

// Игровой цикл
function gameLoop() {
    if (gameOver) return;

    score++;
    scoreDisplay.textContent = `Очки: ${score}`;

    if (score % 100 === 0) {
        gameSpeed += 0.2;
        crackWidth += window.innerWidth * 0.005; // Увеличение трещины относительно экрана
    }

    requestAnimationFrame(gameLoop);
}

// Окончание игры
function endGame() {
    gameOver = true;
    finalScore.textContent = score;
    gameOverScreen.classList.remove('hidden');
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
        highScoreDisplay.textContent = `Лучший: ${highScore}`;
    }
}

// Улучшения
upgradeJump.addEventListener('click', () => {
    if (score >= 100) {
        score -= 100;
        upgrades.jumpHeight++;
        finalScore.textContent = score;
        updateScoreDisplay();
    }
});

upgradeSpeed.addEventListener('click', () => {
    if (score >= 150) {
        score -= 150;
        upgrades.speedBoost += 0.2;
        finalScore.textContent = score;
        updateScoreDisplay();
    }
});

function updateScoreDisplay() {
    scoreDisplay.textContent = `Очки: ${score}`;
}

// Перезапуск
restartButton.addEventListener('click', () => {
    gameOver = false;
    score = 0;
    gameSpeed = 2;
    crackWidth = window.innerWidth * 0.05;
    scoreDisplay.textContent = `Очки: 0`;
    gameOverScreen.classList.add('hidden');
    const elements = document.querySelectorAll('.ice, .crack');
    elements.forEach(el => el.remove());
    gameLoop();
});

// Генерация льдин
setInterval(() => {
    if (!gameOver) createIce();
}, 2000);

// Обработка изменения размера окна
window.addEventListener('resize', () => {
    crackWidth = Math.max(window.innerWidth * 0.05, crackWidth); // Корректировка трещин
    penguin.style.left = `${window.innerWidth * 0.1}px`; // Пингвин всегда в 10% слева
});

gameLoop();