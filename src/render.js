const {
    canvas,
    ROW_HEIGHT,
} = require('gameConstants');
const {
    isPlayingTrack,
    playTrackCombination,
} = require('sounds');
const { drawText, drawRectangle } = require('draw');

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
const { isKeyDown, KEY_SPACE } = require('keyboard');
const loadTime = Date.now();
//  0 1 2 3 4 5 6 7 8 9 A B C
//0 - - \ _
//1 _ / - - - \ _
//2       _ / - - - \ _
//3             _ / - - - \ _

// Track 0 plays from -3 to 3, 1 from 0 to 6, 2 from 3 to 9
// So Track N plays from  3N - 3 to 3N + 3
// So for 5 tracks, track 4 last phase is 15, but we don't use 14 or 15 for the final track.
// So phases is # of tracks * 3 + 1  (the 1 is + 3 - 2 unused sections).

function playDiggingTrack(state) {
    let bgmTime = state.time - (state.bgmTime || 0);
    const allSources = ['digging1', 'digging1-2', 'digging2', 'digging2-2', 'digging3', 'digging3-2', 'digging4'];
    const finalPhase = allSources.length * 3 - 2;
    let y = state.camera.top + canvas.height / 2;
    // Sound test code.
    const S = 705;
    if (isKeyDown(KEY_SPACE)) {
        // 3 main tracks and 2 transition tracks
        y = (4 * 2 * S + 3 * 2 * S) * ( state.lastMouseCoords ? state.lastMouseCoords.x : 0) / canvas.width;
    }
    let phase = 0;
    while (y >= 0 && phase < finalPhase) {
        // Main track plays by itself for S pixels
        if (y < 2 * S) {
            phase += y / (2 * S);
            break;
        }
        phase++;
        y -= 2 * S;
        // Transition fades in for S / 2 pixels.
        if (y < S / 2) {
            phase += y / (S / 2);
            break;
        }
        phase++;
        y -= S / 2;
        // Main track fades out for S / 2 pixels.
        if (y < S / 2) {
            phase += y / (S / 2);
            break;
        }
        phase++;
        y -= S / 2;
        // Skip transition track playing by itself
        phase++;
        // Next main track fades in for S / 2 pixels.
        if (y < S / 2) {
            phase += y / (S / 2);
            break;
        }
        phase++;
        y -= S / 2;
        // Transition track fades out for S / 2 pixels.
        if (y < S / 2) {
            phase += y / (S / 2);
            break;
        }
        phase++;
        y -= S / 2;
    }
    phase = Math.min(phase, finalPhase);
    //console.log(phase);
    let tracks = [];
    // console.log(phase);
    for (let i = 0; i < allSources.length; i++) {
        if (phase < i * 3 - 3 || phase >= i * 3 + 4) continue;
        const source = allSources[i];
        let volume = 1;
        if (phase < i * 3 - 2) volume = 0; // First phase is silent
        else if (phase < i * 3 - 1) volume = phase % 1; // second phase is fading in
        // 3 phases of max volume
        else if (phase > i * 3 + 3) volume = 0; // Last phase is silent.
        else if (phase > i * 3 + 2) volume = 1 - (phase % 1); // second to last phase is fading out.
        // volume = Math.max(volume, 0.1);
        tracks.push({source, volume});
    }
    const lavaDepthY = state.displayLavaDepth * ROW_HEIGHT / 2 + ROW_HEIGHT / 2 - state.camera.top;
    const dy = 1.5 * canvas.height - lavaDepthY
    let volume = Math.max(0, Math.min(1, dy / (canvas.height)));
    // Sound test code.
    if (isKeyDown(KEY_SPACE)) {
        volume = Math.max(0, (( state.lastMouseCoords ? state.lastMouseCoords.y : 0) - canvas.height / 2) / canvas.height * 2);
    }
    // console.log(( state.lastMouseCoords ? state.lastMouseCoords.y : 0), canvas.height, volume);
    // console.log(volume, lavaDepthY, dy, canvas.height);
    tracks.push({source: 'lava', volume});
    // console.log(tracks.map(({source, volume}) => `${source}@${volume}` ));
    playTrackCombination(
        //[{source: 'digging1', volume: 1}, {source: 'digging1-2', volume: 0.5}],
        tracks,
        bgmTime,
        state.saved.muteMusic,
        'digging',
    );
}

function render(context, state) {
    context.fillStyle = 'black';
    context.fillRect(0, 0, canvas.width, canvas.height);
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
        if (isKeyDown(KEY_SPACE) || bgm === 'digging') {
            playDiggingTrack(state);
        } else {
            // console.log(bgm, '!=', getCurrentTrackSource());
            playTrack(state, bgm, bgmTime);
        }
        if (!state.interacted && isPlayingTrack()) {
            state.interacted = true;
        }
    }
    if (!areImagesLoaded() || !state.interacted) {
        // Don't render for the first 200ms, to prevent 'Loading...' from flashing
        // when assets are cached.
        if (Date.now() - loadTime > 200 && !window.electronAPI) renderPlayButton(context, state);
        return;
    }
    if (state.outroTime !== false) {
        renderOutro(context, state);
    } else if (state.showOptions) {
        renderSpaceBackground(context, state);
    } else if (state.title) {
        renderTitle(context, state);
    } else if (!state.saved.finishedIntro) {
        renderIntro(context, state);
    } else if (state.showAchievements) {
        renderAchievements(context, state);
    }else if (state.ship) {
        renderShipScene(context, state);
    } else if (state.shop) {
        renderShop(context, state);
    } else {
        renderDigging(context, state);
        for (let spriteId in state.spriteMap) {
            if (state.spriteMap[spriteId].renderOverHud) continue;
            state.spriteMap[spriteId].render(context, state, state.spriteMap[spriteId]);
        }
    }

    // Render HUD on top of the screen fading to black.
    renderHUD(context, state);
    // Render sprite elements that should display on top of the HUD (achievement panels).
    for (let spriteId in state.spriteMap) {
        if (!state.spriteMap[spriteId].renderOverHud) continue;
        state.spriteMap[spriteId].render(context, state, state.spriteMap[spriteId]);
    }

    if (state.instructionsAlpha > 0) {
        renderHelp(context, state);
    }

    if (state.interacted) {
        for (const sfx in state.sfx) {
            playSound(state, sfx);
        }
    }
    state.sfx = {};
    timeStack.push(Date.now());
    if (timeStack.length > 60) timeStack.shift();
    if (isKeyDown(KEY_SPACE)) renderFPS(context);
}
function renderFPS(context) {
    const frames = timeStack.length - 1;
    const time = (timeStack[frames] - timeStack[0]) / 1000;
    drawRectangle(context, {top:0,left:0,width:100, height:44}, {fillStyle: '#000', strokeStyle: '#FFF'});
    drawText(context, Math.round(frames / time * 100) / 100, 10, 10,
        {fillStyle: 'white', textAlign: 'left', textBaseline: 'top', size: 24}
    );
}
const timeStack = [];

