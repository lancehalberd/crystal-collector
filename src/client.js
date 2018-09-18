const {
    FRAME_LENGTH, WIDTH, HEIGHT,
} = require('gameConstants');

const { preloadSounds } = require('sounds');

const {
    getNewState,
    advanceState,
    nextDay,
} = require('state');
const render = require('render');

/*const { isKeyDown,
    KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_SPACE,
    KEY_ENTER, KEY_R, KEY_X, KEY_C, KEY_V,
    KEY_T,
} = require('keyboard');*/

preloadSounds();
let preloadedSounds = true;
let stateQueue = [];
let state = null;

const queryParams = {};
window.location.search.slice(1).split('&')
    .map(pairString => pairString.split('='))
    .forEach(pair => queryParams[pair[0]] = pair[1]);
const saveKey = queryParams.save ? `save-${queryParams.save}` : 'defaultSave';
let savedState;
try {
    savedState = JSON.parse(window.localStorage.getItem(saveKey));
} catch (e) {
    console.log('Invalid save data');
}


const canvas = document.createElement('canvas');
window.canvas = canvas;
canvas.width = WIDTH;
canvas.height = HEIGHT;
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;
document.body.appendChild(canvas);

const update = () => {
    if (!state) {
        state = getNewState();
        if (savedState && !queryParams.reset) {
            // console.log(`Loading state from ${saveKey}`, savedState);
            state.saved = savedState;
            if (state.saved.playedToday) {
                state = nextDay(state);
            } else {
                state.shop = true;
            }
        }
        savedState = state.saved;
        canvas.onclick = function () {
            state.clicked = true;
            state.interacted = true;
        };
        canvas.oncontextmenu = function () {
            state.rightClicked = true;
            return false;
        }
        canvas.onmousemove = function (event) {
            const x = event.pageX - canvas.offsetLeft;
            const y = event.pageY - canvas.offsetTop;
            state.mouseCoords = {x, y};
        };
        canvas.onmouseout = function () {
            state.mouseCoords = null;
        };
    }

    if (!preloadedSounds && state.interacted) {
        preloadSounds();
        preloadedSounds = true;
    }

    //if (stateQueue.length && isKeyDown(KEY_R)) {
    //    state = stateQueue.shift();
    //} else {
        state = advanceState(state);
        if (!state.title && !state.paused) {
            stateQueue.unshift(state);
        }
    //}

    stateQueue = stateQueue.slice(0, 200);
    //render(state);
    // This is here to help with debugging from console.
    window.state = state;
    window.stateQueue = stateQueue;
    if (state.saved !== savedState) {
        savedState = state.saved;
        // console.log(`Saving state to ${saveKey}`, savedState);
        window.localStorage.setItem(saveKey, JSON.stringify(savedState));
    }
};
setInterval(update, FRAME_LENGTH);

const renderLoop = () => {
    try {
        if (state) render(context, state);
        window.requestAnimationFrame(renderLoop);
    } catch (e) {
        console.log(e);
        debugger;
    }
};
renderLoop();

