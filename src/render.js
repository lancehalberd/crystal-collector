const { canvas } = require('gameConstants');
const {
    getCurrentTrackSource,
    isPlayingTrack,
} = require('sounds');

module.exports = render;

const { areImagesLoaded } = require('animations');
const { renderHUD, renderPlayButton } = require('hud');
const { playSound, playTrack } = require('state');
const { renderDigging } = require('renderDigging');
const { renderShipScene, renderSpaceBackground } = require('ship');
const { renderShop } = require('shop');
const { renderTitle } = require('title');
const { renderAchievements } = require('achievements');
const { renderIntro, renderOutro } = require('scenes');
const { renderHelp } = require('help');
const loadTime = Date.now();

function render(context, state) {
    let bgmTime = state.time - (state.bgmTime || 0);
    let bgm = 'digging';
    // The intro is 4 seconds longer than the intro music, so we just keep playing the
    // title(ship) music for the initial 4 seconds.
    if (!state.title && !state.saved.finishedIntro && state.introTime > 4000) {
        bgm = 'intro';
        bgmTime = state.introTime - 4000;
    } else if (state.outroTime !== false) {
        bgm = 'victory';
    } else if (state.title || state.ship || state.shop || !state.saved.finishedIntro) {
        bgm = 'ship';
    }
    if (areImagesLoaded()) {
        if (bgm && getCurrentTrackSource() !== bgm) {
            // console.log(bgm, '!=', getCurrentTrackSource());
            playTrack(state, bgm, bgmTime);
        }
        if (!state.interacted && getCurrentTrackSource() === bgm && isPlayingTrack()) {
            state.interacted = true;
        }
    }
    if (!areImagesLoaded() || !state.interacted) {
        context.fillStyle = 'black';
        context.fillRect(0, 0, canvas.width, canvas.height);
        // Don't render for the first 200ms, to prevent 'Loading...' from flashing
        // when assets are cached.
        if (Date.now() - loadTime > 200) renderPlayButton(context, state);
        return;
    }
    if (state.outroTime !== false) {
        renderOutro(context, state);
    } else if (state.title) {
        renderTitle(context, state);
    } else if (!state.saved.finishedIntro) {
        renderIntro(context, state);
    } else if (state.showAchievements) {
        renderAchievements(context, state);
    } else if (state.showOptions) {
        renderSpaceBackground(context, state);
    } else if (state.ship) {
        renderShipScene(context, state);
    } else if (state.shop) {
        renderShop(context, state);
    } else {
        renderDigging(context, state);
        for (let spriteId in state.spriteMap) {
            state.spriteMap[spriteId].render(context, state, state.spriteMap[spriteId]);
        }
    }

    // Render HUD on top of the screen fading to black.
    renderHUD(context, state);

    if (state.instructionsAlpha > 0) {
        renderHelp(context, state);
    }

    if (state.interacted) {
        for (const sfx in state.sfx) {
            playSound(state, sfx);
        }
    }
    state.sfx = {};
}

