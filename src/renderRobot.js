const {
    FRAME_LENGTH,
    canvas,
    ROW_HEIGHT,
    COLUMN_WIDTH,
    EDGE_LENGTH,
    LONG_EDGE,
} = require('gameConstants');
const Rectangle = require('Rectangle');
const { drawImage } = require('draw');
const { createAnimation, getFrame, r } = require('animations');
const { z } = require('digging');


const idleAnimation = createAnimation('gfx/avatar.png', r(30, 30), {cols: 7, duration: 12, frameMap: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 6]});

const tiredAnimation = createAnimation('gfx/avatar.png', r(30, 30), {x: 3, cols: 3, duration: 24, frameMap: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1]});
const digAnimation = createAnimation('gfx/avatar.png', r(30, 30), {x: 7, cols: 3, duration: 4, frameMap: [0, 1, 2, 1, 2, 0]})

const hurtAnimation = createAnimation('gfx/avatar.png', r(30, 30), {x: 10, cols: 3, duration: 6, frameMap: [0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0]})

const happyAnimation = createAnimation('gfx/avatar.png', r(30, 30), {x: 13, cols: 2, duration: 12});
const teleportOutAnimationStart = createAnimation('gfx/teleport.png', r(30, 30), {x: 0, cols: 8, frameMap: [0,1,2,3,4]}, {loop: false});
const teleportOutAnimationFinish = createAnimation('gfx/teleport.png', r(30, 30), {x: 0, cols: 8, frameMap: [5,6,7]}, {loop: false});
const teleportInAnimationStart = createAnimation('gfx/teleport.png', r(30, 30), {x: 0, cols: 8, frameMap: [7,6,5,4]}, {loop: false});
const teleportInAnimationFinish = createAnimation('gfx/teleport.png', r(30, 30), {x: 0, cols: 8, frameMap: [3,2,1]}, {loop: false});


module.exports = {
    renderRobot,
    teleportInAnimationFinish,
    teleportOutAnimationStart,
    teleportOutAnimationFinish,
};

const HEX_WIDTH = 2 * EDGE_LENGTH;
function renderRobot(context, state) {
    if (!state.robot) return;
    const {row, column} = state.robot;
    const left = column * COLUMN_WIDTH - state.camera.left;
    const top = row * ROW_HEIGHT - state.camera.top + ((column % 2) ? LONG_EDGE : 0);
    let animationTime = state.time - state.robot.animationTime;
    if (state.robot.teleportingIn) {
        const animation = state.robot.finishingTeleport ? teleportInAnimationFinish : teleportInAnimationStart;
        const frame = getFrame(animation, animationTime);
        const x = left + HEX_WIDTH * 2 / 4;
        const y = Math.min(top + EDGE_LENGTH, canvas.height / 2);
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(x, y));
        return;
    }
    if (state.robot.teleporting) {
        let p = 1;
        if (!state.robot.finishingTeleport) {
            p = (animationTime - teleportOutAnimationStart.duration) / 1000;
            p = Math.max(0, Math.min(1, p));
        }
        const sx = left + HEX_WIDTH * 2 / 4, tx = canvas.width / 2;
        const x = sx * (1 - p) + p * tx;
        const y = Math.min(top + EDGE_LENGTH, (top + EDGE_LENGTH) * (1 - p) + p * canvas.height / 2 + 20);
        const animation = state.robot.finishingTeleport ? teleportOutAnimationFinish : teleportOutAnimationStart;
        if (state.robot.finishingTeleport && animationTime >= animation.duration) return;
        const frame = getFrame(animation, animationTime);
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(x, y));
        return;
    }
    const columnz = z(column);
    const cell = state.rows[row] && state.rows[row][columnz];
    if (animationTime < digAnimation.duration) {
        const animation = digAnimation;
        let p = (animationTime % animation.duration) / animation.duration;
        p = Math.min(0.95, Math.max(0.05, p));
        const x = left + HEX_WIDTH / 2 - 0.5 * (p - 0.5) * HEX_WIDTH;
        const y = top + EDGE_LENGTH;
        const animationFrame = Math.floor( animationTime / (FRAME_LENGTH * animation.frameDuration));
        const frame = animation.frames[animationFrame % animation.frames.length];
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(x, y));
        return;
    }
    animationTime -= digAnimation.duration;
    if (cell && cell.destroyed) {
        if (animationTime <= hurtAnimation.duration) {
            const animation = hurtAnimation;
            const x = left + HEX_WIDTH / 4;
            const y = top + EDGE_LENGTH;
            const animationFrame = Math.floor( animationTime / (FRAME_LENGTH * animation.frameDuration));
            const frame = animation.frames[Math.min(animationFrame, animation.frames.length - 1)];
            drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(x, y));
            return;
        }
        animationTime -= hurtAnimation.duration;
    }
    if (state.robot.foundTreasure) {
        const x = left + HEX_WIDTH / 4;
        const y = top + EDGE_LENGTH;
        const frame = getFrame(happyAnimation, animationTime);
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(x, y));
        return;
    }
    const animation = state.saved.fuel ? idleAnimation : tiredAnimation;

    const animationFrame = Math.floor( animationTime / (FRAME_LENGTH * animation.frameDuration));

    const xScale = Math.floor(animationFrame / animation.frames.length) % 2 ? -1 : 1;

    let p = (animationTime % animation.duration) / animation.duration;
    p = Math.min(0.95, Math.max(0.05, p));

    const x = left + HEX_WIDTH / 2 + 0.5 * xScale * (p - 0.5) * HEX_WIDTH;
    const y = top + EDGE_LENGTH;

    const frame = animation.frames[animationFrame % animation.frames.length];
    context.save();
    context.translate(Math.round(x), Math.round(y));
    context.scale(xScale, 1);
    drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(0, 0));
    context.restore();
}
