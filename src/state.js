const Rectangle = require('Rectangle');
const random = require('random');

const {
    FRAME_LENGTH, WIDTH, HEIGHT,
    EDGE_LENGTH, COLUMN_WIDTH, ROW_HEIGHT,
    SHORT_EDGE, LONG_EDGE,
} = require('gameConstants');

function getNewState() {
    return {
        actions: {},
        fuel: 100,
        camera: {
            left: -WIDTH / 2 + EDGE_LENGTH,
            top: -100,
        },
        rows: {},
        flags: {},
        sfx: {},
        bgm: 'bgm/title.mp3',
        interacted: false,
        spriteMap: {},
        saved: {
            range: 1.2,
            maxFuel: 100,
            seed: random.nextSeed(),
            day: 1,
            maxDepth: 1,
            score: 0,
            playedToday: false,
        },
    };
}

function nextDay(state) {
    return {
        ...state,
        saved: {
            ...state.saved,
            day: state.saved.day + 1,
            seed: random.nextSeed(state.saved.seed),
            playedToday: false,
        },
        camera: {
            left: -WIDTH / 2 + EDGE_LENGTH,
            top: -100,
        },
        rows: {},
        flags: {},
        fuel: state.saved.maxFuel,
        selected: null,
        lastValidOverCell: null,
        shop: true,
    };
}

function setOverButton(state) {
    let overButton = null;
    if (!state.mouseCoords) {
        return {...state, overButton};
    }
    let {x, y} = state.mouseCoords;
    if (x < 0 || x > WIDTH || y < 0 || y > HEIGHT) {
        return {...state, overButton};
    }
    for (const hudButton of getHUDButtons(state)) {
        if (new Rectangle(hudButton).containsPoint(x, y)) {
            return {...state, overButton: hudButton};
        }
    }
    return {...state, overButton};
}
function advanceState(state) {
    state = setOverButton(state);
    if (state.clicked && state.overButton) {
        state = state.overButton.onClick(state, state.overButton);
    }
    if (!state.shop) {
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
};

const { getHUDButtons } = require('hud');

const { advanceDigging } = require('digging');


