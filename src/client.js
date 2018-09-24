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
        // In some IOS safari browsers, using for (const changedTouch of event.changedTouches)
        // throws an error, so use a regular for loop here. This is technically a TouchList so
        // maybe they didn't implement the interface needed to iterate in this fashion.
        for (let i = 0; i < event.changedTouches.length; i++) {
            const changedTouch = event.changedTouches[i];
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
    state.dragDistance = 0;
    state.mouseDragged = false;
    state.mouseDownCoords = state.lastMouseCoords = getEventCoords(event);
    event.preventDefault();
    return false;
}
function onMouseMove(event) {
    state.lastMouseCoords = getEventCoords(event);
    if (state.mouseDownCoords) {
        state.mouseDragged = true;
    }
    event.preventDefault();
    return false;
}
function onMouseUp(event) {
    state.mouseDown = false;
    event.preventDefault();
    return false;
}
/*
TODO:
Constrain scrolling to max rectangle that has been played in:
    -Set left/top/right/bottom bounds and constrain within this.

Add animated lava starting at depth 30.
Lava lowers 10% for every crystal discovered within 10 depth of the current level, up to 100% for
crystals found immediately above the current level of the lava. Lava gradually falls to the current target depth.
Remove maximum depth indicator line (the lava will approximate this functionality).

Research optimization for mobile browsers:
    -Scale the canvas to fill the screen, modify tile size based on canvas dimensions.

*/

const update = () => {
    if (!state) {
        state = getNewState();
        state.context = context;
        if (savedState && !queryParams.reset) {

            // console.log(`Loading state from ${saveKey}`, savedState);
            state.saved = {...state.saved, ...savedState};
            state = initializeAchievements(state);
            // Decrement day by 1 if they haven't played yet today so that
            // caling next day leaves them on the same day.
            if (!state.saved.playedToday) {
                state.saved.day--;
            }
            state = nextDay(state);
        }
        savedState = state.saved;
        canvas.onmousedown =  onMouseDown;
        canvas.oncontextmenu = function (event) {
            state.rightClicked = true;
            state.mouseDownCoords = false;
            state.mouseDown = false;
            event.preventDefault();
            return false;
        }
        document.onmousemove = onMouseMove;
        document.onmouseup = onMouseUp;
        canvas.onmouseout = function (event) {
            state.mouseDownCoords = state.lastMouseCoords = null;
            event.preventDefault();
            return false;
        };
        canvas.addEventListener("touchstart", onMouseDown);
        canvas.addEventListener("touchend", onMouseUp);
        canvas.addEventListener("touchmove", onMouseMove);
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

const { initializeAchievements } = require('achievements');
