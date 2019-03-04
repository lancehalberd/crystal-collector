const Rectangle = require('rectangle');
const random = require('random');
const { drawImage, drawRectangle } = require('draw');
const { canvas, EDGE_LENGTH } = require('gameConstants');
const { r, createAnimation, getFrame } = require('animations');

const warpDriveSlots = [
    [16, 23],
    [80, 81],
    [27, 74],
    [79, 23],
    [56, 50],
];

module.exports = {
    collectShipPart,
    getShipPartLocation,
    renderShip,
    renderShipScene,
    renderShipBackground,
    renderSpaceBackground,
    renderTransitionShipBackground,
    warpDriveSlots,
};
const { updateSave } = require('state');
const { addSprite, deleteSprite } = require('sprites');
const { getCellCenter, teleportOut } = require('digging');
const { getLayoutProperties } = require('hud');


const shipPartDepths = [10, 40, 80, 150, 200];
const shipPartRadius = 10;
function getShipPartLocation(state) {
    const baseDepth = shipPartDepths[state.saved.shipPart];
    const variance = 5 + 15 * baseDepth / 200;
    const row = Math.round((baseDepth + variance * random.normSeed(state.saved.seed)) / 2);
    return {row, column: Math.round(2 * shipPartRadius * random.normSeed(state.saved.seed + 1) - shipPartRadius)};
}
window.getShipPartLocation = getShipPartLocation;

function collectShipPart(state, row, column) {
    const {x, y} = getCellCenter(state, row, column);
    state = addSprite(state, {...shipPartSprite, x, y, time: state.time + 1000});
    state = {
        ...state,
        // This will prevent the player from taking any actions while the animation
        // plays for finding the ship part, which will end with the player seeing
        // the part in the ship diagram.
        collectingPart: true,
    };
    return state;
}

const nightAnimation = createAnimation('gfx/nightskysleep.png', r(800, 1100));
const shipAnimation = createAnimation('gfx/mothership.png', r(110, 110));
const warpdriveAnimation = createAnimation('gfx/warpdrive.png', r(100, 100));
function renderSpaceBackground(context) {
    let frame = getFrame(nightAnimation, 0);
    // Fill the whole canvas with black, in case somehow it is too tall in portrait mode.
    drawRectangle(context, r(canvas.width, canvas.height), {fillStyle: '#000'});
    drawImage(context, frame.image, frame, frame);
    drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(400, 0));
}
function renderShipBackground(context, state) {
    return renderTransitionShipBackground(context, state);
   /* let frame = getFrame(nightAnimation, 0);
    // Fill the whole canvas with black, in case somehow it is too tall in portrait mode.
    drawRectangle(context, r(canvas.width, canvas.height), {fillStyle: '#000'});
    drawImage(context, frame.image, frame, frame);*/
}
function renderTransitionShipBackground(context, state) {
    if (state.camera.top >= 0) return;

    context.fillStyle = '#08F';
    context.fillRect(0, 0, canvas.width, -state.camera.top);

    const spaceAlpha = Math.max(0, Math.min(1, (-state.camera.top - canvas.height) / (2 * canvas.height)));
    if (!spaceAlpha) return;
    context.save();
    context.globalAlpha = spaceAlpha;
    let frame = getFrame(nightAnimation, 0);
    const spaceBaseHeight = Math.round(Math.min(
            0,
            -200 + 200 * (-state.camera.top - canvas.height) / (2 * canvas.height)
    ));
    drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(0, spaceBaseHeight));
    // Fill the whole canvas with black, in case somehow it is too tall in portrait mode.
    if (spaceBaseHeight + frame.height < canvas.height) {
        const target = {left:0, top: frame.height + spaceBaseHeight, width: canvas.width, height: canvas.height - frame.height - spaceBaseHeight};
        drawRectangle(context, target, {fillStyle: '#000'});
    }
    context.restore();

}
function renderShip(context, state) {
    const shipBaseHeight = Math.min(
            canvas.height / 2,
            canvas.height / 2 * (-state.camera.top - canvas.height * 2) / (1 * canvas.height)
    );
    const frame = getFrame(shipAnimation, 0);
    drawImage(context, frame.image, frame,
        new Rectangle(frame)
            .moveCenterTo(Math.round(canvas.width / 2 + EDGE_LENGTH / 2), Math.round(shipBaseHeight + 3 * Math.sin(state.time / 500)))
    );
}
function renderShipScene(context, state) {
    renderShipBackground(context, state);
    renderShip(context, state);
    let frame = getFrame(warpdriveAnimation, 0);
    const scale = 2;
    const { portraitMode } = getLayoutProperties(context, state);
    const left = Math.round((portraitMode ? canvas.width / 2 : canvas.width / 4) - scale * frame.width / 2);
    const top = Math.round((portraitMode ? canvas.height / 4 : canvas.height / 2) - scale * frame.height / 2);
    drawImage(context, frame.image, frame,
        new Rectangle(frame).scale(scale).moveTo(left, top)
    );
    let animationTime = state.time - state.ship;
    for (let i = 0; i < state.saved.shipPart; i++) {
        let animation = shipPartAnimations[i];
        // If this part was just found, display it teleporting in.
        if (i === state.saved.shipPart - 1 && state.collectingPart) {
            if (animationTime < arriveAnimation.duration) {
                animation = arriveAnimation;
            } else {
                animationTime -= arriveAnimation.duration;
            }
        }
        frame = getFrame(animation, animationTime);
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(scale).moveCenterTo(
                left + scale * warpDriveSlots[i][0],
                top + scale * warpDriveSlots[i][1],
            )
        );
    }
}

const duration = 36;
const shipPartAnimations = [
    createAnimation('gfx/warppieces.png', r(20, 20), {cols: 2, duration}),
    createAnimation('gfx/warppieces.png', r(20, 20), {x: 2, cols: 3, duration}),
    createAnimation('gfx/warppieces.png', r(20, 20), {x: 5, cols: 3, duration}),
    createAnimation('gfx/warppieces.png', r(20, 20), {x: 8, cols: 3, duration}),
    createAnimation('gfx/warppieces.png', r(20, 20), {x: 14, cols: 3, duration}),
];
const teleportAnimation = createAnimation('gfx/teleport.png', r(30, 30), {x: 1, cols: 7});
const arriveAnimation = createAnimation('gfx/teleport.png', r(30, 30), {x: 1, cols: 7, frameMap:[6,5,4,3,2,1,0]});
// This sprite shows the next ship part as long as animationTime is negative, then plays
// the teleport animation and disappears, returning the player to the ship scene.
const shipPartSprite = {
    advance(state, sprite) {
        const animationTime = state.time - sprite.time;
        if (animationTime >= teleportAnimation.duration + 500) {
            state = teleportOut(state);
            state = updateSave(state, {shipPart: state.saved.shipPart + 1});
            return deleteSprite(state, sprite);
        }
        return state;
    },
    render(context, state, sprite) {
        const animationTime = state.time - sprite.time;
        let frame = shipPartAnimations[state.saved.shipPart].frames[0];
        if (animationTime >= 0) frame = getFrame(teleportAnimation, animationTime);
        if (animationTime >= teleportAnimation.duration) return;
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
        );
    }
};
