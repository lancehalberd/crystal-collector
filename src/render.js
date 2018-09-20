const {
    playSound,
    playTrack,
} = require('sounds');

const { renderHUD } = require('hud');

function render(context, state) {
    if (state.interacted && state.bgm) {
        playTrack(state.bgm, 0);
        state.bgm = false;
    }
    if (state.showAchievements) {
        renderAchievements(context, state);
    } else if (!state.shop) {
        renderDigging(context, state);
    } else {
        renderShop(context, state);
    }

    // Render HUD on top of the screen fading to black.
    renderHUD(context, state);
    for (let spriteId in state.spriteMap) {
        state.spriteMap[spriteId].render(context, state, state.spriteMap[spriteId]);
    }

    if (state.interacted) {
        for (const sfx in state.sfx) {
            playSound(sfx);
        }
    }
    state.sfx = {};
}

module.exports = render;

const { renderDigging } = require('renderDigging');
const { renderShop } = require('shop');
const { renderAchievements } = require('achievements');
