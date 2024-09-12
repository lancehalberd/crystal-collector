const {
    canvas, context, FRAME_LENGTH,
} = require('gameConstants');

const { preloadSounds } = require('sounds');

const {
    getNewState,
    advanceState,
} = require('state');
const render = require('render');
const { optionFlags } = require('options');

preloadSounds();
let preloadedSounds = true;
let stateQueue = [];
let state = null;

const saveKey = 'defaultSave';
let savedState;
let changedLocalStorage = Date.now();
let savedLocalStorage = changedLocalStorage;
try {
    savedState = JSON.parse(window.localStorage.getItem(saveKey));
} catch (e) {
    console.log('Invalid save data');
}
if (!savedState) {
    savedState = {
        disableAutoscroll: false,
        hideHelp: false,
        muteSounds: false,
        muteMusic: false,
        saveSlots: [],
    };
}
// Convert legacy saved data to newer format that supports multiple save slots.
if (!savedState.saveSlots) {
    savedState = {
        disableAutoscroll: false,
        hideHelp: false,
        muteSounds: false,
        muteMusic: false,
        saveSlots: [
            {...savedState},
        ],
    };
}
window.savedState = savedState;

function updateCanvasSize() {
    let scale = window.innerWidth / 800;
    if (scale <= 0.75) {
        canvas.width = 600;
        scale *= 4 / 3;
    } else {
        canvas.width = 800;
    }
    scale = Math.max(1, Math.floor(scale));
    canvas.height = Math.max(300, Math.ceil(window.innerHeight / scale));
    canvas.width = Math.ceil(window.innerWidth / scale);
    canvas.style.transformOrigin = '0 0'; //scale from top left
    canvas.style.transform = 'scale(' + scale + ')';
    canvas.scale = scale;
    window.canvas = canvas;
    if (state) state.lastResized = Date.now();
    context.imageSmoothingEnabled = false;
}
// Disable resizing on Kongregate to see if it reduces flicker.
updateCanvasSize();
window.onresize = updateCanvasSize;

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
    x /= canvas.scale;
    y /= canvas.scale;
    return {x, y};
}
function onMouseDown(event) {
    if (!state.interacted) {
        state.interacted = true;
        return false;
    }
    if (event.which === 1) {
        state.mouseDown = state.time;
        state.dragDistance = 0;
        state.mouseDragged = false;
        state.mouseDownCoords = state.lastMouseCoords = getEventCoords(event);
    } else if (event.which === 3) {
        state.rightMouseDownCoords = state.lastMouseCoords = getEventCoords(event);
    }
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
    if (event.which === 3) {
        const coords = getEventCoords(event);
        if (Math.abs(coords.x - state.rightMouseDownCoords.x) < 10 &&
            Math.abs(coords.y - state.rightMouseDownCoords.y) < 10
        ) {
            state.rightClicked = true;
        }
    }
    event.preventDefault();
    return false;
}

const update = () => {
    if (!state) {
        state = getNewState();
        state.saved.muteMusic = savedState.muteMusic;
        state.saved.muteSounds = savedState.muteSounds;
        state.saveSlots = savedState.saveSlots;
        state.lastResized = Date.now();
        state.context = context;
        canvas.onmousedown = onMouseDown;
        canvas.oncontextmenu = function (event) {
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
        canvas.addEventListener("mousedown", onMouseDown);
        canvas.addEventListener("mouseup", onMouseUp);
        canvas.addEventListener("mousemove", onMouseMove);
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
    const now = Date.now();
    if (state.saveSlot !== false && state.saved !== savedState.saveSlots[state.saveSlot]) {
        savedState.saveSlots[state.saveSlot] = state.saved;
        changedLocalStorage = now;
    }
    for (const optionFlag of optionFlags) {
        if (!!state.saved[optionFlag] !== !!savedState[optionFlag]) {
            savedState[optionFlag] = !!state.saved[optionFlag];
            changedLocalStorage = now;
        }
    }
    // Only commit to local storage once every 5 seconds.
    if (changedLocalStorage > savedLocalStorage && now - savedLocalStorage >= 5000) {
        //console.log("Attempting to save to local storage");
        savedLocalStorage = now;
        commitSaveToLocalStorage(state);
    }
};
setInterval(update, FRAME_LENGTH);

export function commitSaveToLocalStorage(state) {
    if (state.saveSlot !== false && state.saved !== savedState.saveSlots[state.saveSlot]) {
        savedState.saveSlots[state.saveSlot] = state.saved;
    }
    window.localStorage.setItem(saveKey, JSON.stringify(savedState));
}

const renderLoop = () => {
    try {
        if (state) render(context, state);
        window.requestAnimationFrame(renderLoop);
    } catch (e) {
        console.log(e);
        debugger;
    }
};
//setInterval(renderLoop, 5);
renderLoop();
