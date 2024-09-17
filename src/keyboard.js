/* global navigator */
// convert to using event.key output instead of deprecated event.which
export const KEY_LEFT = 'ArrowLeft';
export const KEY_RIGHT = 'ArrowRight';
export const KEY_UP = 'ArrowUp';
export const KEY_DOWN = 'ArrowDown';
export const KEY_SPACE = ' ';
export const KEY_SHIFT = 'Shift';
export const KEY_ENTER = 'Enter';
export const KEY_BACK_SPACE = 'Backspace';
export const KEY_ESCAPE = 'Escape';
export const KEY_E = 'e';
export const KEY_G = 'g';
export const KEY_R = 'r';
export const KEY_X = 'x';
export const KEY_C = 'c';
export const KEY_V = 'v';
export const KEY_T = 't';

const KEY_MAPPINGS = {
    ['a']: KEY_LEFT,
    ['d']: KEY_RIGHT,
    ['w']: KEY_UP,
    ['s']: KEY_DOWN,
};

// This mapping assumes a canonical gamepad setup as seen in:
// https://w3c.github.io/gamepad/#remapping
// Which seems to work well with my xbox 360 controller.
// I based this code on examples from:
// https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
// Easy to find mappings at: http://html5gamepad.com/
var GAME_PAD_MAPPINGS = {
    [KEY_C]: 0, // A (bottom button)
    [KEY_V]: 1, // B (right button)
    [KEY_SPACE]: 2, // X (left button)
    [KEY_X]: 3, // Y (top button)
    [KEY_ENTER]: 9, // START
    [KEY_UP]: 12,
    [KEY_DOWN]: 13,
    [KEY_LEFT]: 14,
    [KEY_RIGHT]: 15,
    [KEY_R]: 4, // L Front Bumper
    [KEY_SHIFT]: 5,  // R Front bumper
};

const physicalKeysDown = {};
const keysDown = {};


// Apparently, depending on the button type, either button.pressed or button == 1.0 indicates the button is pressed.
function buttonIsPressed(button) {
  if (typeof(button) == "object") return button.pressed;
  return button == 1.0;
}

window.document.onkeydown = function (event) {
    // console.log(event.key);
    // Don't process this if the key is already down.
    if (physicalKeysDown[event.key]) return;
    physicalKeysDown[event.key] = true;
    const mappedKeyCode = KEY_MAPPINGS[event.key] || event.key;
    keysDown[mappedKeyCode] = (keysDown[mappedKeyCode] || 0) + 1;
    //console.log(keysDown[mappedKeyCode]);
};

window.document.onkeyup = function (event) {
    physicalKeysDown[event.key] = false;
    const mappedKeyCode = KEY_MAPPINGS[event.key] || event.key;
    keysDown[mappedKeyCode] = Math.max(0, (keysDown[mappedKeyCode] || 0) - 1);
    //console.log(keysDown[mappedKeyCode]);
};

const lastButtonsPressed = {};
// Release can be set to true to pretend the key is released after reading it.
// This only works for keyboard keys.
export const isKeyDown = (keyCode, release = false) => {
    if (keysDown[keyCode]) {
        if (release) {
            keysDown[keyCode] = 0;
        }
        return true;
    }
    // If a mapping exists for the current key code to a gamepad button,
    // check if that gamepad button is pressed.
    var buttonIndex = GAME_PAD_MAPPINGS[keyCode];
    if (typeof(buttonIndex) !== 'undefined') {
        // There can be multiple game pads connected. For now, let's just check all of them for the button.
        var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads : []);
        for (var gamepad of gamepads) {
            if (!gamepad) continue;
            if (buttonIsPressed(gamepad.buttons[buttonIndex])) {
                const wasPressed = lastButtonsPressed[buttonIndex];
                lastButtonsPressed[buttonIndex] = true;
                if (!release || !wasPressed) return true;
            } else {
                lastButtonsPressed[buttonIndex] = false;
            }
        }
    }
    return false;
};
