const Rectangle = require('Rectangle');
const { r, requireImage } = require('animations');
const { drawImage } = require('draw');
module.exports = {
    renderShop
};
const { renderShipBackground, renderShip } = require('ship');
const { getLayoutProperties } = require('hud');

const robotFrame = r(300, 300, {image: requireImage('gfx/shop.png')});
function renderShop(context, state) {
    renderShipBackground(context, state);
    renderShip(context, state);

    const { shopRectangle } = getLayoutProperties(state);
    drawImage(context, robotFrame.image, robotFrame,
        new Rectangle(robotFrame).moveCenterTo(
            shopRectangle.left + shopRectangle.width / 2,
            shopRectangle.top + shopRectangle.height / 2,
        )
    );
}

