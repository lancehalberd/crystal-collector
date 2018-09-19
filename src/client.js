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

function getEventCoords(event) {
    let x = 0, y = 0;
    if (event.changedTouches && event.changedTouches.length) {
        for (const changedTouch of event.changedTouches) {
            x += changedTouch.pageX;
            y += changedTouch.pageY;
        }
        x = Math.round(x / event.changedTouches.length);
        y = Math.round(y / event.changedTouches.length);
    } else {
        x = event.pageX;
        y = event.pageY;
    }
    x -= canvas.offsetLeft;
    y -= canvas.offsetTop;
    return {x, y};
}
function onMouseDown(event) {
    state.interacted = true;
    state.mouseDown = state.time;
    state.mouseDownCoords = state.lastMouseCoords = getEventCoords(event);
    event.preventDefault();
    return false;
}
function onMouseMove(event) {
    state.lastMouseCoords = getEventCoords(event);
    event.preventDefault();
    return false;
}
function onMouseUp(event) {
    state.mouseDown = false;
    event.preventDefault();
    return false;
}

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
        canvas.onmousedown = canvas.ontouchstart = onMouseDown;
        canvas.oncontextmenu = function (event) {
            state.rightClicked = true;
            state.mouseDownCoords = false;
            state.mouseDown = false;
            event.preventDefault();
            return false;
        }
        canvas.onmousemove = canvas.ontouchmove = onMouseMove;
        canvas.onmouseup = canvas.ontouchend = onMouseUp;
        canvas.onmouseout = function () {
            state.mouseDownCoords = state.lastMouseCoords = null;
            return false;
        };
        canvas.addEventListener("touchstart", onMouseDown, false);
        canvas.addEventListener("touchend", onMouseUp, false);
        canvas.addEventListener("touchmove", onMouseMove, false);
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

