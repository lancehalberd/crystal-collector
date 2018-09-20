const {
    WIDTH,
    HEIGHT,
} = require('gameConstants');

function renderShop(context, state) {
    const time = Math.min(800, state.time - state.shop) / 800;
    const gradient = context.createLinearGradient(800 - time * 200, 900, 300 + time * 200, -200);
    gradient.addColorStop(0, "#08F");
    gradient.addColorStop(0.9 - 0.87 * time, "#08F");
    gradient.addColorStop(0.99 - time / 2, "#008");
    gradient.addColorStop(0.99 - time / 4, "#004");
    gradient.addColorStop(1, "#000");
    context.fillStyle = gradient;
    context.fillRect(0, 0, WIDTH, HEIGHT);
}

module.exports = {
    renderShop
};
