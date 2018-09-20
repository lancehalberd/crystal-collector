const {
    WIDTH,
    HEIGHT,
} = require('gameConstants');
const Rectangle = require('Rectangle');
const { drawImage } = require('draw');
const { requireImage, createAnimation, r } = require('animations');

const crystalFrame = {
    image: requireImage('gfx/militaryIcons.png'),
    left: 153,
    top: 40,
    width: 16,
    height: 16,
};
const skullFrame = {
    image: requireImage('gfx/militaryIcons.png'),
    left: 119,
    top: 23,
    width: 16,
    height: 16,
};
const explosionAnimation = createAnimation('gfx/explosion.png', r(96, 96), {cols: 12, duration: 3});
window.explosionAnimation = explosionAnimation;
let spriteIdCounter = 0;
function addSprite(state, sprite) {
    sprite.id = `sprite-${spriteIdCounter++}`;
    return {...state, spriteMap: {...state.spriteMap, [sprite.id]: sprite}};
}
function deleteSprite(state, sprite) {
    const spriteMap = {...state.spriteMap};
    delete spriteMap[sprite.id];
    return {...state, spriteMap};
}
function updateSprite(state, sprite, props) {
    if (!sprite || !sprite.id || !state.spriteMap[sprite.id]) return state;
    return {...state, spriteMap: {...state.spriteMap, [sprite.id]: {...state.spriteMap[sprite.id], ...props}}};
}
const crystalSprite = {
    advance(state, sprite) {
        if (sprite.x > state.camera.left + WIDTH || sprite.y > state.camera.top + HEIGHT) return deleteSprite(state, sprite);
        let {x = 0, y = 0, vx = 0, vy = 0, frame = 0} = sprite;
        x += vx;
        y += vy;
        frame++;
        if (frame > 20) {
            vx += (state.camera.left + WIDTH - x) / 300;
            vy += (state.camera.top + HEIGHT - y) / 300;
        }
        return updateSprite(state, sprite, {frame, x, y, vx, vy});
    },
    render(context, state, sprite) {
        drawImage(context, crystalFrame.image, crystalFrame,
            new Rectangle(crystalFrame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
        );
    }
};
const explosionSprite = {
    advance(state, sprite) {
        let {frame = 0} = sprite;
        if (frame > explosionAnimation.frames.length * explosionAnimation.frameDuration) return deleteSprite(state, sprite);
        frame++;
        return updateSprite(state, sprite, {frame, ending: frame >= 4 * explosionAnimation.frameDuration});
    },
    render(context, state, sprite) {
        const frame = explosionAnimation.frames[Math.floor(sprite.frame / explosionAnimation.frameDuration)];
        if (!frame) return;
        drawImage(context, frame.image, frame,
            new Rectangle(frame).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
        );
    }
};

module.exports = {
    addSprite,
    deleteSprite,
    updateSprite,
    crystalFrame,
    crystalSprite,
    explosionSprite,
    skullFrame,
    explosionAnimation,
};
