module.exports = {
    renderHelp,
    shouldShowHelp,
    showIncomingHint,
    showLeavingHint,
    showSpecialHint,
    showNextHint,
};
const { canvas } = require('gameConstants');
const { drawRectangle, drawText } = require('draw');
const { getLayoutProperties, renderButtonBackground, getHelpButton } = require('hud');
const { shipPartDepths } = require('ship');
const { updateSave } = require('state');

const incomingAdvice = [
    {label: 'You can keep digging for crystals until you run out of energy.'},
    {label: 'Each blue diamond means crystals can be found in or next to that area.'},
    {label: 'Better sensors let you dig further and reveal bonus information.'},
    {label: 'Energy Extractors can convert dangerous debris into valuable energy.'},
    {label: 'Explosion Protection can prevent some of the explosions from unstable debris.'},
    {label: 'Digging deeper uses more energy, but you will also find more crystals.'},
    {label: 'Crystals have absorbed energy from the fallen ship debris.'},
    {label: 'When you find crystals you will gain energy instead of losing it.'},
    {label: 'Exclamation points mark special cargo and ship parts that survived the impact.'},
    {label: 'There is a way to tell when a stable ship part is nearby.'},
    {label: 'If a revealed tile is empty, there will never be anything in or next to it.'},
];

const leavingAdvice = [
    {label: 'Spend crystals to upgrade Dig Bot when you return to the ship.'},
    {label: 'Unstable ship debris marked by nearby red squares will explode.'},
    {label: 'The range of your sensors decreases as you dig deeper.'},
    {label: 'Energy Extractors will also convert crystals into energy.'},
    {label: 'Unstable debris will cause even more explosions as you dig deeper.'},
    {label: 'Most of the unstable ship debris is buried deep beneath the surface.'},
    {label: 'Unlocking achievements will improve Dig Bot\'s capabilities.'},
    {label: 'You will need to find five stable ship parts to repair your warp drive.'},
    {label: 'If an obstacle blocks your way, try searching for crystals nearby.'},
    {label: 'You can start over from day 1 with all of your achievements after repairing your ship.'},
];

const incomingStack = [...incomingAdvice];
const leavingStack = [...leavingAdvice];
const allAdvice = [];
while (incomingStack.length || leavingStack.length) {
    if (incomingStack.length) allAdvice.unshift(incomingStack.pop());
    if (leavingStack.length) allAdvice.unshift(leavingStack.pop());
}

function shouldShowHelp(state) {
    //if (state.incoming) console.log(state.hintLines, state.showHintIncoming);
    if (!state.hintLines) return false;
    // Show help when entering/leaveing each day.
    if (state.showHintIncoming && state.incoming) return true;
    if (state.showHintLeaving && state.leaving) return true;
    // Show help if the user clicked the hint button.
    if (state.showHint) return true;
    return false;
}

function splitHint(hintText) {
    const textArray = hintText.split(' ');
    const half = Math.floor(textArray.length / 2);
    return [
        textArray.slice(0, half).join(' '),
        textArray.slice(half).join(' ')
    ];
}

function showNextHint(state) {
    let nextHint = (state.saved.nextHint >= 0) ? state.saved.nextHint : 0;
    const hintLines = splitHint(allAdvice[nextHint % allAdvice.length].label);
    state = updateSave(state, {nextHint: nextHint + 1});
    return {
        ...state,
        hintLines,
        showHint: true,
        hintButton: getHelpButton(),
    };
}

function showIncomingHint(state) {
    let hintLines = [];
    const depth = shipPartDepths[Math.min(state.saved.shipPart, shipPartDepths.length - 1)];
    // Show a message as a warning when a player starts below the next ship part they need to
    // collect, otherwise, they may miss it and have trouble finding where it was.
    if (state.startingDepth > depth) {
        hintLines = [
            'A stable ship part has been',
            `detected near depth ${depth}`
        ];
    } else if (!state.saved.hideHelp) {
        hintLines = splitHint(incomingAdvice[(state.saved.day - 1) % incomingAdvice.length].label);
    }
    hintLines = [`DAY ${state.saved.day}`, ...hintLines];
    return {
        ...state,
        hintLines,
        // This combination will hide the hint after the user reaches the planet.
        showHint: false,
        showHintIncoming: true,
    };
}

function showLeavingHint(state) {
    let hintLines;
    // Show a message when the player collects a stable ship part.
    if (state.collectingPart) {
        // Acquiring a ship part doesn't advance the day, so say "day" instead of "night"
        // when returning to the ship.
        hintLines = ['Stable Ship Part Acquired!'];
        hintLines = [`DAY ${state.saved.day}`, ...hintLines];
    } else if (!state.saved.hideHelp) {
        hintLines = splitHint(leavingAdvice[(state.saved.day - 1) % leavingAdvice.length].label);
        hintLines = [`NIGHT ${state.saved.day}`, ...hintLines];
    }
    return {
        ...state,
        hintLines,
        // This combination will hide the hint after the user reaches the ship.
        showHint: false,
        showHintLeaving: true,
    };
}

function showSpecialHint(state, hintLines) {
    if (state.saved.hideHelp) return state;
    return {
        ...state,
        hintLines,
        // This hint will only be hidden when the user clicks to dismiss it.
        showHint: true,
    };
}

function renderHelp(context, state) {
    const { buttonWidth, buttonHeight, buttonFontSize } = getLayoutProperties(state);
    const height = state.hintLines.length * 2 * buttonHeight / 3 + buttonHeight;
    const rectangle = {
        left: canvas.width / 2 - 2.5 * buttonWidth,
        top: canvas.height - buttonHeight - height,
        width: 5 * buttonWidth,
        height,
    }
    context.save();
    context.globalAlpha *= Math.min(1, state.instructionsAlpha);
    context.save();
    context.globalAlpha *= 0.5;
    drawRectangle(context, rectangle, {fillStyle: '#000'});
    context.restore();
    renderButtonBackground(context, state, rectangle, false);

    //drawRectangle(context, rectangle, {fillStyle: '#000', strokeStyle: '#FFF'});
    let y = rectangle.top + buttonHeight / 2 + buttonHeight / 3;
    let x = rectangle.left + rectangle.width / 2;
    for (const line of state.hintLines) {
        drawText(context, line, x, y,
            {fillStyle: 'white', textAlign: 'center', textBaseline: 'middle', size: buttonFontSize}
        );
        y += 2 * buttonHeight / 3;
    }
    context.restore();
}
