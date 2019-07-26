const {
    canvas,
    ROW_HEIGHT,
    FRAME_LENGTH,
} = require('gameConstants');
const Rectangle = require('Rectangle');
const { drawImage } = require('draw');
const { playSound } = require('state');
const { requireImage, createAnimation, getFrame, r } = require('animations');

const militaryFrame = {
    image: requireImage('gfx/militaryIcons.png'),
    width: 16,
    height: 16,
}
const diffuserAnimation = createAnimation('gfx/diffuse.png', r(25, 25), {cols: 5}, {loop: false});
const crystalAnimations = [
     createAnimation('gfx/crystals.png', r(30, 30), {x:0}),
     createAnimation('gfx/crystals.png', r(30, 30), {x:1}),
     createAnimation('gfx/crystals.png', r(30, 30), {x:2}),
     createAnimation('gfx/crystals.png', r(30, 30), {x:3}),
     createAnimation('gfx/crystals.png', r(30, 30), {x:4}),
     createAnimation('gfx/crystals.png', r(30, 30), {x:5}),
     createAnimation('gfx/crystals.png', r(30, 30), {x:6}),
     createAnimation('gfx/crystals.png', r(30, 30), {x:7, cols:2}),
];
const crystalFrame = {...militaryFrame, left: 153, top: 40};
const explosionAnimation = createAnimation('gfx/explosion.png', r(215, 215), {cols: 14, duration: 3}, {loop: false});
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
        if (sprite.extractorTime) {
            // We delete the crystals as the extractor box closes, which happens on the first
            // frame of the diffuser(extractor) animation.
            const animationTime = state.time - sprite.extractorTime;
            if (animationTime >= FRAME_LENGTH * diffuserAnimation.frameDuration) {
                return deleteSprite(state, sprite);
            }
            return state;
        }
        let {x = 0, y = 0, vx = 0, vy = 0, frame = 0, animationFrame = 0} = sprite;
        frame++;
        animationFrame++;
        if (sprite.y > state.camera.top + canvas.height - 60) {
            state = gainCrystals(state, sprite.crystals);
            playSound(state, 'money');
            return deleteSprite(state, sprite);
        }
        x += vx;
        y += vy;
        if (frame > 0) {
            // This assumes each character in the score is about 20 pixels wide.
            const targetX = canvas.width - x - 80 - 20 * Math.floor(Math.log10(state.saved.score + 1));
            vx += (state.camera.left + targetX) / 300;
            vy += (state.camera.top + canvas.height - y - 50) / 300;
        }
        return updateSprite(state, sprite, {x, y, vx, vy, animationFrame, frame});
    },
    render(context, state, sprite) {
        const { animationFrame = 0 } = sprite;
        const size = CRYSTAL_SIZES.indexOf(sprite.crystals);
        const index = Math.min(Math.floor(size / 2), crystalAnimations.length - 1);
        const scale = 1 + 0.5 * (size%2);
        const animation = crystalAnimations[index];
        const frameIndex = Math.floor(animationFrame / 5) % animation.frames.length;
        const frame = animation.frames[frameIndex];
        if (!frame) debugger;
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(scale).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
        );
    }
};
const shieldAnimation = createAnimation('gfx/shield.png', r(25, 25), {cols: 5});
const shieldSprite = {
    advance(state, sprite) {
        if (state.time - sprite.time > 1000) return deleteSprite(state, sprite);
        return state;
    },
    render(context, state, sprite) {
        const animationTime = state.time - sprite.time;
        if (animationTime < 0) return;
        const frame = getFrame(shieldAnimation, animationTime);
        // console.log(sprite.time, animationTime, frame);
        context.save();
        const scale = Math.min(2, animationTime / 200);
        context.globalAlpha = Math.max(0, Math.min(0.6, 2 - 2 * animationTime / shieldAnimation.duration));
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(scale).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
        );
        context.restore();
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
        if (sprite.y > state.camera.top + canvas.height) {
            return deleteSprite(state, sprite);
        }
        let {x = 0, y = 0, vx = 0, vy = 0} = sprite;
        x += vx;
        y += vy;
        vy+=1;
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
const lavaBubbleAnimations = [
    createAnimation('gfx/particles.png', r(10, 10), {x:0, cols:3, frameMap: [0,0,0,1,1,2]}),
    createAnimation('gfx/particles.png', r(10, 10), {x:3, cols:3, frameMap: [0,0,0,1,1,2]}),
];
const magicParticleAnimations = [
    createAnimation('gfx/magicparticle.png', r(10, 10), {x:0, cols:3, frameMap: [0,0,0,1,1,2]}),
    createAnimation('gfx/magicparticle.png', r(10, 10), {x:3, cols:3, frameMap: [0,0,0,1,1,2]}),
]
const waveHeight = ROW_HEIGHT / 3;
const lavaBubbleSprite = {
    advance(state, sprite) {
        if (state.shop) return deleteSprite(state, sprite);
        if (state.time - sprite.spawnTime >= 160 * sprite.animation.frames.length) {
            // recycle the bubble.
            return updateSprite(state, sprite, {
                x: sprite.x + 250,
                y: 15+Math.floor(Math.random()*15),
                spawnTime: state.time
            });
            //return deleteSprite(state, sprite);
        }
        return updateSprite(state, sprite, {x: sprite.x + 1/5, y: sprite.y - 1/2});
    },
    render(context, state, sprite) {
        const lavaDepthY = state.displayLavaDepth * ROW_HEIGHT / 2 + ROW_HEIGHT / 2 - state.camera.top;
        if (lavaDepthY >= canvas.height + ROW_HEIGHT / 2) return;
        const time = state.time - sprite.spawnTime;
        const frameIndex = Math.floor(time / 160);
        let animation = sprite.animation;
        const lavaIsLowering = state.displayLavaDepth < state.saved.lavaDepth;
        if (lavaIsLowering) {
            const animationIndex = lavaBubbleAnimations.indexOf(animation);
            animation = magicParticleAnimations[animationIndex];
        }
        if (frameIndex >= animation.frames.length) return;
        const frame = animation.frames[frameIndex];
        // Wrap this bubble to always appear on screen.
        let x = (sprite.x - state.camera.left) % canvas.width;
        while (x+10<=0)x += canvas.width;
        const y = lavaDepthY + sprite.y - 7
            + waveHeight * Math.sin((x + state.time) / 100) / 20
            + waveHeight * Math.sin((x + state.time) / 200) / 10
            + waveHeight * Math.sin((x + state.time) / 500) / 5;
        //if (time === 0)console.log(x - state.camera.left, y - state.camera.top);
        const target = new Rectangle(frame).scale(2).moveCenterTo(x, y);
        drawImage(context, frame.image, frame, target);
    }
};
const bombSprite = {
    advance(state, sprite) {
        if (sprite.y < state.camera.top + 20) {
            state = gainBonusFuel(state, sprite.bonusFuel);
            playSound(state, 'energy');
            return deleteSprite(state, sprite);
        }
        let {x = 0, y = 0, vx = 0, vy = 0} = sprite;
        x += vx;
        y += vy;
        const animationTime = Math.max(0, state.time - sprite.time);
        if (animationTime > 0 && animationTime - FRAME_LENGTH <= 0) playSound(state, 'diffuser');
        if (animationTime >= diffuserAnimation.duration + 100) {
            vx += (state.camera.left + 200 - x) / 300;
            vy += (state.camera.top - y) / 300;
        }
        return updateSprite(state, sprite, {x, y, vx, vy});
    },
    render(context, state, sprite) {
        const animationTime = state.time - sprite.time;
        const frame = getFrame(diffuserAnimation, Math.max(0, animationTime));
        context.save();
        context.globalAlpha = Math.max(0, Math.min(1, 1 + animationTime / 200));
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
        );
        context.restore();
    }
};
const diffuserSprite = {
    advance(state, sprite) {
        if (vy > 0 && sprite.y > state.camera.top + canvas.height + 32) {
            return deleteSprite(state, sprite);
        }
        let {y = 0, vy = 0} = sprite;
        const animationTime = state.time - sprite.time;
        if (animationTime > 0) {
            vy++;
            y += vy;
        }
        return updateSprite(state, sprite, {y, vy});
    },
    render(context, state, sprite) {
        const frame = diffuserAnimation.frames[0];
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
        );
    }
};

const shipDebrisAnimation = createAnimation('gfx/bomb.png', r(20, 20), {cols: 6}, {loop: false});
const shipDebrisElectricityAnimation = createAnimation('gfx/bomb.png', r(20, 20), {x: 6, cols: 4}, {loop: false});
const shipDebrisSprite = {
    advance(state, sprite) {
        const animationTime = state.time - sprite.time;
        const animation = shipDebrisElectricityAnimation;
        if (sprite.defuseIn && sprite.defuseIn < animationTime) {
            return deleteSprite(state, sprite);
        }
        if (animationTime >= animation.duration) {
            state = detonateDebris(state, sprite.row, sprite.column);
            return deleteSprite(state, sprite);
        }
        return state;
    },
    render(context, state, sprite) {
        let frame = shipDebrisAnimation.frames[sprite.index];
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
        );
        const animationTime = state.time - sprite.time;
        // Don't draw electricity until animationTime is not negative.
        if (animationTime < 0) return;
        frame = getFrame(shipDebrisElectricityAnimation, animationTime);
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
        );
    }
};
const explosionSprite = {
    advance(state, sprite) {
        let {frame = 0} = sprite;
        if (frame === 0) playSound(state, 'explosion');
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
    diffuserAnimation,
    diffuserSprite,
    crystalFrame,
    crystalSprite,
    shieldSprite,
    debrisSprite,
    shipDebrisSprite,
    explosionAnimation,
    explosionSprite,
    particleAnimations,
    lavaBubbleSprite,
    lavaBubbleAnimations,
};

const { gainBonusFuel, CRYSTAL_SIZES, gainCrystals, detonateDebris } = require('digging');
