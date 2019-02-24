const Rectangle = require('Rectangle');
const random = require('random');

const {
    FRAME_LENGTH, canvas, EDGE_LENGTH, ROW_HEIGHT,
} = require('gameConstants');

const INITIAL_LAVA_DEPTH = 100;

function getNewCamera(lavaDepth = INITIAL_LAVA_DEPTH) {
    return {
        left: -canvas.width / 2 + EDGE_LENGTH,
        top: -100,
        minX: 1E9,
        maxX: -1E9,
        minY: 1E9,
        maxY: lavaDepth * ROW_HEIGHT / 2 + ROW_HEIGHT / 2,//-1E9,
    };
}

function getNewState() {
    return {
        actions: {},
        fuel: 100,
        bombDiffusers: 3,
        displayFuel: 0,
        camera: getNewCamera(),
        rows: [],
        flags: [],
        sfx: {},
        bgm: 'bgm/title.mp3',
        interacted: false,
        time: 20,
        spriteMap: {},
        startingDepth: 1,
        bombsDiffusedToday: 0,
        bonusFuelToday: 0,
        crystalsCollectedToday: 0,
        displayLavaDepth: INITIAL_LAVA_DEPTH,
        saved: {
            bombDiffusers: 3,
            explosionProtection: 0.2,
            range: 1.2,
            maxFuel: 100,
            seed: random.nextSeed(),
            day: 1,
            maxDepth: 0,
            score: 0,
            playedToday: false,
            achievementStats: {},
            lavaDepth: INITIAL_LAVA_DEPTH,
        },
    };
}

function nextDay(state) {
    return {
        ...state,
        bombsDiffusedToday: 0,
        bonusFuelToday: 0,
        crystalsCollectedToday: 0,
        usingBombDiffuser: false,
        displayLavaDepth: state.saved.lavaDepth,
        saved: {
            ...state.saved,
            day: state.saved.day + 1,
            seed: random.nextSeed(state.saved.seed),
            playedToday: false,
        },
        camera: getNewCamera(state.saved.lavaDepth || 100),
        rows: [],
        flags: [],
        fuel: state.saved.maxFuel,
        bombDiffusers: state.saved.bombDiffusers + getAchievementBonus(state, ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY),
        selected: null,
        shop: state.time,
    };
}

function restart(state) {
    state = nextDay({
        ...state,
        startingDepth: 1,
        showAchievements: false,
        displayFuel: 0,
        displayLavaDepth: INITIAL_LAVA_DEPTH,
        saved: {
            ...state.saved,
            score: 0,
            day: 0,
            bombDiffusers: 3,
            explosionProtection: 0.2,
            range: 1.2,
            maxFuel: 100,
            maxDepth: 0,
            lavaDepth: INITIAL_LAVA_DEPTH,
        }
    });
    return {...state, shop: false};
}

function getOverButton(state, coords = {}) {
    const {x, y} = coords;
    if (!(x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height)) return null;
    for (const hudButton of getHUDButtons(state)) {
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
        }
        state = {...state, mouseDragged: false, mouseDownCoords: false, lastMouseCoords: false};
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
    state = {...state, time: state.time + FRAME_LENGTH}
    if (!state.shop && !state.showAchievements && state.mouseDown && state.mouseDragged && state.lastProcessedMouseCoords) {
        const camera = {...state.camera};
        const dx = state.lastMouseCoords.x - state.lastProcessedMouseCoords.x;
        const dy = state.lastMouseCoords.y - state.lastProcessedMouseCoords.y;
        camera.left = Math.min(Math.max(camera.left - dx, camera.minX - canvas.width / 2), camera.maxX - canvas.width / 2);
        camera.top = Math.min(Math.max(camera.top - dy, camera.minY - canvas.height / 2), camera.maxY - canvas.height / 2);
        state = {...state, selected: false, targetCell: false, camera, dragDistance: state.dragDistance + Math.abs(dx) + Math.abs(dy)};
    }
    state = setButtonState(state);
    state.lastProcessedMouseCoords = state.lastMouseCoords;
    for (const hudButton of getHUDButtons(state)) {
        if (hudButton.advance) {
            state = hudButton.advance(state, hudButton);
        }
    }
    state = advanceAchievements(state);
    if (state.clicked && state.overButton && state.overButton.onClick) {
        state = state.overButton.onClick(state, state.overButton);
    }
    if (!state.showAchievements && !state.shop) {
        state = advanceDigging(state);
    }
    for (let spriteId in state.spriteMap) {
        state = state.spriteMap[spriteId].advance(state, state.spriteMap[spriteId]);
    }
    //camera.top += 1;
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

module.exports = {
    getNewState,
    advanceState,
    applyActions,
    nextDay,
    restart,
};

const { getHUDButtons } = require('hud');

const { advanceDigging, getOverCell } = require('digging');

const {
    advanceAchievements,
    getAchievementBonus,
    ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY,
} = require('achievements');

