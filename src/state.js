const Rectangle = require('Rectangle');
const random = require('random');

const {
    FRAME_LENGTH, canvas, EDGE_LENGTH,
} = require('gameConstants');


const { isKeyDown, KEY_ESCAPE } = require('keyboard');

const {
    playSound,
    playTrack,
} = require('sounds');

module.exports = {
    getNewState,
    getNewSaveSlot,
    advanceState,
    applyActions,
    nextDay,
    playSound: playSoundWithState,
    playTrack: playTrackWithState,
    restart,
    resumeDigging,
    updateSave,
};

const { introSequenceDuration } = require('scenes');

function playSoundWithState(state, sound) {
    playSound(sound, state.saved.muteSounds);
}
function playTrackWithState(state, bgm, bgmTime) {
    playTrack(bgm, bgmTime, state.saved.muteMusic)
}


const { areImagesLoaded } = require('animations');
const { getHUDButtons } = require('hud');
const { shouldShowHelp, showIncomingHint } = require('help');

const { advanceDigging, getOverCell, getTopTarget } = require('digging');
const { arriveAnimation } = require('ship');

const {
    advanceAchievements,
    getAchievementBonus,
    ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY,
} = require('achievements');

const INITIAL_LAVA_DEPTH = 100;

function getNewCamera(/*lavaDepth = INITIAL_LAVA_DEPTH*/) {
    return {
        left: -canvas.width / 2 + EDGE_LENGTH,
        top: getTopTarget(),
        minX: 1E9,
        maxX: -1E9,
        minY: 1E9,
        maxY: -1E9, //lavaDepth * ROW_HEIGHT / 2 + ROW_HEIGHT / 2,
    };
}

function updateSave(state, props) {
    return {
        ...state,
        saved: {
            ...state.saved,
            ...props,
        },
    };
}

function getNewSaveSlot() {
    return {
        maxBombDiffusers: 3,
        bombDiffusers: 3,
        bombsDiffusedToday: 0,
        bonusFuelToday: 0,
        crystalsCollectedToday: 0,
        explosionProtection: 0.2,
        range: 1.2,
        maxFuel: 100,
        fuel: 100,
        seed: random.nextSeed(),
        day: 1,
        maxDepth: 0,
        score: 0,
        playedToday: false,
        achievementStats: {},
        lavaDepth: INITIAL_LAVA_DEPTH,
        shipPart: 0,
        finishedIntro: false,
        nextHint: 0,
    };
}

function getNewState() {
    return {
        actions: {},
        displayFuel: 0,
        camera: getNewCamera(),
        rows: [],
        flags: [],
        sfx: {},
        interacted: false,
        time: 20,
        spriteMap: {},
        startingDepth: 1,
        displayLavaDepth: INITIAL_LAVA_DEPTH,
        title: 20,
        incoming: false,
        bgmTime: 20,
        saveSlot: false, // indicates save has not been selected yet.
        deleteSlot: false, // indicates file to delete in the delete modal.
        saved: {},
        outroTime: false,
        instructionsAlpha: 0,
    };
}

function nextDay(state) {
    return {
        ...state,
        usingBombDiffuser: false,
        displayLavaDepth: state.saved.lavaDepth,
        incoming: false,
        saved: {
            ...state.saved,
            bombDiffusers: state.saved.maxBombDiffusers + getAchievementBonus(state, ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY),
            bombsDiffusedToday: 0,
            bonusFuelToday: 0,
            crystalsCollectedToday: 0,
            day: state.saved.day + 1,
            fuel: state.saved.maxFuel,
            seed: random.nextSeed(state.saved.seed),
            playedToday: false,
        },
        camera: getNewCamera(state.saved.lavaDepth || 100),
        rows: [],
        flags: [],
        selected: null,
        collectingPart: false,
        shop: state.time,
    };
}

// Continue digging on the current day.
function resumeDigging(state) {
    state = {
        ...state,
        usingBombDiffuser: false,
        displayLavaDepth: state.saved.lavaDepth,
        incoming: true,
        saved: {
            ...state.saved,
            seed: random.nextSeed(state.saved.seed),
            playedToday: false,
            // Top off fuel + bomb diffusers before digging each day.
            fuel: Math.max(state.saved.fuel, state.saved.maxFuel),
            bombDiffusers: Math.max(state.saved.bombDiffusers, state.saved.maxBombDiffusers),
        },
        camera: getNewCamera(state.saved.lavaDepth || 100),
        rows: [],
        flags: [],
        collectingPart: false,
        shop: false,
        ship: false,
        bgmTime: state.time,
        selected: null,
    };
    return showIncomingHint(state);
}

function restart(state) {
    state = nextDay({
        ...state,
        startingDepth: 1,
        showAchievements: false,
        displayFuel: 0,
        displayLavaDepth: INITIAL_LAVA_DEPTH,
        bgmTime: state.time,
        saved: {
            ...state.saved,
            score: 0,
            day: 0,
            maxBombDiffusers: 3,
            bombDiffusers: 3,
            explosionProtection: 0.2,
            range: 1.2,
            maxFuel: 100,
            maxDepth: 0,
            lavaDepth: INITIAL_LAVA_DEPTH,
            shipPart: 0,
        }
    });
    return updateSave({...state, shop: false, ship: false}, {finishedIntro: false});
}

function getOverButton(state, coords = {}) {
    const {x, y} = coords;
    if (!(x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height)) return null;
    let allButtons = getHUDButtons(state).reverse();
    // Only the button set by the hint can be used while instructions are displayed.
    if (state.instructionsAlpha > 0) {
        allButtons = [];
        if (state.hintButton && new Rectangle(state.hintButton).containsPoint(x, y)) {
            return state.hintButton;
        }
        return null;
    }
    for (const hudButton of allButtons) {
        if (new Rectangle(hudButton).containsPoint(x, y)) {
            return hudButton;
        }
    }
    return getOverCell(state, {x, y});
}

function setButtonState(state) {
    if (state.mouseDownCoords && !state.mouseDown) {
        const startButton = getOverButton(state, state.mouseDownCoords);
        const lastButton = getOverButton(state, state.lastMouseCoords);
        const buttonsMatch = startButton && lastButton && (lastButton === startButton ||
            (lastButton.cell && lastButton.row === startButton.row && lastButton.column === startButton.column));
        // Clicking on a cell fails during a drag operation.
        // We check for drags longer than a short distance so that moving the mouse slightly on click doesn't
        // prevent clicking a cell.
        const dragIsBlocking = state.mouseDragged && state.dragDistance >= 10;
        if (buttonsMatch && !(dragIsBlocking && lastButton.cell)) {
            state = {...state, clicked: true};
        } else if (state.instructionsAlpha && !dragIsBlocking) {
            state = {...state, clicked: true};
        }
        state = {...state, mouseDragged: false, mouseDownCoords: false};
    }
    if (!state.mouseDown && state.mouseDownCoords) {
        state = {...state, mouseDownCoords: false};
    }
    if (state.lastMouseCoords) {
        state = {...state, overButton: getOverButton(state, state.lastMouseCoords)};
    } else if (!state.clicked && !state.rightClicked) {
        state = {...state, overButton: null};
    }
    return state;
}
function advanceState(state) {
    if (!areImagesLoaded() || !state.interacted) return state;
    state = {...state, time: state.time + FRAME_LENGTH}
    // Turn off the collecting part (and enable buttons again) after the part teleports in.
    if (state.collectingPart && state.ship && state.time - state.ship > arriveAnimation.duration) {
        state = {...state, collectingPart: false};
    }
    // Go beyond 1 alpha as a hack to make it take longer to fade.
    const maxAlpha = 1 + (state.saved.hideHelp ? 0.5 : 2);
    const showHelp = shouldShowHelp(state);
    if (state.instructionsAlpha < maxAlpha && showHelp) {
        state.instructionsAlpha += 0.1;
    } else if (state.instructionsAlpha > 0 && !showHelp) {
        state.instructionsAlpha -= 0.05;
    }
    const disableDragging = state.title || state.collectingPart || state.incoming || state.leaving
        || state.ship || state.shop || state.showAchievements || state.showOptions || !state.saved.finishedIntro;
    if (!disableDragging && state.mouseDown && state.mouseDragged && state.lastProcessedMouseCoords) {
        const camera = {...state.camera};
        const dx = state.lastMouseCoords.x - state.lastProcessedMouseCoords.x;
        const dy = state.lastMouseCoords.y - state.lastProcessedMouseCoords.y;
        camera.left = Math.min(Math.max(camera.left - dx, camera.minX - canvas.width / 2), camera.maxX - canvas.width / 2);
        camera.top = Math.min(Math.max(camera.top - dy, camera.minY - canvas.height / 2), camera.maxY - canvas.height / 2);
        state = {...state, selected: false, targetCell: false, camera, dragDistance: state.dragDistance + Math.abs(dx) + Math.abs(dy)};
    }
    if (!state.saved.finishedIntro || state.ship || state.shop || state.title) {
        state = {...state, camera: {...state.camera, top : getTopTarget()}};
    }
    state = setButtonState(state);
    state.lastProcessedMouseCoords = state.lastMouseCoords;
    for (const hudButton of getHUDButtons(state)) {
        if (hudButton.advance) {
            state = hudButton.advance(state, hudButton);
        }
    }
    state = advanceAchievements(state);
    const disableButtons = state.leaving || state.incoming || state.collectingPart;
    if (!disableButtons && state.clicked && state.overButton && state.overButton.onClick) {
        state = state.overButton.onClick(state, state.overButton);
    } else if (state.clicked && state.instructionsAlpha > 0) {
        state = {...state,
            instructionsAlpha: Math.min(1, state.instructionsAlpha),
            showHint: false,
            showHintIncoming: false,
            showHintLeaving: false,
        };
        delete state.hintButton;
    }
    const isIntroPlaying = state.outroTime === false && (state.saveSlot !== false && !state.saved.finishedIntro);
    if (state.outroTime !== false) {
        if (state.outroTime === 6300) playSoundWithState(state, 'shipWarp');
        state = {
            ...state,
            outroTime: state.outroTime + FRAME_LENGTH,
        };
    } else if (isIntroPlaying) {
        state = {
            ...state,
            introTime: (state.introTime || 0) + FRAME_LENGTH,
        };
        if (state.introTime >= introSequenceDuration) {
            state = updateSave(resumeDigging(state), {finishedIntro: true});
        }
    } else if (!state.showAchievements && !state.showOptions && !state.shop && !state.ship && !state.title) {
        state = advanceDigging(state);
    }
    for (let spriteId in state.spriteMap) {
        state = state.spriteMap[spriteId].advance(state, state.spriteMap[spriteId]);
    }
    const canShowOptions = state.outroTime === false && !isIntroPlaying && !state.incoming && !state.leaving;
    const isEscapeKeyDown = isKeyDown(KEY_ESCAPE);
    if (canShowOptions) {
        const wasEscapedKeyPressedThisFrame = !state.wasEscapeKeyDown && isEscapeKeyDown;
        if (wasEscapedKeyPressedThisFrame) {
            state = {
                ...state,
                showOptions: state.showOptions ? false : state.time,
            };
        }
    }
    state = {
        ...state,
        wasEscapeKeyDown: isEscapeKeyDown,
    };
    return {...state, clicked: false, rightClicked: false};
}

function applyActions(state, actions) {
    state = {...state, actions};
    if (!state.interacted) {
        for (var i in actions) {
            if (actions[i]) return {...state, interacted: true};
        }
    }
    return state
}


