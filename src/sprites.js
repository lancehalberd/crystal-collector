const {
    WIDTH,
    HEIGHT,
} = require('gameConstants');
const Rectangle = require('Rectangle');
const { drawImage } = require('draw');
const { requireImage, createAnimation, r } = require('animations');

const militaryFrame = {
    image: requireImage('gfx/militaryIcons.png'),
    width: 16,
    height: 16,
}
const bombFrame = {...militaryFrame, left: 119, top: 108};
const diffuserFrame = {...militaryFrame, left: 0, top: 91};
const crystalFrame = {...militaryFrame, left: 153, top: 40};
const greenCrystalFrame = {...crystalFrame, left: 170};
const redCrystalFrame = {...crystalFrame, left: 187};
const skullFrame = {...militaryFrame, left: 119, top: 23};
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
        if (sprite.y > state.camera.top + HEIGHT - 60) {
            state = gainCrystals(state, sprite.crystals);
            return deleteSprite(state, sprite);
        }
        let {x = 0, y = 0, vx = 0, vy = 0, frame = 0} = sprite;
        x += vx;
        y += vy;
        frame++;
        if (frame > 0) {
            // This assumes each character in the score is about 20 pixels wide.
            const targetX = WIDTH - x - 80 - 20 * Math.floor(Math.log10(state.saved.score + 1));
            vx += (state.camera.left + targetX) / 300;
            vy += (state.camera.top + HEIGHT - y - 50) / 300;
        }
        return updateSprite(state, sprite, {frame, x, y, vx, vy});
    },
    render(context, state, sprite) {
        let scale = 1, frame = crystalFrame;
        const index = CRYSTAL_SIZES.indexOf(sprite.crystals);
        if (index % 3 === 1) frame = greenCrystalFrame;
        else if (index % 3 === 2) frame = redCrystalFrame;
        scale = 1.5 + Math.floor(scale / 3) * 0.5;
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(scale).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
        );
    }
};

const pAnimation = x => createAnimation('gfx/particles.png', r(10, 10), {x});
const particleAnimations = [
    [pAnimation(6),pAnimation(7),pAnimation(8),pAnimation(9)],
    [pAnimation(6),pAnimation(7),pAnimation(8),pAnimation(9)],
    [pAnimation(7),pAnimation(7),pAnimation(8),pAnimation(9)],
    [pAnimation(8),pAnimation(9),pAnimation(10),pAnimation(11)],
    [pAnimation(8),pAnimation(9),pAnimation(12),pAnimation(13)],
    [pAnimation(8),pAnimation(9),pAnimation(12),pAnimation(13)],
    [pAnimation(10),pAnimation(11),pAnimation(14),pAnimation(15)],
    [pAnimation(10),pAnimation(11),pAnimation(14),pAnimation(15)],
    [pAnimation(10),pAnimation(11),pAnimation(15),pAnimation(16)],
    [pAnimation(10),pAnimation(11),pAnimation(15),pAnimation(16)],
];
const debrisSprite = {
    advance(state, sprite) {
        if (sprite.y > state.camera.top + HEIGHT) {
            return deleteSprite(state, sprite);
        }
        let {x = 0, y = 0, vx = 0, vy = 0} = sprite;
        x += vx;
        y += vy;
        vy+=0.5;
        return updateSprite(state, sprite, {x, y, vx, vy});
    },
    render(context, state, sprite) {
        const frame = sprite.animation.frames[0];
        const x = sprite.x - state.camera.left;
        const y = sprite.y - state.camera.top;
        const target = new Rectangle(frame).scale(2).moveCenterTo(x, y);
        drawImage(context, frame.image, frame, target);
    }
};
const bombSprite = {
    advance(state, sprite) {
        if (sprite.y < state.camera.top + 20) {
            state = gainBonusFuel(state, sprite.bonusFuel);
            return deleteSprite(state, sprite);
        }
        let {x = 0, y = 0, vx = 0, vy = 0, frame = 0} = sprite;
        x += vx;
        y += vy;
        frame++;
        if (frame > 20) {
            vx += (state.camera.left + 200 - x) / 300;
            vy += (state.camera.top - y) / 300;
        }
        return updateSprite(state, sprite, {frame, x, y, vx, vy});
    },
    render(context, state, sprite) {
        let frame = bombFrame;
        if (sprite.frame < 0) {
            frame = diffuserFrame;
        }
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
        );
    }
};
const diffuserSprite = {
    advance(state, sprite) {
        if (vy > 0 && sprite.y > state.camera.top + HEIGHT + 32) {
            return deleteSprite(state, sprite);
        }
        let {y = 0, vy = 0, frame = 0} = sprite;
        frame++;
        if (frame > 0) {
            vy++;
            y += vy;
        }
        return updateSprite(state, sprite, {frame, y, vy});
    },
    render(context, state, sprite) {
        drawImage(context, diffuserFrame.image, diffuserFrame,
            new Rectangle(diffuserFrame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
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
    bombSprite,
    diffuserSprite,
    crystalFrame,
    crystalSprite,
    debrisSprite,
    diffuserFrame,
    explosionSprite,
    particleAnimations,
    skullFrame,
};

const { gainBonusFuel, CRYSTAL_SIZES, gainCrystals } = require('digging');
