/* global navigator */
export const KEY_LEFT = 37;
export const KEY_RIGHT = 39;
export const KEY_UP = 38;
export const KEY_DOWN = 40;
export const KEY_SPACE = 32;
export const KEY_SHIFT = 16;
export const KEY_ENTER = 13;
export const KEY_BACK_SPACE = 8;
export const KEY_E = 'E'.charCodeAt(0);
export const KEY_G = 'G'.charCodeAt(0);
export const KEY_R = 'R'.charCodeAt(0);
export const KEY_X = 'X'.charCodeAt(0);
export const KEY_C = 'C'.charCodeAt(0);
export const KEY_V = 'V'.charCodeAt(0);
export const KEY_T = 'T'.charCodeAt(0);

const KEY_MAPPINGS = {
    ['A'.charCodeAt(0)]: KEY_LEFT,
    ['D'.charCodeAt(0)]: KEY_RIGHT,
    ['W'.charCodeAt(0)]: KEY_UP,
    ['S'.charCodeAt(0)]: KEY_DOWN,
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
    //console.log(event);
    // Don't process this if the key is already down.
    if (physicalKeysDown[event.which]) return;
    physicalKeysDown[event.which] = true;
    const mappedKeyCode = KEY_MAPPINGS[event.which] || event.which;
    keysDown[mappedKeyCode] = (keysDown[mappedKeyCode] || 0) + 1;
    //console.log(keysDown[mappedKeyCode]);
};

window.document.onkeyup = function (event) {
    physicalKeysDown[event.which] = false;
    const mappedKeyCode = KEY_MAPPINGS[event.which] || event.which;
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
