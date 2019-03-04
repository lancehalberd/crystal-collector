const {
    playSound,
    playTrack,
} = require('sounds');

module.exports = render;

const { renderHUD } = require('hud');
const { renderDigging } = require('renderDigging');
const { renderShipScene } = require('ship');
const { renderShop } = require('shop');
const { renderAchievements } = require('achievements');

function render(context, state) {
    /*if (state.interacted && state.bgm) {
        playTrack(state.bgm, 0);
        state.bgm = false;
    }*/
    if (state.showAchievements) {
        renderAchievements(context, state);
    } else if (!state.shop && !state.ship) {
        renderDigging(context, state);
        for (let spriteId in state.spriteMap) {
            state.spriteMap[spriteId].render(context, state, state.spriteMap[spriteId]);
        }
    }
    if (state.ship) {
        renderShipScene(context, state);
    } else if (state.shop) {
        renderShop(context, state);
    }

    // Render HUD on top of the screen fading to black.
    renderHUD(context, state);

    if (state.interacted) {
        for (const sfx in state.sfx) {
            playSound(sfx);
        }
    }
    state.sfx = {};
}

