const {
    canvas, FRAME_LENGTH,
} = require('gameConstants');

const { preloadSounds, muteSounds } = require('sounds');

const {
    getNewState,
    advanceState,
} = require('state');
const render = require('render');

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
} catch (e) {
    console.log('Invalid save data');
}
window.savedState = savedState;

const context = canvas.getContext('2d', {alpha: false});
context.imageSmoothingEnabled = false;

function updateCanvasSize() {
    let scale = window.innerWidth / 800;
    if (scale <= 0.75) {
        canvas.width = 600;
        scale *= 4 / 3;
    } else {
        canvas.width = 800;
    }
    canvas.height = Math.max(300, Math.ceil(window.innerHeight / scale));
    canvas.style.transformOrigin = '0 0'; //scale from top left
    canvas.style.transform = 'scale(' + scale + ')';
    canvas.scale = scale;
    window.canvas = canvas;
    if (state) state.lastResized = Date.now();
    context.imageSmoothingEnabled = false;
}
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

const update = () => {
    if (!state) {
        state = getNewState();
        state.saved.muteMusic = savedState.muteMusic;
        state.saved.muteSounds = savedState.muteSounds;
        state.saveSlots = savedState.saveSlots;
        state.lastResized = Date.now();
        state.context = context;
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
    const now = Date.now();
    if (state.saveSlot !== false && state.saved !== savedState.saveSlots[state.saveSlot]) {
        savedState.saveSlots[state.saveSlot] = state.saved;
        changedLocalStorage = now;
    }
    if (!!state.saved.muteSounds !== !!savedState.muteSounds) {
        savedState.muteSounds = !!state.saved.muteSounds;
        changedLocalStorage = now;
    }
    if (!!state.saved.muteMusic !== !!savedState.muteMusic) {
        savedState.muteMusic = !!state.saved.muteMusic;
        changedLocalStorage = now;
    }
    if (!!state.saved.hideHelp !== !!savedState.hideHelp) {
        savedState.hideHelp = !!state.saved.hideHelp;
        changedLocalStorage = now;
    }
    if (!!state.saved.disableAutoscroll !== !!savedState.disableAutoscroll) {
        savedState.disableAutoscroll = !!state.saved.disableAutoscroll;
        changedLocalStorage = now;
    }
    // Only commit to local storage once every 5 seconds.
    if (changedLocalStorage > savedLocalStorage && now - savedLocalStorage > 5000) {
        //console.log("Attempting to save to local storage");
        savedLocalStorage = now;
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
//setInterval(renderLoop, 5);
renderLoop();

/*
import {Howl, Howler} from 'howler';
var sound = new Howl({
  src: ['bgm/victory.ogg'],
  loop: true,
  volume: 0.5,
  onend: function() {
      sound.seek(4);
  }
});
console.log('calling play');
sound.play();
*/

