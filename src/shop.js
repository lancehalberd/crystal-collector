const {
    WIDTH,
    HEIGHT,
} = require('gameConstants');

function renderShop(context, state) {
    context.fillStyle = '#08F';
    context.fillRect(0, 0, WIDTH, HEIGHT);
}

module.exports = {
    renderShop
};
