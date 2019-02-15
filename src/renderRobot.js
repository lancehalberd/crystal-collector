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
const { requireImage, createAnimation, r } = require('animations');
const { z } = require('digging');

module.exports = {
    renderRobot
};

const idleAnimation = createAnimation('gfx/avatar.png', r(30, 30), {cols: 7, duration: 12, frameMap: [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 6]});

const tiredAnimation = createAnimation('gfx/avatar.png', r(30, 30), {x: 3, cols: 3, duration: 24, frameMap: [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2]});
const digAnimation = createAnimation('gfx/avatar.png', r(30, 30), {x: 7, cols: 3, duration: 4, frameMap: [0, 1, 2, 1, 2, 0]})

const hurtAnimation = createAnimation('gfx/avatar.png', r(30, 30), {x: 10, cols: 3, duration: 12, frameMap: [0, 0, 0, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1]})


const HEX_WIDTH = 2 * EDGE_LENGTH;
function renderRobot(context, state) {
    if (!state.robot) return;
    const {row, column} = state.robot;
    const left = column * COLUMN_WIDTH - state.camera.left;
    const top = row * ROW_HEIGHT - state.camera.top + ((column % 2) ? LONG_EDGE : 0);
    let animationTime = state.time - state.robot.animationTime;
    const columnz = z(column);
    const cell = state.rows[row] && state.rows[row][columnz];
    /*if (cell && cell.destroyed && animationTime >= digAnimation.duration / 2) {
        animationTime -= digAnimation.duration / 2;
        if (animationTime <= hurtAnimation.duration) {
            const animation = hurtAnimation;
            const x = left + HEX_WIDTH / 2;
            const y = top + EDGE_LENGTH;
            const animationFrame = Math.floor( animationTime / (FRAME_LENGTH * animation.frameDuration));
            const frame = animation.frames[Math.min(animationFrame, animation.frames.length - 1)];
            drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(x, y));
            return;
        }
        animationTime -= hurtAnimation.duration;
    } else {*/
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
    //}
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
    const animation = state.fuel ? idleAnimation : tiredAnimation;

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
