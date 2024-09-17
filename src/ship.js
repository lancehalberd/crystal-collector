const Rectangle = require('Rectangle');
const random = require('random');
const { drawImage, drawRectangle } = require('draw');
const { canvas, EDGE_LENGTH } = require('gameConstants');
const { r, createAnimation, getFrame, requireImage } = require('animations');

const warpDriveSlots = [
    [16, 23],
    [80, 81],
    [27, 74],
    [79, 23],
    [56, 50],
];
const arriveAnimation = createAnimation('gfx/teleport.png', r(30, 30), {x: 1, cols: 7, frameMap:[6,5,4,3,2,1,0]});

const duration = 36;
const shipPartAnimations = [
    createAnimation('gfx/warppieces.png', r(20, 20), {cols: 2, duration}),
    createAnimation('gfx/warppieces.png', r(20, 20), {x: 2, cols: 3, duration}),
    createAnimation('gfx/warppieces.png', r(20, 20), {x: 5, cols: 3, duration}),
    createAnimation('gfx/warppieces.png', r(20, 20), {x: 8, cols: 3, duration}),
    createAnimation('gfx/warppieces.png', r(20, 20), {x: 14, cols: 3, duration}),
];
const shipPartDepths = [10, 40, 80, 150, 200];
const shipAnimation = createAnimation('gfx/mothershipwarp.png', r(170, 57));

module.exports = {
    arriveAnimation,
    collectShipPart,
    getShipPartLocation,
    renderShip,
    renderShipScene,
    renderShipBackground,
    renderSpaceBackground,
    renderTransitionShipBackground,
    shipAnimation,
    shipPartAnimations,
    shipPartDepths,
    warpDriveSlots,
};
const { playSound, updateSave } = require('state');
const { addSprite, deleteSprite } = require('sprites');
const { getCellCenter, teleportOut, getTopTarget } = require('digging');
const { getLayoutProperties } = require('hud');


const shipPartRadius = 10;
function getShipPartLocation(state) {
    const baseDepth = shipPartDepths[Math.min(shipPartDepths.length - 1, state.saved.shipPart)];
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

const nightAnimation = createAnimation('gfx/nightskysleepanim.png', r(800, 1100), {
    cols: 3,
    duration: 20,
    frameMap: [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1],
});
const nightAnimationEmpty = createAnimation('gfx/nightskysleepanim.png', r(800, 1100), {x: 3});
const shipWarpStartAnimation = createAnimation('gfx/mothershipwarp.png', r(170, 57), {x: 1, cols: 3, duration: 20}, {loop: false});
const shipWarpAnimation = createAnimation('gfx/mothershipwarp.png', r(170, 57), {x: 4, cols: 6, duration: 4}, {loop: false});
const warpdriveAnimation = createAnimation('gfx/warpdrive.png', r(100, 100));

const shipEmergencyAnimation = {
    frames: [
        r(110, 110, {image: requireImage('gfx/cutscene/mothership_orange.png')}),
        r(110, 110, {image: requireImage('gfx/cutscene/mothership_red.png')}),
    ],
    frameDuration: 10, duration: 10 * 2,
};
function renderSpaceBackground(context, state) {
    let frame = getFrame(nightAnimation, state.time);
    // Fill the whole canvas with black, in case somehow it is too tall in portrait mode.
    drawRectangle(context, r(canvas.width, canvas.height), {fillStyle: '#000'});
    drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(0, 0));
    drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(400, 0));
}
function renderShipBackground(context, state) {
    return renderTransitionShipBackground(context, state);
}
function renderTransitionShipBackground(context, state) {
    if (state.camera.top >= 0) return;

    context.fillStyle = '#08F';
    context.fillRect(0, 0, canvas.width, -state.camera.top);
    const topTarget = getTopTarget();

    const spaceAlpha = Math.max(0, Math.min(1, (topTarget / 3 -state.camera.top) / (-topTarget * 2 / 3)));
    if (!spaceAlpha) return;
    context.save();
    context.globalAlpha = spaceAlpha;
    let frame = getFrame(nightAnimation, state.time);
    const spaceBaseHeight = Math.round(Math.min(
            0,
            -200 + 200 * (topTarget / 3 -state.camera.top) / (-topTarget * 2 / 3)
    ));
    const emptyFrame = getFrame(nightAnimationEmpty, state.time);
    if (state.outroTime > 6300) {
        const dx = (state.outroTime - 6300) / 2;
        //console.log('base dx ', dx)
        const firstFrame = dx < frame.width ? frame : emptyFrame;
        let x = canvas.width - frame.width;

        drawImage(context, firstFrame.image, firstFrame,
            new Rectangle(firstFrame).moveTo(dx % frame.width + x, spaceBaseHeight)
        );
        drawImage(context, emptyFrame.image, emptyFrame,
            new Rectangle(emptyFrame).moveTo(dx % frame.width + x - frame.width, spaceBaseHeight)
        );
        drawImage(context, emptyFrame.image, emptyFrame,
            new Rectangle(emptyFrame).moveTo(dx % frame.width + x - 2 * frame.width, spaceBaseHeight)
        );
    } else {
        let x = canvas.width - frame.width;
        drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(x, spaceBaseHeight));
        drawImage(context, emptyFrame.image, emptyFrame,
            new Rectangle(emptyFrame).moveTo(x - emptyFrame.width, spaceBaseHeight)
        );
    }
    // Fill the whole canvas with black, in case somehow it is too tall in portrait mode.
    if (spaceBaseHeight + frame.height < canvas.height) {
        const target = {left:0, top: frame.height + spaceBaseHeight, width: canvas.width, height: canvas.height - frame.height - spaceBaseHeight};
        drawRectangle(context, target, {fillStyle: '#000'});
    }
    context.restore();

}
function renderShip(context, state) {
    if (state.showOptions) console.log('Warning, renderShip() should not run during options.');
    const topTarget = getTopTarget();
    const shipBaseHeight = Math.min(
            canvas.height / 2,
            canvas.height / 2 * (topTarget * 2 / 3 -state.camera.top) / (-topTarget / 3)
    );
    let frame = getFrame(shipAnimation, state.time);
    let tx = Math.round(canvas.width / 2 + EDGE_LENGTH / 2);
    let dy = 3 * Math.sin(state.time / 500);
    if (state.outroTime !== false && state.outroTime >= 6000) {
        let animationTime = state.outroTime - 6000;
        const chargeTime = shipWarpStartAnimation.duration;
        tx += (animationTime < chargeTime) ? animationTime / 40 : (chargeTime / 40 - (animationTime - chargeTime));
        dy *= Math.max(0, chargeTime - animationTime) / chargeTime;
        let ty = Math.round(shipBaseHeight + dy);
        if (animationTime < chargeTime) {
            drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(tx, ty));
            frame = getFrame(shipWarpStartAnimation, animationTime );
            drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(tx, ty));
        } else {
            frame = getFrame(shipWarpAnimation, animationTime - chargeTime);
            drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(tx, ty));
        }
    } else {
        let ty = Math.round(shipBaseHeight + dy);
        if (state.introTime !== false && state.introTime >= 12000) {
            frame = getFrame(shipEmergencyAnimation, state.introTime - 12000);
            tx -= 14;
            ty += 2;
        }
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(tx, ty));
    }
    // Testing warp animation. Note that starting on frame 3, the ship shouldn't be drawn underneath.
    /*frame = getFrame(shipWarpAnimation, state.time);
    drawImage(context, frame.image, frame,
        new Rectangle(frame)
            .moveCenterTo(Math.round(canvas.width / 2 + EDGE_LENGTH / 2), Math.round(shipBaseHeight + 3 * Math.sin(state.time / 500)))
    );*/
}
function renderShipScene(context, state) {
    if (state.showOptions) console.log('Warning, renderShipScene() should not run during options.');
    renderShipBackground(context, state);
    renderShip(context, state);
    let frame = getFrame(warpdriveAnimation, 0);
    const scale = 2;
    const { portraitMode } = getLayoutProperties(state);
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
                frame = getFrame(arriveAnimation, animationTime);
                drawImage(context, frame.image, frame,
                    new Rectangle(frame).scale(scale).moveCenterTo(
                        left + scale * warpDriveSlots[i][0],
                        top + scale * warpDriveSlots[i][1],
                    )
                );
            }
            // Don't draw the part itself until the last part of the arrival animation
            if (animationTime < arriveAnimation.duration - 200) break;
        }
        frame = getFrame(animation, animationTime);
        // Make the elements blink during the outro time.
        if (state.outroTime > 0) {
            // Show each part for 600ms
            if (state.outroTime < 3000 && (state.outroTime < 600 * i || state.outroTime > 600 * (i + 1))) {
                continue;
            }
            // Blink all parts.
            if (state.outroTime >= 3000 && state.outroTime < 4500 && state.outroTime % 1000 > 500) continue;
        }
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(scale).moveCenterTo(
                left + scale * warpDriveSlots[i][0],
                top + scale * warpDriveSlots[i][1],
            )
        );
    }
}

const teleportAnimation = createAnimation('gfx/teleport.png', r(30, 30), {x: 1, cols: 7});
// This sprite shows the next ship part as long as animationTime is negative, then plays
// the teleport animation and disappears, returning the player to the ship scene.
const shipPartSprite = {
    advance(state, sprite) {
        const animationTime = state.time - sprite.time;
        if (animationTime === 0)playSound(state, 'teleport');
        if (animationTime >= teleportAnimation.duration + 500) {
            state = teleportOut(state);
            state = updateSave(state, {
                shipPart: Math.min(shipPartDepths.length - 1, state.saved.shipPart) + 1
            });
            return deleteSprite(state, sprite);
        }
        return state;
    },
    render(context, state, sprite) {
        const animationTime = state.time - sprite.time;
        let frame = shipPartAnimations[Math.min(shipPartDepths.length - 1, state.saved.shipPart)].frames[0];
        if (animationTime >= 0) frame = getFrame(teleportAnimation, animationTime);
        if (animationTime >= teleportAnimation.duration) return;
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
        );
    }
};
